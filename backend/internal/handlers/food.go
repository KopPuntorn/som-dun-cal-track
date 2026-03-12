package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetFoods gets foods for a user, filtered by date or range
func GetFoods(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")
	dateStr := c.QueryParam("date")

	filter := bson.M{"userId": userID}

	if startStr != "" && endStr != "" {
		startTime, errStart := time.Parse(time.RFC3339, startStr)
		endTime, errEnd := time.Parse(time.RFC3339, endStr)
		if errStart == nil && errEnd == nil {
			filter["date"] = bson.M{
				"$gte": startTime,
				"$lte": endTime,
			}
		}
	} else if dateStr != "" {
		parsedDate, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			// Find for the whole day in server's local time
			startOfDay := time.Date(parsedDate.Year(), parsedDate.Month(), parsedDate.Day(), 0, 0, 0, 0, time.Local)
			endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)
			filter["date"] = bson.M{
				"$gte": startOfDay,
				"$lte": endOfDay,
			}
		}
	}
	// If no params (start/end/date), no date filter is applied (returns history)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := db.FoodsCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var foods []models.Food
	if err := cursor.All(ctx, &foods); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if foods == nil {
		foods = []models.Food{}
	}

	return c.JSON(http.StatusOK, foods)
}

// SearchFoods searches foods by name
func SearchFoods(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	query := c.QueryParam("q")
	if query == "" {
		return c.JSON(http.StatusOK, []models.Food{})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use regex for partial/substring match (case-insensitive)
	filter := bson.M{
		"userId": userID,
		"name":   bson.M{"$regex": primitive.Regex{Pattern: query, Options: "i"}},
	}

	cursor, err := db.FoodsCollection.Find(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var foods []models.Food
	if err := cursor.All(ctx, &foods); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if foods == nil {
		foods = []models.Food{}
	}

	return c.JSON(http.StatusOK, foods)
}

// CreateFood creates a new food entry
func CreateFood(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	var food models.Food
	if err := c.Bind(&food); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	food.ID = primitive.NewObjectID()
	food.UserID = userID
	if food.Date.IsZero() {
		food.Date = time.Now()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := db.FoodsCollection.InsertOne(ctx, food)
	if err != nil {
		slog.Error("Failed to create food entry", "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, food)
}

// UpdateFood updates an existing food entry
func UpdateFood(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	foodIDStr := c.Param("id")
	foodID, err := primitive.ObjectIDFromHex(foodIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid food id"})
	}

	var food models.Food
	if err := c.Bind(&food); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": foodID, "userId": userID}
	update := bson.M{
		"$set": bson.M{
			"name":         food.Name,
			"calories":     food.Calories,
			"protein":      food.Protein,
			"carbs":        food.Carbs,
			"fat":          food.Fat,
			"sugar":        food.Sugar,
			"sodium":       food.Sodium,
			"fiber":        food.Fiber,
			"date":         food.Date,
			"mealCategory": food.MealCategory,
		},
	}

	result, err := db.FoodsCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.MatchedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "food entry not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "updated successfully"})
}

// DeleteFood deletes a food entry
func DeleteFood(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	foodIDStr := c.Param("id")
	foodID, err := primitive.ObjectIDFromHex(foodIDStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid food id"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": foodID, "userId": userID}
	result, err := db.FoodsCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "food entry not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
