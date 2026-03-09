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

// Handlers for Foods
func GetFoods(c echo.Context) error {
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

func CreateFood(c echo.Context) error {
	var f models.Food
	if err := c.Bind(&f); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	f.UserID = c.Get("userID").(primitive.ObjectID)
	f.Date = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.FoodsCollection.InsertOne(ctx, f)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Assign the generated ObjectID back to the struct
	f.ID = result.InsertedID.(primitive.ObjectID)

	return c.JSON(http.StatusCreated, f)
}

func DeleteFood(c echo.Context) error {
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
	result, err := db.FoodsCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "food not found"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

func UpdateFood(c echo.Context) error {
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
	var updatedFood models.Food
	err = db.FoodsCollection.FindOneAndUpdate(
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
