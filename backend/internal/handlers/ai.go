package handlers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"backend/internal/db"
	"backend/internal/models"
	"backend/internal/trends"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Reusable HTTP client for Groq API calls
var groqHTTPClient = &http.Client{
	Timeout: 120 * time.Second,
}

// AI Related Models
type GroqChatRequest struct {
	Model            string        `json:"model"`
	Messages         []GroqMessage `json:"messages"`
	Temperature      float64       `json:"temperature,omitempty"`
	MaxTokens        int           `json:"max_tokens,omitempty"`
	TopP             float64       `json:"top_p,omitempty"`
	FrequencyPenalty float64       `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64       `json:"presence_penalty,omitempty"`
	Stream           bool          `json:"stream,omitempty"`
}

type GroqStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content   string `json:"content"`
			Reasoning string `json:"reasoning"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

type GroqMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type GroqContentPart struct {
	Type     string        `json:"type"`
	Text     string        `json:"text,omitempty"`
	ImageURL *GroqImageURL `json:"image_url,omitempty"`
}

type GroqImageURL struct {
	URL string `json:"url"`
}

type GroqChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// collectStreamedContent reads SSE chunks from a streaming Groq response and
// assembles the full content string. This is needed because openai/gpt-oss-120b
// only returns content via streaming mode.
func collectStreamedContent(body io.Reader) (string, error) {
	scanner := bufio.NewScanner(body)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)
	var sb strings.Builder

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var chunk GroqStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 {
			delta := chunk.Choices[0].Delta
			if delta.Reasoning != "" {
				// If the model sends reasoning, wrap it in <think> tags for downstream handling
				sb.WriteString("<think>" + delta.Reasoning + "</think>")
			}
			if delta.Content != "" {
				sb.WriteString(delta.Content)
			}
		}
	}

	return sb.String(), scanner.Err()
}

func makeGroqCall(ctx context.Context, groqReq GroqChatRequest) (string, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY not configured")
	}

	groqReq.Stream = true
	jsonData, err := json.Marshal(groqReq)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := groqHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("groq api error: %d - %s", resp.StatusCode, string(body))
	}

	content, err := collectStreamedContent(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read stream: %w", err)
	}

	if content == "" {
		return "", fmt.Errorf("no content from groq stream")
	}

	return content, nil
}

