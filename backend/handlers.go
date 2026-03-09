package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Handlers for Foods
func getFoods(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{}

	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")

	dateFilter := bson.M{}
	if startStr != "" {
		if start, err := time.Parse(time.RFC3339, startStr); err == nil {
			dateFilter["$gte"] = start
		}
	}
	if endStr != "" {
		// If an end date is provided, we likely want the whole day inclusive,
		// but parsing RFC3339 gives us exact times. The frontend will pass exact bounds.
		if end, err := time.Parse(time.RFC3339, endStr); err == nil {
			dateFilter["$lte"] = end
		}
	}

	if len(dateFilter) > 0 {
		filter["date"] = dateFilter
	}

	filter["userId"] = c.Get("userID").(primitive.ObjectID)

	// Sort by descending _id
	opts := options.Find().SetSort(bson.D{{Key: "_id", Value: -1}})
	cursor, err := foodsCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var foods []Food
	if err := cursor.All(ctx, &foods); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if foods == nil {
		foods = []Food{}
	}

	return c.JSON(http.StatusOK, foods)
}

func createFood(c echo.Context) error {
	var f Food
	if err := c.Bind(&f); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	f.UserID = c.Get("userID").(primitive.ObjectID)
	f.Date = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := foodsCollection.InsertOne(ctx, f)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Assign the generated ObjectID back to the struct
	f.ID = result.InsertedID.(primitive.ObjectID)

	return c.JSON(http.StatusCreated, f)
}

func deleteFood(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{
		"_id":    objID,
		"userId": c.Get("userID").(primitive.ObjectID),
	}
	result, err := foodsCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "food not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// Handlers for Goals
func getGoals(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var g Goals
	err := goalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, g)
}

func updateGoals(c echo.Context) error {
	var updateData Goals
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Assuming we only have one goal document, update the first one we find
	update := bson.M{
		"$set": bson.M{
			"calories": updateData.Calories,
			"protein":  updateData.Protein,
			"carbs":    updateData.Carbs,
			"fat":      updateData.Fat,
			"sugar":    updateData.Sugar,
			"sodium":   updateData.Sodium,
			"fiber":    updateData.Fiber,
		},
	}

	userID := c.Get("userID").(primitive.ObjectID)
	var updatedDoc Goals
	err := goalsCollection.FindOneAndUpdate(
		ctx,
		bson.M{"userId": userID},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updatedDoc)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, updatedDoc)
}

// Handlers for User Profile
func getUserProfile(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var u User
	err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User profile not found"})
	}

	return c.JSON(http.StatusOK, u)
}

func updateUserProfile(c echo.Context) error {
	var u User
	if err := c.Bind(&u); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"name":   u.Name,
			"age":    u.Age,
			"weight": u.Weight,
			"height": u.Height,
			"sex":    u.Sex,
		},
	}

	userID := c.Get("userID").(primitive.ObjectID)
	var updatedUser User
	err := userCollection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": userID},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updatedUser)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, updatedUser)
}

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

// analyzeImage analyzes food from an uploaded image
func analyzeImage(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	file, err := c.FormFile("image")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "image file is required"})
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
		Model: "meta-llama/llama-4-scout-17b-16e-instruct",
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: "You are an expert nutritionist and food analyst. Analyze the food in the image and estimate the nutrition data. " +
					"The response MUST be a pure raw JSON object with these keys: name (string, MUST be in Thai language), calories (number), protein (number), carbs (number), fat (number), sugar (number), sodium (number), fiber (number). " +
					"Respond with ONLY the JSON object, NO markdown formatting, NO other text. Example: {\"name\": \"ข้าวกะเพราหมูสับ\", \"calories\": 450, \"protein\": 20, \"carbs\": 50, \"fat\": 15, \"sugar\": 5, \"sodium\": 800, \"fiber\": 2}",
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

	return callGroq(c, groqReq)
}

