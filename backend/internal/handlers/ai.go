package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"backend/internal/db"
	"backend/internal/models"
	"backend/internal/trends"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AI Related Models
type GroqChatRequest struct {
	Model            string        `json:"model"`
	Messages         []GroqMessage `json:"messages"`
	Temperature      float64       `json:"temperature,omitempty"`
	MaxTokens        int           `json:"max_tokens,omitempty"`
	TopP             float64       `json:"top_p,omitempty"`
	FrequencyPenalty float64       `json:"frequency_penalty,omitempty"`
	PresencePenalty  float64       `json:"presence_penalty,omitempty"`
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

func makeGroqCall(ctx context.Context, groqReq GroqChatRequest) (string, error) {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GROQ_API_KEY not configured")
	}

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

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("groq api error: %d - %s", resp.StatusCode, string(body))
	}

	var groqResp GroqChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return "", err
	}

	if len(groqResp.Choices) == 0 {
		return "", fmt.Errorf("no response from groq")
	}

	return groqResp.Choices[0].Message.Content, nil
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

	// Get language preference
	lang := c.FormValue("language")
	langName := "Thai (ภาษาไทย)"
	exampleName := "ข้าวกะเพราหมูสับไข่ดาว"
	langConstraint := "ใช้ภาษาไทยที่เป็นธรรมชาติ ถูกต้องตามหลักภาษา และเป็นชื่อที่คนไทยเรียกทั่วไป"
	if lang == "en" {
		langName = "English"
		exampleName = "Basil Fried Rice with Minced Pork and Fried Egg"
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

	// Prepare Groq Request
	groqReq := GroqChatRequest{
		Model:       "meta-llama/llama-4-scout-17b-16e-instruct",
		Temperature: 0.2,
		MaxTokens:   220,
		TopP:        0.9,
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: fmt.Sprintf("You are an elite, highly precise Culinary Nutritionist and Clinical Dietitian. Analyze the food in the image with extreme accuracy. "+
					"Estimate portion sizes visually and calculate nutritional values based on standard USDA data or equivalent authoritative sources. "+
					"Crucially, consider hidden calories from cooking oils, sauces, and sugars commonly used in such dishes. Be extremely realistic—Thai street food is often heavily oiled and sweetened. "+
					"Ensure that the macronutrients mathematically align with the total calories (Calories should roughly be at least (Protein * 4) + (Fat * 9)). "+
					"CRITICAL: Output MUST be valid JSON that can be parsed by JSON.parse. Use this exact schema and keys only: {name: string, calories: number, protein: number, fat: number}. "+
					"If multiple foods are visible, pick the primary dish name and estimate the combined macros for the plate. "+
					"LANGUAGE CONSTRAINT: %s "+
					"Respond ONLY with the JSON object. NO markdown, NO text before or after. Example: {\"name\": \"%s\", \"calories\": 450, \"protein\": 20, \"fat\": 15}", langName, langConstraint, exampleName),
			},
			{
				Role: "user",
				Content: []GroqContentPart{
					{
						Type: "text",
						Text: "Analyze this image and return the nutritional data in the requested JSON format.",
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

	slog.Info("Analyzing image with AI", "model", groqReq.Model, "language", langName, "mimeType", mimeType)
	return callGroq(c, groqReq)
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

	prompt := fmt.Sprintf("Act as an expert Clinical Dietitian. Suggest optimal daily nutritional goals for a %d-year-old %s weighing %.1f kg and %.1f cm tall with the health objective of '%s'. "+
		"Calculate precise Calories, Protein (g), and Fat (g). "+
		"CRITICAL: The response MUST be a pure raw JSON object with these exact keys: calories (number), protein (number), fat (number), explanation (string, max 50 words, in %s). "+
		"Ensure macronutrients logically match the calories: Calories ~= (P*4) + (F*9) + (C*4). Assuming moderate carbs. "+
		"Respond ONLY with the JSON object. NO markdown, NO text before or after.", data.Age, data.Sex, data.Weight, data.Height, data.Objective, langConstraint)

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Temperature: 0.2,
		MaxTokens:   250,
		TopP:        0.9,
		Messages: []GroqMessage{
			{
				Role:    "system",
				Content: prompt,
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

	// --- FETCH USER & TRENDS ---
	var u models.User
	db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	trendSummary, _ := trends.CalculateUserTrends(userID, 30)

	preferenceStr := ""
	if u.DietaryPreferences != "" || u.Allergies != "" || u.FoodDislikes != "" || u.TonePreference != "" {
		preferenceStr = fmt.Sprintf("Dietary preferences: %s; Allergies: %s; Dislikes: %s; Tone: %s", u.DietaryPreferences, u.Allergies, u.FoodDislikes, u.TonePreference)
	}

	// --- FETCH ALL RELEVANT DATA FOR THE RANGE ---

	// 1. Fetch Food Logs & Aggregates
	foodFilter := bson.M{"userId": userID, "date": bson.M{"$gte": startOfDay, "$lte": endOfRange}}
	fCursor, err := db.FoodsCollection.Find(ctx, foodFilter)
	var totalCal, totalPro, totalFat float64
	var foodItemsCount int
	if err == nil {
		var foods []models.Food
		if err := fCursor.All(ctx, &foods); err == nil {
			foodItemsCount = len(foods)
			for _, f := range foods {
				totalCal += f.Calories
				totalPro += models.SafeFloat(f.Protein)
				totalFat += models.SafeFloat(f.Fat)
			}
		}
	}

	avgCal := totalCal / float64(numDays)
	avgPro := totalPro / float64(numDays)
	avgFat := totalFat / float64(numDays)

	summaryStr := fmt.Sprintf("ช่วงเวลาที่วิเคราะห์: %s ถึง %s (%d วัน)\n", startStr, endStr, numDays)
	summaryStr += fmt.Sprintf("สถิติเฉลี่ยต่อวัน:\n- พลังงาน: %.0f kcal\n- โปรตีน: %.1fg\n- ไขมัน: %.1fg\n", avgCal, avgPro, avgFat)
	summaryStr += fmt.Sprintf("จำนวนรายการอาหารที่บันทึกทั้งหมด: %d รายการ\n", foodItemsCount)

	// 2. Fetch Weight Records in range
	var weightStr string
	wCursor, err := db.WeightCollection.Find(ctx, foodFilter, options.Find().SetSort(bson.D{{Key: "date", Value: 1}}))
	if err == nil {
		var weights []models.WeightRecord
		if err := wCursor.All(ctx, &weights); err == nil {
			for _, w := range weights {
				weightStr += fmt.Sprintf("%s: %.1fkg\n", w.Date.Format("2006-01-02"), w.Weight)
			}
		}
	}

	// 3. Fetch Exercise Records in range
	var exerciseStr string
	var totalExCal float64
	eCursor, err := db.ExerciseCollection.Find(ctx, foodFilter)
	if err == nil {
		var exercises []models.ExerciseRecord
		if err := eCursor.All(ctx, &exercises); err == nil {
			for _, ex := range exercises {
				exerciseStr += fmt.Sprintf("- %s: %d min (%.0f kcal)\n", ex.Name, ex.DurationMinutes, models.SafeFloat(ex.CaloriesBurned))
				totalExCal += models.SafeFloat(ex.CaloriesBurned)
			}
		}
	}

	// 4. Fetch Sleep Records in range
	var sleepStr string
	var totalSleep float64
	sCursor, err := db.SleepCollection.Find(ctx, foodFilter)
	if err == nil {
		var sleeps []models.SleepRecord
		if err := sCursor.All(ctx, &sleeps); err == nil {
			for _, sl := range sleeps {
				sleepStr += fmt.Sprintf("- %s: %.1fh (%s)\n", sl.Date.Format("2006-01-02"), sl.DurationHours, models.SafeString(sl.Quality))
				totalSleep += sl.DurationHours
			}
		}
	}

	// 5. Fetch Goals
	var g models.Goals
	goalsStr := "Not set"
	objectiveStr := "Not set"
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		objectiveStr = g.Objective
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Fat:%.1f", g.Calories, g.Protein, g.Fat)
	}

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Temperature: 0.3,
		MaxTokens:   900,
		TopP:        0.9,
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: "Persona: Elite Clinical Dietitian & Performance Consultant. " +
					langInstruction +
					"TASK: Perform a highly accurate, evidence-based Trend Analysis for the period " + startStr + " to " + endStr + ".\n\n" +
					"--- LONG-TERM CONTEXT ---\n" + u.LongTermContext + "\n\n" +
					"--- 30-DAY TREND DATA ---\n" + trendSummary + "\n\n" +
					"--- DATA SUMMARY FOR REQUESTED PERIOD ---\n" + summaryStr + "\n" +
					"User Profile: " + fmt.Sprintf("W:%.1fkg, H:%.1fcm, Age:%d", u.Weight, u.Height, u.Age) + "\n" +
					"User Preferences: " + preferenceStr + "\n" +
					"Daily Goals: " + goalsStr + "\n" +
					"Objective: " + objectiveStr + "\n\n" +
					"--- ACTIVITY LOGS IN THIS PERIOD ---\n" +
					"Weight Changes:\n" + weightStr + "\n" +
					"Exercises:\n" + exerciseStr + "Total Burned: " + fmt.Sprintf("%.0f", totalExCal) + " kcal\n\n" +
					"Sleep Patterns:\n" + sleepStr + "\n" +
					"CRITICAL INSTRUCTIONS:\n" +
					"1. Analyze consistency: Accurately compare their average daily intake with their goals using precise math. Are they consistent or fluctuating?\n" +
					"2. Connect weight changes scientifically with their nutrition, energy balance, and exercise logs for this specific period.\n" +
					"3. Provide deep, evidence-based insights into how this week's trends impact their " + objectiveStr + " goal.\n" +
					"4. Give 3 'Level-Up' recommendations for the upcoming week based on this analysis. Ensure nutritional advice is 100% accurate, fact-checked, and scientifically sound (e.g. clearly distinguish cardio from muscle-building).\n" +
					"Format: \n- Snapshot (1-2 sentences)\n- Key Insights (3 bullets)\n- Level-Up Plan (3 bullets)\n" +
					"Keep response CONCISE (max 350 words). Tone: Expert, motivating, and polished. No generic AI fluff.",
			},
			{
				Role:    "user",
				Content: "ช่วยวิเคราะห์แนวโน้มสุขภาพของผมในช่วงวันที่ " + startStr + " ถึง " + endStr + " อย่างละเอียดหน่อยครับ",
			},
		},
	}

	slog.Info("Consulting AI (Range Analysis)", "model", groqReq.Model, "userID", userID, "range", startStr+" to "+endStr)
	return callGroq(c, groqReq)
}

func callGroq(c echo.Context, groqReq GroqChatRequest) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	jsonData, _ := json.Marshal(groqReq)

	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
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

	var groqResp GroqChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to parse AI response"})
	}

	if len(groqResp.Choices) == 0 {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "empty AI response"})
	}

	return c.String(http.StatusOK, groqResp.Choices[0].Message.Content)
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
	todayCursor, _ := db.FoodsCollection.Find(ctx, bson.M{
		"userId": userID,
		"date":   bson.M{"$gte": startOfToday},
	}, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
	var todayFoodStr string
	var todayFoods []models.Food
	if err := todayCursor.All(ctx, &todayFoods); err == nil {
		for _, f := range todayFoods {
			todayFoodStr += fmt.Sprintf("- %s: %.0f kcal, P:%.1fg, F:%.1fg (%s)\n",
				f.Name, f.Calories, models.SafeFloat(f.Protein), models.SafeFloat(f.Fat), f.MealCategory)
		}
	}
	if todayFoodStr == "" {
		todayFoodStr = "No foods recorded today yet."
	}

	// 2. Fetch Recent History (Last 15, excluding today if many)
	histOpts := options.Find().SetLimit(15).SetSort(bson.D{{Key: "date", Value: -1}})
	histCursor, _ := db.FoodsCollection.Find(ctx, bson.M{
		"userId": userID,
		"date":   bson.M{"$lt": startOfToday},
	}, histOpts)
	var historyStr string
	var historyFoods []models.Food
	if err := histCursor.All(ctx, &historyFoods); err == nil {
		for _, f := range historyFoods {
			historyStr += fmt.Sprintf("- %s: %.0f kcal, P:%.1fg, F:%.1fg (%s, %s)\n",
				f.Name, f.Calories, models.SafeFloat(f.Protein), models.SafeFloat(f.Fat), f.MealCategory, f.Date.Format("2006-01-02"))
		}
	}

	// 2. Fetch Weight History (Last 5)
	var weightStr string
	wCursor, err := db.WeightCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
	if err == nil {
		var weights []models.WeightRecord
		if err := wCursor.All(ctx, &weights); err == nil {
			for _, w := range weights {
				weightStr += fmt.Sprintf("%s: %.1fkg\n", w.Date.Format("2006-01-02"), w.Weight)
			}
		}
	}

	// 3. Fetch Exercise History (Last 5)
	var exerciseStr string
	eCursor, err := db.ExerciseCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
	if err == nil {
		var exercises []models.ExerciseRecord
		if err := eCursor.All(ctx, &exercises); err == nil {
			for _, ex := range exercises {
				exerciseStr += fmt.Sprintf("- %s (%d min, %.0f kcal burned, %s)\n", ex.Name, ex.DurationMinutes, models.SafeFloat(ex.CaloriesBurned), ex.Date.Format("2006-01-02"))
			}
		}
	}

	// 4. Fetch Sleep History (Last 5)
	var sleepStr string
	sCursor, err := db.SleepCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
	if err == nil {
		var sleeps []models.SleepRecord
		if err := sCursor.All(ctx, &sleeps); err == nil {
			for _, sl := range sleeps {
				sleepStr += fmt.Sprintf("- %s: %.1f hrs (%s)\n", sl.Date.Format("2006-01-02"), sl.DurationHours, models.SafeString(sl.Quality))
			}
		}
	}

	// 5. Fetch Water Intake (Last 5 days)
	var waterStr string
	watCursor, err := db.WaterCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(5).SetSort(bson.D{{Key: "date", Value: -1}}))
	if err == nil {
		var waters []models.WaterIntake
		if err := watCursor.All(ctx, &waters); err == nil {
			for _, wat := range waters {
				waterStr += fmt.Sprintf("- %s: %d glasses\n", wat.Date, wat.Glasses)
			}
		}
	}

	// 6. Fetch Body Measurements (Last 3)
	var measurementStr string
	mCursor, err := db.BodyMeasurementCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetLimit(3).SetSort(bson.D{{Key: "date", Value: -1}}))
	if err == nil {
		var measurements []models.BodyMeasurement
		if err := mCursor.All(ctx, &measurements); err == nil {
			for _, m := range measurements {
				measurementStr += fmt.Sprintf("- %s: Waist: %.1fcm, Body Fat: %.1f%%\n", m.Date.Format("2006-01-02"), m.WaistCircumference, m.BodyFatPercentage)
			}
		}
	}

	// 7. Fetch Goals
	var g models.Goals
	goalsStr := "Not set"
	objectiveStr := "Not set"
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Fat:%.1f", g.Calories, g.Protein, g.Fat)
		if g.Objective != "" {
			objectiveStr = g.Objective
		}
	}

	// 8. Fetch User Profile & Trends
	var u models.User
	userStr := "Not provided"
	preferenceStr := "Not provided"
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
		userStr = fmt.Sprintf("Name: %s, Age: %d, Current W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
		if u.DietaryPreferences != "" || u.Allergies != "" || u.FoodDislikes != "" || u.TonePreference != "" {
			preferenceStr = fmt.Sprintf("Dietary preferences: %s; Allergies: %s; Dislikes: %s; Tone: %s", u.DietaryPreferences, u.Allergies, u.FoodDislikes, u.TonePreference)
		}
	}
	trendSummary, _ := trends.CalculateUserTrends(userID, 30)

	contextPrompt := "Persona: Elite Clinical Dietitian & Health Consultant. " +
		langInstruction +
		"\n\n--- CURRENT DATE/TIME ---\n" + now.Format("Monday, 2006-01-02 15:04 MST") + "\n\n" +
		"--- LONG-TERM CONTEXT ---\n" + u.LongTermContext + "\n\n" +
		"--- 30-DAY TREND DATA ---\n" + trendSummary + "\n\n" +
		"CRITICAL NUTRITION ACCURACY RULES: \n" +
		"- DO NOT hallucinate health benefits. If a food is unhealthy, fatty (e.g., pork neck / คอหมูย่าง, fried foods), or sugary, state facts firmly. DO NOT call high-fat foods 'balanced fat'.\n" +
		"- Know sports science: Cardio (running/cycling) builds endurance and burns calories, but DOES NOT build muscle. Resistance training builds muscle.\n" +
		"- Ensure all calorie and macronutrient calculations naturally align with physics (e.g., 1g protein=4kcal, 1g fat=9kcal).\n" +
		"CRITICAL MATH RULE: Total calories MUST logically support the sum of macros: Calories should be at least (Protein * 4) + (Fat * 9). " +
		"Use the provided user data deeply to personalize every response. " +
		"While health is your expertise, you are intelligent enough to discuss any topic with a consistent, premium persona.\n\n" +
		"--- USER DATA ---\n" +
		"Profile: " + userStr + "\nPreferences: " + preferenceStr + "\nGoals: " + goalsStr + "\nObjective: " + objectiveStr + "\n" +
		"\n--- TODAY'S MEALS ---\n" + todayFoodStr + "\n" +
		"\n--- RECENT FOOD HISTORY ---\n" + historyStr + "\n" +
		"Weight Trend: " + weightStr + "\nExercise: " + exerciseStr + "\nSleep: " + sleepStr + "\nWater: " + waterStr + "\nMeasurements: " + measurementStr + "\n\n" +
		"CRITICAL INSTRUCTIONS:\n" +
		"1. Connect the dots logically (e.g., accurately assess if their meal matches their exercise).\n" +
		"2. Provide precise and highly accurate nutritional breakdowns. Always verify that your macronutrient suggestions logically match the suggested calories based on the formula: Calories >= (P*4)+(F*9).\n" +
		fmt.Sprintf("3. If you recommend or they mention a food, append a special tag at the VERY END: `[ADD: %s | 100 | 10 | 2]` (Format: [ADD: Name | Calories | Protein | Fat])\n", foodExampleName) +
		"4. Ensure macronutrients STRICTLY sum up realistically, and the name is in " + foodNameLang + " language.\n" +
		"5. Use Markdown, emojis, and clear spacing. " +
		"6. Maintain a polite, highly expert, and encouraging tone. " +
		"7. Keep responses CONCISE and high-impact. Avoid extremely long tables or repetitive summaries unless specifically asked for a deep dive. Focus on quality over quantity. " +
		"8. STRICT LANGUAGE LOCKDOWN: Use ONLY Thai and Latin (English) characters. ABSOLUTELY NO Chinese (e.g., 营养), Cyrillic (e.g., คาลอรี่), Japanese, or other foreign scripts. If you output 'Nutrition', it must be 'โภชนาการ'. If you output 'Calories', it must be 'แคลอรี่' or 'kcal' in Latin characters. Failure to stick to Thai/English characters will result in failure of the task."

	systemMsg := GroqMessage{
		Role:    "system",
		Content: contextPrompt,
	}

	messages := append([]GroqMessage{systemMsg}, chatHistory...)

	groqReq := GroqChatRequest{
		Model:       "openai/gpt-oss-120b",
		Messages:    messages,
		Temperature: 0.6,
		MaxTokens:   900,
		TopP:        0.9,
	}

	slog.Info("Chatting with AI", "model", groqReq.Model, "userID", userID, "sessionID", data.SessionID)

	// Call Groq and handle response
	apiKey = os.Getenv("GROQ_API_KEY")
	jsonData, _ := json.Marshal(groqReq)
	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to contact AI service"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return c.JSON(resp.StatusCode, map[string]string{"error": string(body)})
	}

	var groqResp GroqChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to parse AI response"})
	}

	if len(groqResp.Choices) == 0 {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "empty AI response"})
	}

	replyContent := groqResp.Choices[0].Message.Content

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
		MaxTokens:   120,
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