// AnalyzeImage analyzes food from an uploaded image
func AnalyzeImage(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		slog.Error("AnalyzeImage failed: GROQ_API_KEY not configured")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	file, err := c.FormFile("image")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "image file is required"})
	}

	// 1. Check Subscription Limits
	userID := c.Get("userID").(primitive.ObjectID)
	var user models.User
	if err := db.UserCollection.FindOne(c.Request().Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	allowed, remaining, err := CheckAndIncrementUsage(c.Request().Context(), user, "scan")
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "usage check failed"})
	}
	if !allowed {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"error":     "Daily scan limit reached",
			"code":      "LIMIT_REACHED",
			"remaining": 0,
		})
	}
	slog.Info("Usage incremented", "userID", userID, "action", "scan", "remaining", remaining)

	// Get language and hint preference
	lang := c.FormValue("language")
	hint := c.FormValue("hint")

	langName := "Thai (ภาษาไทย)"
	langConstraint := "ใช้ภาษาไทยที่เป็นธรรมชาติ ถูกต้องตามหลักภาษา และเป็นชื่อที่คนไทยเรียกทั่วไป"
	if lang == "en" {
		langName = "English"
		langConstraint = "Use natural, professional English names as commonly used in a culinary context."
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open image"})
	}
	defer src.Close()

	imgBytes, err := io.ReadAll(src)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read image"})
	}

	base64Img := base64.StdEncoding.EncodeToString(imgBytes)
	mimeType := http.DetectContentType(imgBytes)

	userText := "Analyze this image and return the nutritional data in the requested JSON format."
	if hint != "" {
		userText += fmt.Sprintf(" The user provided a hint for the food identity: '%s'. Please verify and prioritize your ingredient extraction based heavily on this hint, using the image primarily to estimate visual portion sizes and specific cooking methods.", hint)
	}

	// Prepare Groq Request - Single-Pass Chain of Thought (CoT) Pipeline
	thaiDishReference := `
THAI FOOD REFERENCE (typical single-serving calorie ranges):
- ข้าวมันไก่ (Khao Man Gai): 450–550 kcal | ข้าวกะเพราหมูสับไข่ดาว (Basil Pork Rice): 550–700 kcal
- ผัดไทย (Pad Thai): 400–600 kcal | ต้มยำกุ้ง (Tom Yum Goong): 150–250 kcal
- แกงเขียวหวาน (Green Curry): 400–550 kcal/serving | ส้มตำ (Som Tam): 100–200 kcal
- ข้าวผัด (Fried Rice): 450–600 kcal | ผัดกระเพราไก่ (Basil Chicken): 350–500 kcal
- ขนมจีนน้ำยา (Khanom Jeen): 300–450 kcal | มะม่วงข้าวเหนียว (Mango Sticky Rice): 350–500 kcal
- ลาบหมู (Larb Moo): 250–400 kcal | น้ำตกหมู (Waterfall Pork): 250–400 kcal
- ต้มข่าไก่ (Tom Kha Gai): 250–350 kcal | แกงมัสมั่น (Massaman Curry): 500–700 kcal
- ยำวุ้นเส้น (Glass Noodle Salad): 200–350 kcal | ข้าวขาหมู (Pork Leg Rice): 550–750 kcal
- ก๋วยเตี๋ยวเนื้อ (Beef Noodle Soup): 350–500 kcal | บะหมี่เกี้ยว (Wonton Noodle): 300–450 kcal
`

	groqReq := GroqChatRequest{
		Model:       "meta-llama/llama-4-scout-17b-16e-instruct",
		Temperature: 0.1,
		MaxTokens:   900,
		TopP:        0.9,
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: fmt.Sprintf("You are an elite, highly precise Culinary Nutritionist and Clinical Dietitian specializing in Thai and Asian cuisine. Analyze the food in the image with extreme accuracy.\n\n"+
					"%s\n"+
					"STEP 1 — Write your thought process inside a <chain_of_thought> block:\n"+
					"  a) Identify the dish name and cross-reference the Thai Food Reference table above if applicable.\n"+
					"  b) Estimate the PORTION WEIGHT in grams by comparing visible food volume to a standard plate/bowl.\n"+
					"  c) List each key ingredient with its estimated weight and macro contribution.\n"+
					"  d) Account for hidden calories: cooking oil, sauces, sugar, coconut milk.\n"+
					"  e) Compute: total_calories = (protein×4) + (carbs×4) + (fat×9). Ensure alignment.\n"+
					"  f) Assign a confidence score 0–100 based on image clarity and food identifiability:\n"+
					"     - 80–100: Clear image, dish clearly identifiable, macros highly reliable\n"+
					"     - 50–79: Partially unclear, dish identifiable but some ingredients uncertain\n"+
					"     - 0–49: Blurry, mixed dishes, or food cannot be reliably identified\n\n"+
					"STEP 2 — Output ONLY valid JSON in a ```json block with these exact keys:\n"+
					"  {name: string, calories: number, protein: number, carbs: number, fat: number, confidence: number (0-100)}\n\n"+
					"If multiple foods are visible, pick the primary dish and estimate combined plate macros.\n"+
					"LANGUAGE CONSTRAINT: %s\n\n"+
					"Example:\n<chain_of_thought>\nI see Pad Thai... noodles ~120g, shrimp ~60g, egg ~50g, peanuts ~15g, oil ~10g...\nCalories = (12×4)+(45×4)+(18×9) = 48+180+162 = 390. Image is clear, confidence = 88.\n</chain_of_thought>\n```json\n{\"name\": \"ผัดไทยกุ้ง\", \"calories\": 390, \"protein\": 12, \"carbs\": 45, \"fat\": 18, \"confidence\": 88}\n```",
					thaiDishReference, langConstraint),
			},
			{
				Role: "user",
				Content: []GroqContentPart{
					{
						Type: "text",
						Text: userText,
					},
					{
						Type: "image_url",
						ImageURL: &GroqImageURL{
							URL: "data:" + mimeType + ";base64," + base64Img,
						},
					},
				},
			},
		},
	}

	slog.Info("Analyzing image with CoT AI Pipeline", "model", groqReq.Model, "language", langName, "mimeType", mimeType, "hasHint", hint != "")

	ctx, cancel := context.WithTimeout(c.Request().Context(), 60*time.Second)
	defer cancel()

	replyContent, err := makeGroqCall(ctx, groqReq)
	if err != nil {
		slog.Error("Vision AI failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to contact AI service"})
	}

	slog.Info("Raw AI Response Captured", "content_length", len(replyContent))

	// Clean markdown backticks to extract JSON
	re := regexp.MustCompile("(?s)```(?:json)?\n?(.*?)\n?```")
	jsonStr := replyContent
	if matches := re.FindStringSubmatch(replyContent); len(matches) > 1 {
		jsonStr = strings.TrimSpace(matches[1])
	} else {
		// Attempt to extract the first { ... } if no code blocks are found
		start := strings.Index(jsonStr, "{")
		end := strings.LastIndex(jsonStr, "}")
		if start != -1 && end != -1 && end > start {
			jsonStr = jsonStr[start : end+1]
		}
	}

	// Data Normalization / Guardrails
	var result struct {
		Name       string  `json:"name"`
		Calories   float64 `json:"calories"`
		Protein    float64 `json:"protein"`
		Carbs      float64 `json:"carbs"`
		Fat        float64 `json:"fat"`
		Confidence int     `json:"confidence"`
	}

	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		slog.Error("Failed to parse reasoning AI JSON", "error", err, "raw", replyContent)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to parse AI response"})
	}

	// Math Normalization: Calories = (P*4) + (C*4) + (F*9)
	computedCalories := (result.Protein * 4) + (result.Carbs * 4) + (result.Fat * 9)

	// If the AI's calories are wildly off (e.g. by more than 15 kcal) compared to macros, override it
	if result.Calories < computedCalories-15 || result.Calories > computedCalories+15 {
		slog.Warn("AI Calories mathematically misaligned, overriding", "ai_cal", result.Calories, "computed_cal", computedCalories)
		result.Calories = computedCalories
	}

	// Clamp confidence to valid range; default to 70 if AI forgot to include it
	if result.Confidence == 0 {
		result.Confidence = 70
	}
	if result.Confidence > 100 {
		result.Confidence = 100
	}

	slog.Info("Image analysis complete", "name", result.Name, "calories", result.Calories, "confidence", result.Confidence)
	return c.JSON(http.StatusOK, result)
}