// consultAI provides nutritional advice based on today's totals
func consultAI(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	var data struct {
		Summary string `json:"summary"`
	}
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Fetch user info
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var u User
	userStr := "Name: User, Age: 25, W: 70kg, H: 170cm, Sex: Other"
	if err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
		userStr = fmt.Sprintf("Name: %s, Age: %d, W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
	}

	groqReq := GroqChatRequest{
		Model: "moonshotai/kimi-k2-instruct-0905",
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: "You are an expert, empathetic Thai nutritionist and personal trainer. " +
					"The user info is: " + userStr + ". " +
					"The user will provide a summary of their food intake today along with their goals. " +
					"Do not just repeat the numbers; provide deep, actionable insights. Explain what these macros mean for their body and goals. " +
					"Give them 2-3 specific recommendations for their next meal or tomorrow. " +
					"Use markdown formatting, bullet points, and emojis to make the response engaging. " +
					"Keep the tone natural, professional, encouraging, and friendly in Thai language.",
			},
			{
				Role:    "user",
				Content: data.Summary,
			},
		},
	}

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

// chatAI provides a general personal chat interface
func chatAI(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	var data struct {
		Messages []GroqMessage `json:"messages"`
	}
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// --- RAG: Fetch Context from DB ---
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)

	// 1. Fetch last 20 foods for context
	opts := options.Find().SetLimit(20).SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := foodsCollection.Find(ctx, bson.M{"userId": userID}, opts)
	var historyStr string
	if err == nil {
		var foods []Food
		if err := cursor.All(ctx, &foods); err == nil {
			for _, f := range foods {
				historyStr += f.Date.Format("2006-01-02") + ": " + f.Name + " (" +
					fmt.Sprintf("%.0f kcal, P:%.1fg, C:%.1fg, F:%.1fg, S:%.1fg, Na:%.0fmg, Fib:%.1fg", f.Calories, f.Protein, f.Carbs, f.Fat, f.Sugar, f.Sodium, f.Fiber) + ")\n"
			}
		}
	}

	// 2. Fetch Goals
	var g Goals
	goalsStr := "Not set"
	if err := goalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Carb:%.1f, Fat:%.1f, Sugar:%.1f, Sodium:%.0f, Fiber:%.1f", g.Calories, g.Protein, g.Carbs, g.Fat, g.Sugar, g.Sodium, g.Fiber)
	}

	// 3. Fetch User Profile
	var u User
	userStr := "Not provided"
	if err := userCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
		userStr = fmt.Sprintf("Name: %s, Age: %d, W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
	}

	contextPrompt := "You are an elite, highly intelligent health and nutrition assistant. You converse naturally in Thai.\n" +
		"You have access to the user's profile, daily goals, and recent 20 food logs. Use this context deeply to personalize your answers rather than giving generic advice.\n\n" +
		"User's Profile: " + userStr + "\n" +
		"User's Daily Goals: " + goalsStr + "\n" +
		"Recent Food History (Last 20 items):\n" + historyStr + "\n\n" +
		"CRITICAL INSTRUCTIONS:\n" +
		"1. Analyze their history and goals thoughtfully before answering.\n" +
		"2. If asked about nutritional info, always break down Calories, Protein, Carbs, Fat, Sugar, Sodium, and Fiber clearly step-by-step.\n" +
		"3. If you recommend a specific food or they tell you what they ate, YOU MUST append a JSON tag exactly like this at the very end of your response for EACH food item mentioned: `[FOOD_DATA: {\"name\": \"ชื่ออาหารภาษาไทย\", \"calories\": 100, \"protein\": 10.5, \"carbs\": 5, \"fat\": 2, \"sugar\": 0, \"sodium\": 200, \"fiber\": 1.5}]`\n" +
		"4. Ensure the JSON is valid and inside the brackets exactly as shown. These tags power a 'Quick Add' button in the UI.\n" +
		"5. Use markdown, emojis, and clear formatting (bullet points, bold text) to make your response easy to read and beautiful.\n" +
		"6. Keep a polite, encouraging, and highly expert tone in Thai."

	systemMsg := GroqMessage{
		Role:    "system",
		Content: contextPrompt,
	}

	messages := append([]GroqMessage{systemMsg}, data.Messages...)

	groqReq := GroqChatRequest{
		Model:    "llama-3.3-70b-versatile",
		Messages: messages,
	}

	return callGroq(c, groqReq)
}

