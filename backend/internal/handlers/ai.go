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

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AI Related Models
type GroqChatRequest struct {
	Model    string        `json:"model"`
	Messages []GroqMessage `json:"messages"`
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
		Model: "llama-3.2-11b-vision-preview",
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: fmt.Sprintf("You are a high-level Culinary Nutritionist. Analyze the food in the image with extreme precision. "+
					"CRITICAL: The response MUST be a pure raw JSON object with these exact keys: name (string, MUST be in %s), calories (number), protein (number), carbs (number), fat (number), sugar (number), sodium (number), fiber (number). "+
					"LANGUAGE CONSTRAINT: %s "+
					"Respond ONLY with the JSON object. NO markdown, NO text before or after. Example: {\"name\": \"%s\", \"calories\": 450, \"protein\": 20, \"carbs\": 50, \"fat\": 15, \"sugar\": 5, \"sodium\": 800, \"fiber\": 2}", langName, langConstraint, exampleName),
			},
			{
				Role: "user",
				Content: []GroqContentPart{
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

	slog.Info("Analyzing image with AI", "model", groqReq.Model, "language", langName)
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
	langInstruction := "คุณคือ 'ที่ปรึกษาด้านโภชนาการและการออกกำลังกายระดับพรีเมียม' สื่อสารด้วยภาษาไทยที่สมบูรณ์แบบ (Perfect Thai) เป็นธรรมชาติ นุ่มนวลแต่มีความเป็นมืออาชีพสูง " +
		"ห้ามใช้คำทับศัพท์ภาษาอังกฤษหากมีคำไทยที่เหมาะสม และห้ามมีภาษาอื่นปนเปื้อนเข้ามาในบทสนทนาเด็ดขาด "
	if data.Language == "en" {
		langInstruction = "You are a 'Premium Nutrition & Fitness Consultant'. Respond entirely in high-level, sophisticated English. Use a professional, encouraging, and natural tone. Do not use any slang or non-English phrases. "
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)

	// --- FETCH ALL RELEVANT DATA FOR THE RANGE ---

	// 1. Fetch Food Logs & Aggregates
	foodFilter := bson.M{"userId": userID, "date": bson.M{"$gte": startOfDay, "$lte": endOfRange}}
	fCursor, err := db.FoodsCollection.Find(ctx, foodFilter)
	var totalCal, totalPro, totalCarb, totalFat float64
	var foodItemsCount int
	if err == nil {
		var foods []models.Food
		if err := fCursor.All(ctx, &foods); err == nil {
			foodItemsCount = len(foods)
			for _, f := range foods {
				totalCal += f.Calories
				totalPro += f.Protein
				totalCarb += f.Carbs
				totalFat += f.Fat
			}
		}
	}

	avgCal := totalCal / float64(numDays)
	avgPro := totalPro / float64(numDays)
	avgCarb := totalCarb / float64(numDays)
	avgFat := totalFat / float64(numDays)

	summaryStr := fmt.Sprintf("ช่วงเวลาที่วิเคราะห์: %s ถึง %s (%d วัน)\n", startStr, endStr, numDays)
	summaryStr += fmt.Sprintf("สถิติเฉลี่ยต่อวัน:\n- พลังงาน: %.0f kcal\n- โปรตีน: %.1fg\n- คาร์โบไฮเดรต: %.1fg\n- ไขมัน: %.1fg\n", avgCal, avgPro, avgCarb, avgFat)
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
				exerciseStr += fmt.Sprintf("- %s: %d min (%.0f kcal)\n", ex.Name, ex.DurationMinutes, ex.CaloriesBurned)
				totalExCal += ex.CaloriesBurned
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
				sleepStr += fmt.Sprintf("%s: %.1f hrs (%s)\n", sl.Date.Format("2006-01-02"), sl.DurationHours, sl.Quality)
				totalSleep += sl.DurationHours
			}
		}
	}

	// 5. Fetch Goals & Profile
	var g models.Goals
	var u models.User
	goalsStr := "Not set"
	objectiveStr := "Not set"
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		objectiveStr = g.Objective
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Carb:%.1f, Fat:%.1f", g.Calories, g.Protein, g.Carbs, g.Fat)
	}
	db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)

	groqReq := GroqChatRequest{
		Model: "llama-3.3-70b-versatile",
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: "Persona: Premium Health & Performance Consultant. " +
					langInstruction +
					"TASK: Perform a Trend Analysis for the period " + startStr + " to " + endStr + ".\n\n" +
					"--- DATA SUMMARY ---\n" + summaryStr + "\n" +
					"User Profile: " + fmt.Sprintf("W:%.1fkg, H:%.1fcm, Age:%d", u.Weight, u.Height, u.Age) + "\n" +
					"Daily Goals: " + goalsStr + "\n" +
					"Objective: " + objectiveStr + "\n\n" +
					"--- ACTIVITY LOGS IN THIS PERIOD ---\n" +
					"Weight Changes:\n" + weightStr + "\n" +
					"Exercises:\n" + exerciseStr + "Total Burned: " + fmt.Sprintf("%.0f", totalExCal) + " kcal\n\n" +
					"Sleep Patterns:\n" + sleepStr + "\n" +
					"CRITICAL INSTRUCTIONS:\n" +
					"1. Analyze the consistency: Compare their average daily intake with their goals. Are they consistent or fluctuating?\n" +
					"2. Connect weight changes with their nutrition and exercise logs for this specific period.\n" +
					"3. Provide deep, professional insights into how this week's trends impact their " + objectiveStr + " goal.\n" +
					"4. Give 3 'Level-Up' recommendations for the upcoming week based on this analysis.\n" +
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
		return c.JSON(resp.StatusCode, map[string]string{"error": string(body)})
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
	langInstruction := "คุณคือ 'ที่ปรึกษาด้านสุขภาพระดับพรีเมียม' ที่มีความเชี่ยวชาญสูงสุด สื่อสารด้วยภาษาไทยที่สมบูรณ์แบบ (Perfect Thai) เป็นธรรมชาติ มีระดับ และน่าเชื่อถือ " +
		"ห้ามใช้คำทับศัพท์ภาษาอังกฤษโดยไม่จำเป็นเด็ดขาด และห้ามมีภาษาอื่นหลุดรอดเข้ามาในคำตอบ ยกเว้นกรณีที่ผู้ใช้ถามในหัวข้อที่ไม่เกี่ยวข้องกับสุขภาพ "
	foodNameLang := "Thai"
	foodExampleName := "ข้าวผัดกะเพราอกไก่ไข่ดาว"
	if data.Language == "en" {
		langInstruction = "You are a 'Premium Health Consultant'. Respond entirely in sophisticated, professional English. Use a natural, helpful, and expert tone. "
		foodNameLang = "English"
		foodExampleName = "Basil Chicken Stir-fry with Rice and Fried Egg"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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

	// If using session, we persist the latest user message first
	if useSession && len(data.Messages) > 0 {
		lastMsg := data.Messages[len(data.Messages)-1]
		if lastMsg.Role == "user" {
			newMsg := models.ChatMessage{
				Role:      "user",
				Content:   fmt.Sprintf("%v", lastMsg.Content),
				Timestamp: time.Now(),
			}

			// Update session with new user message
			db.ChatSessionsCollection.UpdateOne(ctx,
				bson.M{"_id": sessionID},
				bson.D{
					{Key: "$push", Value: bson.M{"messages": newMsg}},
					{Key: "$set", Value: bson.M{"updatedAt": time.Now()}},
				},
			)
			session.Messages = append(session.Messages, newMsg)
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
	// 1. Fetch last 20 foods for context
	opts := options.Find().SetLimit(20).SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := db.FoodsCollection.Find(ctx, bson.M{"userId": userID}, opts)
	var historyStr string
	if err == nil {
		var foods []models.Food
		if err := cursor.All(ctx, &foods); err == nil {
			for _, f := range foods {
				historyStr += f.Date.Format("2006-01-02") + ": " + f.Name + " (" +
					fmt.Sprintf("%.0f kcal, P:%.1fg, C:%.1fg, F:%.1fg, S:%.1fg, Na:%.0fmg, Fib:%.1fg", f.Calories, f.Protein, f.Carbs, f.Fat, f.Sugar, f.Sodium, f.Fiber) + ")\n"
			}
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
				exerciseStr += fmt.Sprintf("%s: %s (%d min, %.0f kcal burned)\n", ex.Date.Format("2006-01-02"), ex.Name, ex.DurationMinutes, ex.CaloriesBurned)
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
				sleepStr += fmt.Sprintf("%s: %.1f hrs (Quality: %s)\n", sl.Date.Format("2006-01-02"), sl.DurationHours, sl.Quality)
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
				waterStr += fmt.Sprintf("%s: %d glasses\n", wat.Date, wat.Glasses)
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
				measurementStr += fmt.Sprintf("%s: Waist: %.1fcm, Body Fat: %.1f%%\n", m.Date.Format("2006-01-02"), m.WaistCircumference, m.BodyFatPercentage)
			}
		}
	}

	// 7. Fetch Goals
	var g models.Goals
	goalsStr := "Not set"
	objectiveStr := "Not set"
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Carb:%.1f, Fat:%.1f, Sugar:%.1f, Sodium:%.0f, Fiber:%.1f", g.Calories, g.Protein, g.Carbs, g.Fat, g.Sugar, g.Sodium, g.Fiber)
		if g.Objective != "" {
			objectiveStr = g.Objective
		}
	}

	// 8. Fetch User Profile
	var u models.User
	userStr := "Not provided"
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
		userStr = fmt.Sprintf("Name: %s, Age: %d, Current W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
	}

	contextPrompt := "Persona: Elite AI Health Consultant. " +
		langInstruction +
		"Use the provided user data deeply to personalize every response. " +
		"While health is your expertise, you are intelligent enough to discuss any topic with a consistent, premium persona.\n\n" +
		"--- USER DATA ---\n" +
		"Profile: " + userStr + "\nGoals: " + goalsStr + "\nObjective: " + objectiveStr + "\n" +
		"Recent Food History: " + historyStr + "\n" +
		"Weight Trend: " + weightStr + "\nExercise: " + exerciseStr + "\nSleep: " + sleepStr + "\nWater: " + waterStr + "\nMeasurements: " + measurementStr + "\n\n" +
		"CRITICAL INSTRUCTIONS:\n" +
		"1. Connect the dots across all metrics (e.g., how exercise affects their goals today).\n" +
		"2. Provide nutritional breakdowns clearly when relevant.\n" +
		fmt.Sprintf("3. If you recommend or they mention a food, append a JSON tag at the VERY END: `[FOOD_DATA: {\"name\": \"%s\", \"calories\": 100, \"protein\": 10, \"carbs\": 5, \"fat\": 2, \"sugar\": 0, \"sodium\": 200, \"fiber\": 1.5}]`\n", foodExampleName) +
		fmt.Sprintf("4. Ensure JSON is valid and the name is in %s language.\n", foodNameLang) +
		"5. Use Markdown, emojis, and clear spacing. " +
		"6. Maintain a polite, highly expert, and encouraging tone. Strictly avoid non-Thai/non-English mixing depending on the selected language."

	systemMsg := GroqMessage{
		Role:    "system",
		Content: contextPrompt,
	}

	messages := append([]GroqMessage{systemMsg}, chatHistory...)

	groqReq := GroqChatRequest{
		Model:    "llama-3.3-70b-versatile",
		Messages: messages,
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

	// Persist assistant's reply if using session
	if useSession {
		replyMsg := models.ChatMessage{
			Role:      "assistant",
			Content:   replyContent,
			Timestamp: time.Now(),
		}

		update := bson.M{
			"$push": bson.M{"messages": replyMsg},
			"$set":  bson.M{"updatedAt": time.Now()},
		}

		// Auto-title if still using default title
		if session.Title == "New Chat" || session.Title == "New Conversation" || session.Title == "My Chat" {
			newTitle := replyContent
			if len(newTitle) > 40 {
				newTitle = newTitle[:37] + "..."
			}
			// Better: use user's first message as title if possible
			if len(session.Messages) > 0 {
				newTitle = session.Messages[0].Content
				if len(newTitle) > 40 {
					newTitle = newTitle[:37] + "..."
				}
			}
			update["$set"].(bson.M)["title"] = newTitle
		}

		db.ChatSessionsCollection.UpdateOne(ctx,
			bson.M{"_id": sessionID},
			update,
		)
	}

	return c.String(http.StatusOK, replyContent)
}
