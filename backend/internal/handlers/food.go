package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func normalizeFoodName(name string) string {
	return strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(name))), " ")
}

func cleanFoodDisplayName(name string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(name)), " ")
}

func prepareFoodForStorage(food *models.Food) {
	food.Name = cleanFoodDisplayName(food.Name)
	food.NormalizedName = normalizeFoodName(food.Name)
}

func foodHistoryKey(food models.Food) string {
	normalizedName := food.NormalizedName
	if normalizedName == "" {
		normalizedName = normalizeFoodName(food.Name)
	}
	return fmt.Sprintf(
		"%s|%.1f|%.1f|%.1f|%.1f|%.1f|%.1f|%.1f",
		normalizedName,
		food.Calories,
		models.SafeFloat(food.Protein),
		models.SafeFloat(food.Carbs),
		models.SafeFloat(food.Fat),
		models.SafeFloat(food.Sugar),
		models.SafeFloat(food.Sodium),
		models.SafeFloat(food.Fiber),
	)
}

func buildFoodTemplateFromFood(food models.Food, useCount int, lastUsedAt time.Time) models.FoodTemplate {
	now := time.Now()
	if food.NormalizedName == "" {
		food.NormalizedName = normalizeFoodName(food.Name)
	}

	return models.FoodTemplate{
		ID:             primitive.NewObjectID(),
		UserID:         food.UserID,
		Name:           cleanFoodDisplayName(food.Name),
		NormalizedName: food.NormalizedName,
		TemplateKey:    foodHistoryKey(food),
		Calories:       food.Calories,
		Protein:        food.Protein,
		Carbs:          food.Carbs,
		Fat:            food.Fat,
		Sugar:          food.Sugar,
		Sodium:         food.Sodium,
		Fiber:          food.Fiber,
		UseCount:       useCount,
		LastUsedAt:     lastUsedAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func saveFoodTemplate(ctx context.Context, template models.FoodTemplate) error {
	filter := bson.M{
		"userId":      template.UserID,
		"templateKey": template.TemplateKey,
	}

	update := bson.M{
		"$set": bson.M{
			"name":           template.Name,
			"normalizedName": template.NormalizedName,
			"templateKey":    template.TemplateKey,
			"calories":       template.Calories,
			"protein":        template.Protein,
			"carbs":          template.Carbs,
			"fat":            template.Fat,
			"sugar":          template.Sugar,
			"sodium":         template.Sodium,
			"fiber":          template.Fiber,
			"useCount":       template.UseCount,
			"lastUsedAt":     template.LastUsedAt,
			"updatedAt":      time.Now(),
		},
		"$setOnInsert": bson.M{
			"_id":       template.ID,
			"userId":    template.UserID,
			"createdAt": template.CreatedAt,
		},
	}

	_, err := db.FoodTemplatesCollection.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	return err
}

func rebuildFoodTemplate(ctx context.Context, userID primitive.ObjectID, templateKey string) error {
	cursor, err := db.FoodsCollection.Find(
		ctx,
		bson.M{"userId": userID},
		options.Find().SetSort(bson.D{{Key: "date", Value: -1}}),
	)
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	var latest *models.Food
	useCount := 0
	var lastUsedAt time.Time

	for cursor.Next(ctx) {
		var food models.Food
		if err := cursor.Decode(&food); err != nil {
			return err
		}
		prepareFoodForStorage(&food)
		if foodHistoryKey(food) != templateKey {
			continue
		}

		if latest == nil {
			clone := food
			latest = &clone
			lastUsedAt = food.Date
		}
		useCount++
	}

	if err := cursor.Err(); err != nil {
		return err
	}

	filter := bson.M{"userId": userID, "templateKey": templateKey}
	if latest == nil {
		_, err := db.FoodTemplatesCollection.DeleteOne(ctx, filter)
		return err
	}

	template := buildFoodTemplateFromFood(*latest, useCount, lastUsedAt)
	template.UserID = userID
	template.TemplateKey = templateKey
	return saveFoodTemplate(ctx, template)
}

func ensureFoodTemplates(ctx context.Context, userID primitive.ObjectID) error {
	count, err := db.FoodTemplatesCollection.CountDocuments(ctx, bson.M{"userId": userID})
	if err != nil || count > 0 {
		return err
	}

	cursor, err := db.FoodsCollection.Find(
		ctx,
		bson.M{"userId": userID},
		options.Find().SetSort(bson.D{{Key: "date", Value: -1}}),
	)
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

	type templateAccumulator struct {
		food       models.Food
		useCount   int
		lastUsedAt time.Time
	}

	templates := make(map[string]*templateAccumulator)
	for cursor.Next(ctx) {
		var food models.Food
		if err := cursor.Decode(&food); err != nil {
			return err
		}
		prepareFoodForStorage(&food)
		key := foodHistoryKey(food)
		acc, exists := templates[key]
		if !exists {
			templates[key] = &templateAccumulator{
				food:       food,
				useCount:   1,
				lastUsedAt: food.Date,
			}
			continue
		}
		acc.useCount++
	}

	if err := cursor.Err(); err != nil {
		return err
	}

	for key, acc := range templates {
		template := buildFoodTemplateFromFood(acc.food, acc.useCount, acc.lastUsedAt)
		template.TemplateKey = key
		if err := saveFoodTemplate(ctx, template); err != nil {
			return err
		}
	}

	return nil
}

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
		return c.JSON(http.StatusOK, []models.FoodTemplate{})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := ensureFoodTemplates(ctx, userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	escapedQuery := regexp.QuoteMeta(normalizeFoodName(query))
	filter := bson.M{
		"userId":         userID,
		"normalizedName": bson.M{"$regex": primitive.Regex{Pattern: escapedQuery, Options: "i"}},
	}

	findOpts := options.Find().
		SetSort(bson.D{{Key: "useCount", Value: -1}, {Key: "lastUsedAt", Value: -1}}).
		SetLimit(10)

	cursor, err := db.FoodTemplatesCollection.Find(ctx, filter, findOpts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var templates []models.FoodTemplate
	if err := cursor.All(ctx, &templates); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if templates == nil {
		templates = []models.FoodTemplate{}
	}

	return c.JSON(http.StatusOK, templates)
}

// CreateFood creates a new food entry
func CreateFood(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	var food models.Food
	if err := c.Bind(&food); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	prepareFoodForStorage(&food)
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

	if err := rebuildFoodTemplate(ctx, userID, foodHistoryKey(food)); err != nil {
		slog.Warn("Failed to sync food template after create", "error", err, "userID", userID.Hex())
	}

	// Add XP
	xpAmount := int(food.Calories / 10)
	if xpAmount > 0 {
		db.AddUserXP(userID, xpAmount)
	}

	// Update streak
	db.UpdateUserStreak(userID)

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

	prepareFoodForStorage(&food)

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
			"name":           food.Name,
			"normalizedName": food.NormalizedName,
			"calories":       food.Calories,
			"protein":        food.Protein,
			"carbs":          food.Carbs,
			"fat":            food.Fat,
			"sugar":          food.Sugar,
			"sodium":         food.Sodium,
			"fiber":          food.Fiber,
			"date":           food.Date,
			"mealCategory":   food.MealCategory,
		},
	}

	_, err = db.FoodsCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	prepareFoodForStorage(&currentFood)
	oldTemplateKey := foodHistoryKey(currentFood)
	newTemplateKey := foodHistoryKey(food)
	if err := rebuildFoodTemplate(ctx, userID, oldTemplateKey); err != nil {
		slog.Warn("Failed to sync previous food template after update", "error", err, "userID", userID.Hex())
	}
	if newTemplateKey != oldTemplateKey {
		if err := rebuildFoodTemplate(ctx, userID, newTemplateKey); err != nil {
			slog.Warn("Failed to sync new food template after update", "error", err, "userID", userID.Hex())
		}
	}

	prevXP := int(currentFood.Calories / 10)
	newXP := int(food.Calories / 10)
	if diff := newXP - prevXP; diff != 0 {
		_ = db.AddUserXP(userID, diff)
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
		prepareFoodForStorage(&food)
		if err := rebuildFoodTemplate(ctx, userID, foodHistoryKey(food)); err != nil {
			slog.Warn("Failed to sync food template after delete", "error", err, "userID", userID.Hex())
		}
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