// updateFood modifies an existing food entry
func updateFood(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	var updateData struct {
		Name         string  `json:"name"`
		Calories     float64 `json:"calories"`
		Protein      float64 `json:"protein"`
		Carbs        float64 `json:"carbs"`
		Fat          float64 `json:"fat"`
		Sugar        float64 `json:"sugar"`
		Sodium       float64 `json:"sodium"`
		Fiber        float64 `json:"fiber"`
		MealCategory string  `json:"mealCategory"`
	}
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"name":         updateData.Name,
			"calories":     updateData.Calories,
			"protein":      updateData.Protein,
			"carbs":        updateData.Carbs,
			"fat":          updateData.Fat,
			"sugar":        updateData.Sugar,
			"sodium":       updateData.Sodium,
			"fiber":        updateData.Fiber,
			"mealCategory": updateData.MealCategory,
		},
	}

	userID := c.Get("userID").(primitive.ObjectID)
	var updatedFood Food
	err = foodsCollection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": objID, "userId": userID},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updatedFood)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, updatedFood)
}

// Handlers for Water
func getWater(c echo.Context) error {
	dateStr := c.QueryParam("date")
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var w WaterIntake
	err := waterCollection.FindOne(ctx, bson.M{"date": dateStr, "userId": userID}).Decode(&w)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return c.JSON(http.StatusOK, WaterIntake{Date: dateStr, Glasses: 0})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, w)
}

func updateWater(c echo.Context) error {
	var req struct {
		Date    string `json:"date"`
		Glasses int    `json:"glasses"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.Date == "" {
		req.Date = time.Now().Format("2006-01-02")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	opts := options.Update().SetUpsert(true)
	filter := bson.M{"date": req.Date, "userId": userID}
	update := bson.M{"$set": bson.M{"glasses": req.Glasses}}

	_, err := waterCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "updated successfully"})
}

// Handlers for Weight
func getWeightHistory(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Default to last 30 days if no range provided
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")

	filter := bson.M{}
	dateFilter := bson.M{}

	if startStr != "" {
		if start, err := time.Parse(time.RFC3339, startStr); err == nil {
			dateFilter["$gte"] = start
		}
	} else {
		dateFilter["$gte"] = time.Now().AddDate(0, -1, 0) // Last 1 month
	}

	if endStr != "" {
		if end, err := time.Parse(time.RFC3339, endStr); err == nil {
			dateFilter["$lte"] = end
		}
	}

	if len(dateFilter) > 0 {
		filter["date"] = dateFilter
	}

	filter["userId"] = c.Get("userID").(primitive.ObjectID)

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}}) // Ascending
	cursor, err := weightCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var weights []WeightRecord
	if err := cursor.All(ctx, &weights); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if weights == nil {
		weights = []WeightRecord{}
	}

	return c.JSON(http.StatusOK, weights)
}

func addWeight(c echo.Context) error {
	var req struct {
		Weight float64 `json:"weight"`
		Date   string  `json:"date"` // optional
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	recordDate := time.Now()
	if req.Date != "" {
		parsed, err := time.Parse(time.RFC3339, req.Date)
		if err == nil {
			recordDate = parsed
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Upsert based on YYYY-MM-DD
	startOfDay := time.Date(recordDate.Year(), recordDate.Month(), recordDate.Day(), 0, 0, 0, 0, recordDate.Location())
	endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)

	userID := c.Get("userID").(primitive.ObjectID)

	filter := bson.M{
		"userId": userID,
		"date": bson.M{
			"$gte": startOfDay,
			"$lte": endOfDay,
		},
	}

	update := bson.M{
		"$set": bson.M{
			"date":   recordDate,
			"weight": req.Weight,
		},
	}

	opts := options.Update().SetUpsert(true)
	_, err := weightCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "logged successfully"})
}
