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

// Handlers for Goals
func GetGoals(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var g models.Goals
	err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, g)
}

func UpdateGoals(c echo.Context) error {
	var updateData models.Goals
	if err := c.Bind(&updateData); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Assuming we only have one goal document, update the first one we find
	update := bson.M{
		"$set": bson.M{
			"calories":  updateData.Calories,
			"protein":   updateData.Protein,
			"carbs":     updateData.Carbs,
			"fat":       updateData.Fat,
			"sugar":     updateData.Sugar,
			"sodium":    updateData.Sodium,
			"fiber":     updateData.Fiber,
			"objective": updateData.Objective,
		},
	}

	userID := c.Get("userID").(primitive.ObjectID)
	var updatedDoc models.Goals
	err := db.GoalsCollection.FindOneAndUpdate(
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
