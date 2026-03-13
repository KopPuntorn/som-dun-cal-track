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

	slog.Info("Analyzing image with AI", "model", groqReq.Model)
	return callGroq(c, groqReq)
}

// ConsultAI provides nutritional advice based on today's totals
func ConsultAI(c echo.Context) error {
	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		slog.Error("ConsultAI failed: GROQ_API_KEY not configured")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "GROQ_API_KEY not configured"})
	}

	var data struct {
		Summary  string `json:"summary"`
		Language string `json:"language"`
	}
	if err := c.Bind(&data); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	// Determine language instruction
	langInstruction := "Your language must be 'Perfect Thai' (ภาษาไทยต้องเป๊ะ): professional, natural, smooth, and nuanced like a top-tier specialist. "
	if data.Language == "en" {
		langInstruction = "You MUST respond entirely in English. Use professional, natural, smooth, and nuanced language like a top-tier specialist. "
	}

	// Fetch user info
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var u models.User
	userStr := "Name: User, Age: 25, W: 70kg, H: 170cm, Sex: Other"
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
		userStr = fmt.Sprintf("Name: %s, Age: %d, W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
	}

	// Fetch user's health objective
	var g models.Goals
	objectiveStr := "Not set"
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil && g.Objective != "" {
		objectiveStr = g.Objective
	}

	groqReq := GroqChatRequest{
		Model: "openai/gpt-oss-120b",
		Messages: []GroqMessage{
			{
				Role: "system",
				Content: "You are a premium, high-level expert nutritionist and personal trainer. " +
					langInstruction +
					"The user info is: " + userStr + ". " +
					"The user's health objective is: " + objectiveStr + ". " +
					"The user will provide a summary of their food intake. " +
					"IMPORTANT: Tailor all advice and recommendations specifically to the user's health objective. " +
					"If the number of days with data is small relative to the range, acknowledge that data might be incomplete rather than assuming they are starving. " +
					"Do not just repeat numbers; provide deep, actionable insights. Explain what these macros mean for their body and goals. " +
					"Give them 2-3 specific recommendations for their next meal or tomorrow. " +
					"CRITICAL: Keep your response CONCISE and SHORT (max 200 words). Use brief bullet points, avoid long tables or full meal plans. Be punchy and direct. " +
					"Use markdown, bullet points, and emojis to make the response visually engaging. " +
					"Keep the tone natural, professional, encouraging, and friendly. Avoid robotic phrasing.",
			},
			{
				Role:    "user",
				Content: data.Summary,
			},
		},
	}

	slog.Info("Consulting AI", "model", groqReq.Model, "userID", userID)
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
	langInstruction := "Your language must be 'Perfect Thai' (ภาษาไทยต้องเป๊ะ): professional, natural, smooth, and highly expert, like a premium consultant. "
	if data.Language == "en" {
		langInstruction = "You MUST respond entirely in English. Use professional, natural, smooth, and highly expert language, like a premium consultant. "
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

	// 2. Fetch Goals
	var g models.Goals
	goalsStr := "Not set"
	objectiveStr := "Not set"
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Carb:%.1f, Fat:%.1f, Sugar:%.1f, Sodium:%.0f, Fiber:%.1f", g.Calories, g.Protein, g.Carbs, g.Fat, g.Sugar, g.Sodium, g.Fiber)
		if g.Objective != "" {
			objectiveStr = g.Objective
		}
	}

	// 3. Fetch User Profile
	var u models.User
	userStr := "Not provided"
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
		userStr = fmt.Sprintf("Name: %s, Age: %d, W: %.1fkg, H: %.1fcm, Sex: %s", u.Name, u.Age, u.Weight, u.Height, u.Sex)
	}

	contextPrompt := "You are an elite, highly intelligent health and nutrition assistant. " +
		langInstruction +
		"You have access to the user's profile, daily goals, and recent 20 food logs. Use this context deeply to personalize your answers. " +
		"While you are an expert in health, you can also discuss ANY other general topics the user brings up, maintaining a consistent, intelligent, and helpful persona.\n\n" +
		"User's Profile: " + userStr + "\n" +
		"User's Daily Goals: " + goalsStr + "\n" +
		"User's Health Objective: " + objectiveStr + "\n" +
		"Recent Food History (Last 20 items):\n" + historyStr + "\n\n" +
		"CRITICAL INSTRUCTIONS:\n" +
		"0. Tailor ALL relevant advice to the user's health objective. If the conversation is about general topics, you don't need to force nutrition advice unless relevant.\n" +
		"1. Analyze history and goals thoughtfully.\n" +
		"2. For nutritional info, break down Calories, Protein, Carbs, Fat, Sugar, Sodium, and Fiber clearly.\n" +
		"3. If you recommend or they mention a food, YOU MUST append a JSON tag at the VERY END for EACH item: `[FOOD_DATA: {\"name\": \"ชื่ออาหารไทย\", \"calories\": 100, \"protein\": 10, \"carbs\": 5, \"fat\": 2, \"sugar\": 0, \"sodium\": 200, \"fiber\": 1.5}]`\n" +
		"4. Ensure JSON is valid and inside brackets.\n" +
		"5. Use markdown, emojis, and clear formatting (bold, bullet points).\n" +
		"6. Keep a polite, encouraging, and highly expert tone. DO NOT use any specific name for yourself (like 'P'Peak'); just be a helpful expert assistant."

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