// SuggestGoals suggests nutritional goals based on user biometrics
func SuggestGoals(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		slog.Error("SuggestGoals failed: GROQ_API_KEY not configured")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	var data struct {
		Age       int     `json:"age"`
		Weight    float64 `json:"weight"`
		Height    float64 `json:"height"`
		Sex       string  `json:"sex"`
		Objective string  `json:"objective"`
		Language  string  `json:"language"`
	}
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	langConstraint := "Respond in Thai (ภาษาไทย)"
	if data.Language == "en" {
		langConstraint = "Respond in English"
	}

	systemPrompt := "Act as an expert Clinical Dietitian. You suggest optimal daily nutritional goals. " +
		"CRITICAL: The response MUST be a pure raw JSON object with these exact keys: calories (number), protein (number), carbs (number), fat (number), explanation (string, max 50 words). " +
		"Ensure macronutrients logically match the calories: Calories ~= (P*4) + (C*4) + (F*9). " +
		"Respond ONLY with the JSON object. NO markdown, NO text before or after."

	userPrompt := fmt.Sprintf("Suggest daily nutritional goals for a %d-year-old %s weighing %.1f kg and %.1f cm tall with the health objective of '%s'. %s",
		data.Age, data.Sex, data.Weight, data.Height, data.Objective, langConstraint)

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Temperature: 0.3,
		MaxTokens:   4096,
		TopP:        0.9,
		Messages: []GroqMessage{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: userPrompt,
			},
		},
	}

	slog.Info("Suggesting goals with AI", "age", data.Age, "objective", data.Objective)
	return callGroq(c, groqReq)

}

