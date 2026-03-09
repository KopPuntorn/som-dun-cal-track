package main

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// --- Exercise Handlers ---

func getExerciseHistory(c echo.Context) error {
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

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := exerciseCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var records []ExerciseRecord
	if err := cursor.All(ctx, &records); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if records == nil {
		records = []ExerciseRecord{}
	}

	return c.JSON(http.StatusOK, records)
}

func addExercise(c echo.Context) error {
	var record ExerciseRecord
	if err := c.Bind(&record); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if record.Date.IsZero() {
		record.Date = time.Now()
	}
	record.UserID = c.Get("userID").(primitive.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := exerciseCollection.InsertOne(ctx, record)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	record.ID = result.InsertedID.(primitive.ObjectID)
	return c.JSON(http.StatusCreated, record)
}

func deleteExercise(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "userId": c.Get("userID").(primitive.ObjectID)}
	result, err := exerciseCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// --- Sleep Handlers ---

func getSleepHistory(c echo.Context) error {
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

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	cursor, err := sleepCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var records []SleepRecord
	if err := cursor.All(ctx, &records); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if records == nil {
		records = []SleepRecord{}
	}

	return c.JSON(http.StatusOK, records)
}

func addSleep(c echo.Context) error {
	var record SleepRecord
	if err := c.Bind(&record); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if record.Date.IsZero() {
		record.Date = time.Now()
	}
	record.UserID = c.Get("userID").(primitive.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Optionally upsert by Date to only allow one sleep record per day,
	// but inserting allows multiple naps. We'll stick to insert for simplicity.
	result, err := sleepCollection.InsertOne(ctx, record)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	record.ID = result.InsertedID.(primitive.ObjectID)
	return c.JSON(http.StatusCreated, record)
}

func deleteSleep(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "userId": c.Get("userID").(primitive.ObjectID)}
	result, err := sleepCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// --- Export Handler ---

func exportData(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// We'll export Foods for now. Can be expanded to zip multiple CSVs.
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	userID := c.Get("userID").(primitive.ObjectID)
	cursor, err := foodsCollection.Find(ctx, bson.M{"userId": userID}, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var foods []Food
	if err := cursor.All(ctx, &foods); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment;filename=calorie_tracker_export.csv")

	writer := csv.NewWriter(c.Response().Writer)

	// Write Header
	writer.Write([]string{"Date", "Name", "MealCategory", "Calories", "Protein", "Carbs", "Fat", "Sugar", "Sodium", "Fiber"})

	for _, f := range foods {
		cat := f.MealCategory
		if cat == "" {
			cat = "Uncategorized"
		}
		writer.Write([]string{
			f.Date.Format("2006-01-02 15:04"),
			f.Name,
			cat,
			fmt.Sprintf("%.1f", f.Calories),
			fmt.Sprintf("%.1f", f.Protein),
			fmt.Sprintf("%.1f", f.Carbs),
			fmt.Sprintf("%.1f", f.Fat),
			fmt.Sprintf("%.1f", f.Sugar),
			fmt.Sprintf("%.1f", f.Sodium),
			fmt.Sprintf("%.1f", f.Fiber),
		})
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return nil
}
