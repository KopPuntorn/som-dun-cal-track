package handlers

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

// ConsultAI provides nutritional advice based on today's totals
func ConsultAI(c echo.Context) error {
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
	var u models.User
	userStr := "Name: User, Age: 25, W: 70kg, H: 170cm, Sex: Other"
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
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

// ChatAI provides a general personal chat interface
func ChatAI(c echo.Context) error {
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
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
		goalsStr = fmt.Sprintf("Cal:%.0f, Pro:%.1f, Carb:%.1f, Fat:%.1f, Sugar:%.1f, Sodium:%.0f, Fiber:%.1f", g.Calories, g.Protein, g.Carbs, g.Fat, g.Sugar, g.Sodium, g.Fiber)
	}

	// 3. Fetch User Profile
	var u models.User
	userStr := "Not provided"
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
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