// ConsultAI provides nutritional advice based on data fetched from DB for a specific date range
func ConsultAI(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		slog.Error("ConsultAI failed: GROQ_API_KEY not configured")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	var data struct {
		Date      string `json:"date"`      // YYYY-MM-DD (Single day)
		StartDate string `json:"startDate"` // YYYY-MM-DD
		EndDate   string `json:"endDate"`   // YYYY-MM-DD
		Language  string `json:"language"`
	}
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Determine start and end dates
	var startStr, endStr string
	if data.Date != "" {
		startStr = data.Date
		endStr = data.Date
	} else {
		startStr = data.StartDate
		endStr = data.EndDate
	}

	// Default to last 7 days if dates are not provided
	if endStr == "" {
		endStr = time.Now().Format("2006-01-02")
	}
	if startStr == "" {
		sTime, _ := time.Parse("2006-01-02", endStr)
		startStr = sTime.AddDate(0, 0, -6).Format("2006-01-02")
	}

	startDate, err1 := time.Parse("2006-01-02", startStr)
	endDate, err2 := time.Parse("2006-01-02", endStr)
	if err1 != nil || err2 != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid date format, use YYYY-MM-DD"})
	}

	// Prepare time boundaries
	startOfDay := time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)
	endOfRange := time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 0, time.UTC)
	numDays := int(endDate.Sub(startDate).Hours()/24) + 1
	if numDays < 1 {
		numDays = 1
	}

	// Determine language instruction
	langInstruction := "คุณคือ 'ที่ปรึกษาด้านโภชนาการและการออกกำลังกายระดับพรีเมียม' สื่อสารด้วยภาษาไทยที่สมบูรณ์แบบ (ตัวอักษรไทยและอังกฤษเท่านั้น) เป็นธรรมชาติ นุ่มนวลแต่มีความเป็นมืออาชีพสูง " +
		"ห้ามใช้สำนวนแปลกๆ ที่เหมือนแปลตรงตัวจากภาษาอังกฤษ ห้ามใช้คำทับศัพท์ภาษาอังกฤษหากมีคำไทยที่เหมาะสม และห้ามมีภาษาอื่น (เช่น จีน, รัสเซีย, ญี่ปุ่น) ปนเปื้อนเข้ามาในบทสนทนาเด็ดขาด ห้ามใช้ตัวอักษรจีน '营养' โดยเด็ดขาด ให้ใช้คำว่า 'โภชนาการ' เท่านั้น "
	if data.Language == "en" {
		langInstruction = "You are a 'Premium Nutrition & Fitness Consultant'. Respond entirely in high-level, sophisticated English. Use a professional, encouraging, and natural tone. Do not use any slang or non-English phrases. "
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	foodFilter := bson.M{"userId": userID, "date": bson.M{"$gte": startOfDay, "$lte": endOfRange}}

	// Parallel DB fetches
	var (
		u         models.User
		g         models.Goals
		foods     []models.Food
		weights   []models.WeightRecord
		exercises []models.ExerciseRecord
		sleeps    []models.SleepRecord
		trendStr  string
		wg        sync.WaitGroup
	)

	wg.Add(7)
	go func() {
		defer wg.Done()
		db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	}()
	go func() {
		defer wg.Done()
		trendStr, _ = trends.CalculateUserTrends(userID, 30)
	}()
	go func() {
		defer wg.Done()
		db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g)
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.FoodsCollection.Find(ctx, foodFilter); err == nil {
			cur.All(ctx, &foods)
		}
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.WeightCollection.Find(ctx, foodFilter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}})); err == nil {
			cur.All(ctx, &weights)
		}
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.ExerciseCollection.Find(ctx, foodFilter); err == nil {
			cur.All(ctx, &exercises)
		}
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.SleepCollection.Find(ctx, foodFilter); err == nil {
			cur.All(ctx, &sleeps)
		}
	}()
	wg.Wait()

	// Build context strings from fetched data
	var totalCal, totalPro, totalFat float64
	for _, f := range foods {
		totalCal += f.Calories
		totalPro += models.SafeFloat(f.Protein)
		totalFat += models.SafeFloat(f.Fat)
	}
	avgCal := totalCal / float64(numDays)
	avgPro := totalPro / float64(numDays)
	avgFat := totalFat / float64(numDays)

	summaryStr := fmt.Sprintf("Period: %s to %s (%d days)\n", startStr, endStr, numDays)
	summaryStr += fmt.Sprintf("Daily avg: %.0f kcal, P:%.1fg, F:%.1fg\n", avgCal, avgPro, avgFat)
	summaryStr += fmt.Sprintf("Food logs: %d items\n", len(foods))

	var weightStr string
	for _, w := range weights {
		weightStr += fmt.Sprintf("%s: %.1fkg\n", w.Date.Format("2006-01-02"), w.Weight)
	}

	var exerciseStr string
	var totalExCal float64
	for _, ex := range exercises {
		exerciseStr += fmt.Sprintf("- %s: %dmin (%.0fkcal)\n", ex.Name, ex.DurationMinutes, models.SafeFloat(ex.CaloriesBurned))
		totalExCal += models.SafeFloat(ex.CaloriesBurned)
	}

	var sleepStr string
	for _, sl := range sleeps {
		sleepStr += fmt.Sprintf("- %s: %.1fh (%s)\n", sl.Date.Format("2006-01-02"), sl.DurationHours, models.SafeString(sl.Quality))
	}

	goalsStr := "Not set"
	objectiveStr := "Not set"
	if g.Calories > 0 {
		objectiveStr = g.Objective
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Fat:%.1f", g.Calories, g.Protein, g.Fat)
	}

	preferenceStr := ""
	if u.DietaryPreferences != "" || u.Allergies != "" || u.FoodDislikes != "" || u.TonePreference != "" {
		preferenceStr = fmt.Sprintf("Prefs:%s; Allergies:%s; Dislikes:%s; Tone:%s", u.DietaryPreferences, u.Allergies, u.FoodDislikes, u.TonePreference)
	}

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Temperature: 0.3,
		MaxTokens:   2048,
		TopP:        0.9,
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: "Persona: Elite Clinical Dietitian & Performance Consultant. " +
					langInstruction +
					"Analyze trends for " + startStr + " to " + endStr + ".\n\n" +
					"--- 30-DAY TRENDS ---\n" + trendStr + "\n" +
					"--- PERIOD SUMMARY ---\n" + summaryStr + "\n" +
					"Profile: " + fmt.Sprintf("W:%.1fkg H:%.1fcm Age:%d", u.Weight, u.Height, u.Age) + "\n" +
					"Prefs: " + preferenceStr + "\n" +
					"Goals: " + goalsStr + " | Obj: " + objectiveStr + "\n\n" +
					"--- LOGS ---\n" +
					"Weight:\n" + weightStr + "\n" +
					"Exercise (burned " + fmt.Sprintf("%.0f", totalExCal) + " kcal total):\n" + exerciseStr + "\n" +
					"Sleep:\n" + sleepStr + "\n" +
					"INSTRUCTIONS:\n" +
					"1. Use <think> to plan internally (hidden from user).\n" +
					"2. Compare daily intake vs goals with precise math.\n" +
					"3. Connect weight changes with energy balance and exercise.\n" +
					"4. Give 3 'Level-Up' recommendations.\n" +
					"After <think>: Snapshot(1-2 sentences), Key Insights(3 bullets), Level-Up Plan(3 bullets).\n" +
					"Max 350 words. Tone: Expert, motivating, no fluff.",
			},
			{
				Role:    "user",
				Content: "Analyze my health trends for " + startStr + " to " + endStr + ".",
			},
		},
	}

	slog.Info("Consulting AI", "model", groqReq.Model, "userID", userID, "range", startStr+" to "+endStr, "foods", len(foods), "weights", len(weights), "exercises", len(exercises), "sleeps", len(sleeps))
	return callGroq(c, groqReq)
}

