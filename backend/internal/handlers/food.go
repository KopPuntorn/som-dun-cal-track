package handlers

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"
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

	// Sanitize regex: escape special characters
	escapedQuery := regexp.QuoteMeta(query)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Use regex for partial/substring match (case-insensitive)
	filter := bson.M{
		"userId": userID,
		"name":   bson.M{"$regex": primitive.Regex{Pattern: escapedQuery, Options: "i"}},
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

	// Add XP
	xpAmount := int(food.Calories / 10)
	if xpAmount > 0 {
		db.AddUserXP(userID, xpAmount)
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
	// Fetch current food to preserve date if missing
	var currentFood models.Food
	err = db.FoodsCollection.FindOne(ctx, filter).Decode(&currentFood)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "food entry not found"})
	}

	if food.Date.IsZero() {
		food.Date = currentFood.Date
	}

	update := bson.M{
		"$set": bson.M{
			"name":         food.Name,
			"calories":     food.Calories,
			"protein":      food.Protein,
			"fat":          food.Fat,
			"date":         food.Date,
			"mealCategory": food.MealCategory,
		},
	}

	_, err = db.FoodsCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Prepare updated object to return
	food.ID = foodID
	food.UserID = userID

	return c.JSON(http.StatusOK, food)
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
	// Fetch food first to know how much XP to subtract
	var food models.Food
	_ = db.FoodsCollection.FindOne(ctx, filter).Decode(&food)

	result, err := db.FoodsCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount > 0 {
		xpAmount := int(food.Calories / 10)
		if xpAmount > 0 {
			db.AddUserXP(userID, -xpAmount)
		}
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "food entry not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// GetProductByBarcode fetches product data from Open Food Facts API
func GetProductByBarcode(c echo.Context) error {
	barcode := c.Param("barcode")
	if barcode == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "barcode is required"})
	}

	url := "https://world.openfoodfacts.org/api/v0/product/" + barcode + ".json"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create request"})
	}

	// Set User-Agent as required by Open Food Facts
	req.Header.Set("User-Agent", "SomDun - Web - 1.0 - https://somdun.com")

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch from Open Food Facts"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(resp.StatusCode, map[string]string{"error": "Open Food Facts returned an error"})
	}

	var result interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to decode response"})
	}

	return c.JSON(http.StatusOK, result)
}
