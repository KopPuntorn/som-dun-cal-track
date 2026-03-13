package handlers

import (
	"context"
	"net/http"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// CreateChatSession initializes a new chat session
func CreateChatSession(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)

	var req struct {
		Title string `json:"title"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.Title == "" {
		req.Title = "New Chat"
	}

	session := models.ChatSession{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Title:     req.Title,
		Messages:  []models.ChatMessage{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.ChatSessionsCollection.InsertOne(ctx, session)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create chat session"})
	}

	return c.JSON(http.StatusCreated, session)
}

// ListChatSessions returns all chat sessions for the authenticated user
func ListChatSessions(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}})
	cursor, err := db.ChatSessionsCollection.Find(ctx, bson.M{"userId": userID}, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch chat sessions"})
	}
	defer cursor.Close(ctx)

	var sessions []models.ChatSession
	if err := cursor.All(ctx, &sessions); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to decode chat sessions"})
	}

	if sessions == nil {
		sessions = []models.ChatSession{}
	}

	return c.JSON(http.StatusOK, sessions)
}

// GetChatSession returns a specific chat session by ID
func GetChatSession(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	sessionID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid session id"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var session models.ChatSession
	err = db.ChatSessionsCollection.FindOne(ctx, bson.M{"_id": sessionID, "userId": userID}).Decode(&session)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "chat session not found"})
	}

	return c.JSON(http.StatusOK, session)
}

// DeleteChatSession removes a chat session
func DeleteChatSession(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	sessionID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid session id"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.ChatSessionsCollection.DeleteOne(ctx, bson.M{"_id": sessionID, "userId": userID})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete chat session"})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "chat session not found"})
	}

	return c.NoContent(http.StatusNoContent)
}