func callGroq(c echo.Context, groqReq GroqChatRequest) error {
	apiKey := os.Getenv("GROQ_API_KEY")

	groqReq.Stream = true
	jsonData, _ := json.Marshal(groqReq)

	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("AI service request failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to contact AI service"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Error("AI service returned error", "status", resp.StatusCode, "body", string(body))
		return c.JSON(resp.StatusCode, map[string]string{"error": fmt.Sprintf("AI service error (%d): %s", resp.StatusCode, string(body))})
	}

	content, err := collectStreamedContent(resp.Body)
	if err != nil {
		slog.Error("Failed to collect streamed content", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read AI stream"})
	}

	if content == "" {
		slog.Warn("AI returned empty content after streaming")
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "AI returned no content"})
	}

	slog.Info("AI Streamed Response Collected", "content_length", len(content))

	// Implement Hidden Chain-of-Thought (Remove <think> ... </think> blocks cleanly)
	thinkRe := regexp.MustCompile("(?s)<think>.*?</think>\\n*")
	originalContent := content
	content = thinkRe.ReplaceAllString(content, "")
	content = strings.TrimSpace(content)

	// Fallback: If stripped content is empty but original had content, provide a notice or the raw content
	if content == "" && originalContent != "" {
		slog.Warn("AI output was only thinking, falling back to raw content with markers")
		content = "💡 *Analysis Insight:*\n\n" + originalContent
	}

	// Clean markdown backticks if current content is wrapped
	re := regexp.MustCompile("(?s)^\\s*```(?:json|markdown)?\\n?(.*?)\\n?```\\s*$")
	if matches := re.FindStringSubmatch(content); len(matches) > 1 {
		content = strings.TrimSpace(matches[1])
	}

	// Ensure it's returned as application/json
	return c.Blob(http.StatusOK, "application/json", []byte(content))
}

// ChatAI provides a general personal chat interface with session persistence
func ChatAI(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	var data struct {
		SessionID string        `json:"sessionId"`
		Messages  []GroqMessage `json:"messages"`
		Language  string        `json:"language"`
	}
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Determine language instruction
	langInstruction := "คุณคือ 'ที่ปรึกษาด้านสุขภาพและนักกำหนดอาหารระดับพรีเมียม' ที่มีความเชี่ยวชาญสูงสุด สื่อสารด้วยภาษาไทยที่สมบูรณ์แบบ (ห้ามใช้อักษรภาษาอื่นนอกจากไทยและอังกฤษ) เป็นธรรมชาติ รูปประโยคเหมือนคนไทยพูดจริงๆ มีระดับ และน่าเชื่อถือ " +
		"ห้ามแปลตรงตัวจากภาษาอังกฤษ (เช่น ห้ามใช้คำว่า 'คุณอาจต้องการพิจารณาการเพิ่ม X ลงในอาหาร' ให้ใช้ 'แนะนำให้ทาน X เสริมดีกว่าครับ') " +
		"ห้ามใช้คำทับศัพท์ภาษาอังกฤษโดยไม่จำเป็นเด็ดขาด CRITICAL: ห้ามพิมพ์ตัวอักษรภาษารัสเซีย จีน หรือภาษาอื่นที่ไม่ใช่ไทยและอังกฤษเด็ดขาด! ห้ามพิมพ์คำว่า 'Кาลอรี่' หรือ '营养' (Nutrition) โดยเด็ดขาด ให้ใช้คำว่า 'แคลอรี่' และ 'โภชนาการ' แทนเท่านั้น! โปรดตรวจสอบทุกตัวอักษรก่อนตอบ " +
		"ในการเรียกชื่ออาหารเสริมให้ใช้คำที่คนไทยคุ้นเคย เช่น 'เวย์โปรตีน' แทน 'โปรตีนผง' "
	foodNameLang := "Thai"
	foodExampleName := "ข้าวผัดกะเพราอกไก่ไข่ดาว"
	if data.Language == "en" {
		langInstruction = "You are a 'Premium Health Consultant'. Respond entirely in sophisticated, professional English. Use a natural, helpful, and expert tone. "
		foodNameLang = "English"
		foodExampleName = "Basil Chicken Stir-fry with Rice and Fried Egg"
	}
	// Increase timeout to 60s to allow for Groq response + DB updates
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)

	// --- Session Management ---
	var sessionID primitive.ObjectID
	var session models.ChatSession
	useSession := false

	if data.SessionID != "" {
		if id, err := primitive.ObjectIDFromHex(data.SessionID); err == nil {
			sessionID = id
			err = db.ChatSessionsCollection.FindOne(ctx, bson.M{"_id": sessionID, "userId": userID}).Decode(&session)
			if err == nil {
				useSession = true
			}
		}
	}

	// --- Ensure Session ID for New Sessions ---
	if !useSession {
		sessionID = primitive.NewObjectID()
	}

	// If sending messages, persist user message
	if len(data.Messages) > 0 {
		lastMsg := data.Messages[len(data.Messages)-1]
		if lastMsg.Role == "user" {
			newMsg := models.ChatMessage{
				Role:      "user",
				Content:   fmt.Sprintf("%v", lastMsg.Content),
				Timestamp: time.Now(),
			}

			if useSession {
				db.ChatSessionsCollection.UpdateOne(ctx,
					bson.M{"_id": sessionID},
					bson.D{
						{Key: "$push", Value: bson.M{"messages": newMsg}},
						{Key: "$set", Value: bson.M{"updatedAt": time.Now()}},
					},
				)
				session.Messages = append(session.Messages, newMsg)
			} else {
				// Create new session in DB
				// Slice title properly using runes to avoid Thai character corruption
				runes := []rune(newMsg.Content)
				title := string(runes)
				if len(runes) > 40 {
					title = string(runes[:37]) + "..."
				}
				session = models.ChatSession{
					ID:        sessionID,
					UserID:    userID,
					Title:     title,
					Messages:  []models.ChatMessage{newMsg},
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}
				db.ChatSessionsCollection.InsertOne(ctx, session)
				useSession = true
			}
		}
	}

	// Prepare history for Groq
	var chatHistory []GroqMessage
	if useSession {
		for _, m := range session.Messages {
			chatHistory = append(chatHistory, GroqMessage{Role: m.Role, Content: m.Content})
		}
	} else {
		chatHistory = data.Messages
	}

	// --- RAG: Fetch Context from DB ---
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// 1. Fetch Today's foods
	todayFoodStr := "No foods recorded today yet."
	todayFoods := []models.Food{}
	todayCursor, _ := db.FoodsCollection.Find(ctx, bson.M{
		"userId": userID,
		"date":   bson.M{"$gte": startOfToday},
	}, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
	if todayCursor != nil {
		defer todayCursor.Close(ctx)
		if err := todayCursor.All(ctx, &todayFoods); err == nil {
			var sb strings.Builder
			for _, f := range todayFoods {
				sb.WriteString(fmt.Sprintf("- %s: %.0f kcal, P:%.1fg, F:%.1fg (%s)\n",
					f.Name, f.Calories, models.SafeFloat(f.Protein), models.SafeFloat(f.Fat), f.MealCategory))
			}
			if sb.Len() > 0 {
				todayFoodStr = sb.String()
			}
		}
	}

	// 2. Fetch Recent History (Last 15, excluding today if many)
	historyStr := "No recent food history."
	historyFoods := []models.Food{}
	histOpts := options.Find().SetLimit(15).SetSort(bson.D{{Key: "date", Value: -1}})
	histCursor, _ := db.FoodsCollection.Find(ctx, bson.M{
		"userId": userID,
		"date":   bson.M{"$lt": startOfToday},
	}, histOpts)
	if histCursor != nil {
		defer histCursor.Close(ctx)
		if err := histCursor.All(ctx, &historyFoods); err == nil {
			var sb strings.Builder
			for _, f := range historyFoods {
				sb.WriteString(fmt.Sprintf("- %s: %.0f kcal, P:%.1fg, F:%.1fg (%s, %s)\n",
					f.Name, f.Calories, models.SafeFloat(f.Protein), models.SafeFloat(f.Fat), f.MealCategory, f.Date.Format("2006-01-02")))
			}
			if sb.Len() > 0 {
				historyStr = sb.String()
			}
		}
	}

	// Fetch weight, exercise, sleep, water, measurements concurrently
	weightCh := make(chan string, 1)
	exerciseCh := make(chan string, 1)
	sleepCh := make(chan string, 1)
	waterCh := make(chan string, 1)
	measurementCh := make(chan string, 1)
	goalsCh := make(chan string, 1)
	userCh := make(chan string, 1)
	trendCh := make(chan string, 1)

	// Fetch Weight History (Last 5)
	go func() {
		var sb strings.Builder
		wCursor, err := db.WeightCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
		if err == nil {
			defer wCursor.Close(ctx)
			var weights []models.WeightRecord
			if err := wCursor.All(ctx, &weights); err == nil {
				for _, w := range weights {
					sb.WriteString(fmt.Sprintf("%s: %.1fkg\n", w.Date.Format("2006-01-02"), w.Weight))
				}
			}
		}
		weightCh <- sb.String()
	}()

	// Fetch Exercise History (Last 5)
	go func() {
		var sb strings.Builder
		eCursor, err := db.ExerciseCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
		if err == nil {
			defer eCursor.Close(ctx)
			var exercises []models.ExerciseRecord
			if err := eCursor.All(ctx, &exercises); err == nil {
				for _, ex := range exercises {
					sb.WriteString(fmt.Sprintf("- %s (%d min, %.0f kcal burned, %s)\n", ex.Name, ex.DurationMinutes, models.SafeFloat(ex.CaloriesBurned), ex.Date.Format("2006-01-02")))
				}
			}
		}
		exerciseCh <- sb.String()
	}()

	// Fetch Sleep History (Last 5)
	go func() {
		var sb strings.Builder
		sCursor, err := db.SleepCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
		if err == nil {
			defer sCursor.Close(ctx)
			var sleeps []models.SleepRecord
			if err := sCursor.All(ctx, &sleeps); err == nil {
				for _, sl := range sleeps {
					sb.WriteString(fmt.Sprintf("- %s: %.1f hrs (%s)\n", sl.Date.Format("2006-01-02"), sl.DurationHours, models.SafeString(sl.Quality)))
				}
			}
		}
		sleepCh <- sb.String()
	}()

	// Fetch Water Intake (Last 5 days)
	go func() {
		var sb strings.Builder
		watCursor, err := db.WaterCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
		if err == nil {
			defer watCursor.Close(ctx)
			var waters []models.WaterIntake
			if err := watCursor.All(ctx, &waters); err == nil {
				for _, wat := range waters {
					sb.WriteString(fmt.Sprintf("- %s: %d glasses\n", wat.Date, wat.Glasses))
				}
			}
		}
		waterCh <- sb.String()
	}()

	// Fetch Body Measurements (Last 3)
	go func() {
		var sb strings.Builder
		mCursor, err := db.BodyMeasurementCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(3).SetSort(bson.D{{Key: "date", Value: -1}}))
		if err == nil {
			defer mCursor.Close(ctx)
			var measurements []models.BodyMeasurement
			if err := mCursor.All(ctx, &measurements); err == nil {
				for _, m := range measurements {
					sb.WriteString(fmt.Sprintf("- %s: Waist: %.1fcm, Body Fat: %.1f%%\n", m.Date.Format("2006-01-02"), m.WaistCircumference, m.BodyFatPercentage))
				}
			}
		}
		measurementCh <- sb.String()
	}()

	// Fetch Goals
	go func() {
		var g models.Goals
		goalsStr := "Not set"
		objectiveStr := "Not set"
		if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
			goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Carb:%.1f, Fat:%.1f", g.Calories, g.Protein, g.Carbs, g.Fat)
			if g.Objective != "" {
				objectiveStr = g.Objective
			}
		}
		goalsCh <- goalsStr + "||" + objectiveStr
	}()

	// Fetch User Profile
	go func() {
		var u models.User
		userStr := "Not provided"
		preferenceStr := "Not provided"
		longTermContext := ""
		if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
			userStr = fmt.Sprintf("Name: %s, Age: %d, Current W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
			longTermContext = u.LongTermContext
			if u.DietaryPreferences != "" || u.Allergies != "" || u.FoodDislikes != "" || u.TonePreference != "" {
				preferenceStr = fmt.Sprintf("Dietary preferences: %s; Allergies: %s; Dislikes: %s; Tone: %s", u.DietaryPreferences, u.Allergies, u.FoodDislikes, u.TonePreference)
			}
		}
		userCh <- userStr + "||" + preferenceStr + "||" + longTermContext
	}()

	// Fetch Trends
	go func() {
		trendSummary, _ := trends.CalculateUserTrends(userID, 30)
		trendCh <- trendSummary
	}()

	// Wait for all concurrent fetches
	weightStr := <-weightCh
	exerciseStr := <-exerciseCh
	sleepStr := <-sleepCh
	waterStr := <-waterCh
	measurementStr := <-measurementCh
	goalsData := <-goalsCh
	userData := <-userCh
	trendSummary := <-trendCh

	goalsParts := strings.Split(goalsData, "||")
	goalsStr, objectiveStr := goalsParts[0], goalsParts[1]
	if len(goalsParts) > 2 {
		objectiveStr = goalsParts[1]
	}

	userParts := strings.Split(userData, "||")
	userStr, preferenceStr := userParts[0], userParts[1]
	longTermContext := ""
	if len(userParts) > 2 {
		longTermContext = userParts[2]
	}

	contextPrompt := "Persona: Elite Clinical Dietitian & Health Consultant. " +
		langInstruction +
		"\n\n--- CURRENT DATE/TIME ---\n" + now.Format("Monday, 2006-01-02 15:04 MST") + "\n\n" +
		"--- LONG-TERM CONTEXT ---\n" + longTermContext + "\n\n" +
		"--- 30-DAY TREND DATA ---\n" + trendSummary + "\n\n" +
		"CRITICAL NUTRITION ACCURACY RULES: \n" +
		"- DO NOT hallucinate health benefits. If a food is unhealthy, fatty (e.g., pork neck / คอหมูย่าง, fried foods), or sugary, state facts firmly. DO NOT call high-fat foods 'balanced fat'.\n" +
		"- Know sports science: Cardio (running/cycling) builds endurance and burns calories, but DOES NOT build muscle. Resistance training builds muscle.\n" +
		"- Ensure all calorie and macronutrient calculations naturally align with physics (e.g., 1g protein=4kcal, 1g carbs=4kcal, 1g fat=9kcal).\n" +
		"CRITICAL MATH RULE: Total calories MUST logically support the sum of macros: Calories should be at least (Protein * 4) + (Carbs * 4) + (Fat * 9). " +
		"Use the provided user data deeply to personalize every response. " +
		"While health is your expertise, you are intelligent enough to discuss any topic with a consistent, premium persona.\n\n" +
		"--- USER DATA ---\n" +
		"Profile: " + userStr + "\nPreferences: " + preferenceStr + "\nGoals: " + goalsStr + "\nObjective: " + objectiveStr + "\n" +
		"\n--- TODAY'S MEALS ---\n" + todayFoodStr + "\n" +
		"\n--- RECENT FOOD HISTORY ---\n" + historyStr + "\n" +
		"Weight Trend: " + weightStr + "\nExercise: " + exerciseStr + "\nSleep: " + sleepStr + "\nWater: " + waterStr + "\nMeasurements: " + measurementStr + "\n\n" +
		"CRITICAL INSTRUCTIONS:\n" +
		"1. ALWAYS START your response with a <think> ... </think> block. Inside this block, meticulously analyze the context, perform step-by-step mathematical calculations for any macronutrients you will suggest, and cross-check that Calories >= (P*4)+(C*4)+(F*9).\n" +
		"2. Connect the dots logically (e.g., accurately assess if their meal matches their exercise).\n" +
		"3. Provide precise and highly accurate nutritional breakdowns.\n" +
		fmt.Sprintf("4. If you recommend or they mention a food, append a special tag at the VERY END (AFTER the think block): `[ADD: %s | 100 | 10 | 20 | 2]` (Format: [ADD: Name | Calories | Protein | Carbs | Fat])\n", foodExampleName) +
		"5. Ensure macronutrients STRICTLY sum up realistically, and the name is in " + foodNameLang + " language.\n" +
		"6. Use Markdown, emojis, and clear spacing AFTER the think block. " +
		"7. Maintain a polite, highly expert, and encouraging tone. " +
		"8. Keep responses CONCISE and high-impact. Avoid extremely long tables or repetitive summaries unless specifically asked for a deep dive. Focus on quality over quantity. " +
		"9. If the user message consists ONLY of a food name (e.g., 'ข้าวมันไก่', 'Pad Thai', 'Apple'), output your <think> block, then immediately respond ONLY with its nutritional information in a concise format (Calories, P, C, F) and the [ADD: ...] tag.\n" +
		"10. STRICT LANGUAGE LOCKDOWN: Use ONLY Thai and Latin (English) characters. ABSOLUTELY NO Chinese (e.g., 营养), Cyrillic (e.g., คาลอรี่), Japanese, or other foreign scripts. If you output 'Nutrition', it must be 'โภชนาการ'. If you output 'Calories', it must be 'แคลอรี่' or 'kcal' in Latin characters. Failure to stick to Thai/English characters will result in failure of the task."

	systemMsg := GroqMessage{
		Role:    "system",
		Content: contextPrompt,
	}

	messages := append([]GroqMessage{systemMsg}, chatHistory...)

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Messages:    messages,
		Temperature: 0.6,
		MaxTokens:   4096,
		TopP:        0.9,
	}

	slog.Info("Chatting with AI", "model", groqReq.Model, "userID", userID, "sessionID", data.SessionID)

	replyContent, err := makeGroqCall(ctx, groqReq)
	if err != nil {
		slog.Error("Direct Groq call failed", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to contact AI service"})
	}

	slog.Info("Raw AI Chat Response Captured", "content_length", len(replyContent))

	// Implement Hidden Chain-of-Thought (Remove <think> ... </think> blocks cleanly)
	thinkRe := regexp.MustCompile("(?s)<think>.*?</think>\\n*")
	originalReply := replyContent
	replyContent = thinkRe.ReplaceAllString(replyContent, "")
	replyContent = strings.TrimSpace(replyContent)

	// Fallback Strategy: If after stripping thinking, we have nothing left, 
	// it means the AI only produced reasoning. We show a fallback UI or the reasoning.
	if replyContent == "" && originalReply != "" {
		slog.Warn("AI Chat response only contained thinking", "sessionID", sessionID)
		// Option A: Use the last part of the thinking as the answer
		// Option B: Show a friendly message
		replyContent = "I've analyzed your data, and here is my summary: \n\n" + originalReply
	}

	// Clean markdown backticks if any (sometimes AI wraps the whole output)
	re := regexp.MustCompile("(?s)^\\s*```(?:json|markdown)?\\n?(.*?)\\n?```\\s*$")
	if matches := re.FindStringSubmatch(replyContent); len(matches) > 1 {
		replyContent = strings.TrimSpace(matches[1])
	}

	if useSession {
		replyMsg := models.ChatMessage{
			Role:      "assistant",
			Content:   replyContent,
			Timestamp: time.Now(),
		}

		_, err := db.ChatSessionsCollection.UpdateOne(ctx,
			bson.M{"_id": sessionID},
			bson.M{
				"$push": bson.M{"messages": replyMsg},
				"$set":  bson.M{"updatedAt": time.Now()},
			},
		)
		if err != nil {
			slog.Error("Failed to update chat session with assistant message", "error", err, "sessionID", sessionID)
		}
	}

	// Return response as JSON
	return c.JSON(http.StatusOK, map[string]string{
		"response":  replyContent,
		"sessionId": sessionID.Hex(),
	})
}

func EstimateExerciseCalories(exerciseName string, durationMinutes int, user models.User) (float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	prompt := fmt.Sprintf("Estimate calories burned for this exercise: '%s' done for %d minutes. "+
		"User details: Age %d, Weight %.1fkg, Height %.1fcm, Sex %s. "+
		"Return ONLY a numeric value (JSON format: {\"calories\": 123.4}). No text, no explanation.",
		exerciseName, durationMinutes, user.Age, user.Weight, user.Height, user.Sex)

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Temperature: 0.1,
		MaxTokens:   1024,
		TopP:        0.9,
		Messages: []GroqMessage{
			{Role: "system", Content: "You are a precise physical activity and kinesiology expert. Return only JSON."},
			{Role: "user", Content: prompt},
		},
	}

	reply, err := makeGroqCall(ctx, groqReq)
	if err != nil {
		return 0, err
	}

	// Clean backticks if any
	reply = bytes.NewBufferString(reply).String()
	jsonStr := reply
	if bytes.Contains([]byte(reply), []byte("```")) {
		// Extract json part
		start := bytes.Index([]byte(reply), []byte("{"))
		end := bytes.LastIndex([]byte(reply), []byte("}"))
		if start != -1 && end != -1 && end > start {
			jsonStr = reply[start : end+1]
		}
	}

	var res struct {
		Calories float64 `json:"calories"`
	}
	if err := json.Unmarshal([]byte(jsonStr), &res); err != nil {
		// Fallback: try to find a float in the string
		var val float64
		_, err := fmt.Sscanf(jsonStr, "%f", &val)
		if err == nil {
			return val, nil
		}
		return 0, err
	}

	return res.Calories, nil
}
