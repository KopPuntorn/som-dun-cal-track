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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"strconv"
)

// --- Water Handlers ---

func GetWater(c echo.Context) error {
	dateStr := c.QueryParam("date")
	if dateStr == "" {
		dateStr = time.Now().Format("2006-01-02")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var w models.WaterIntake
	err := db.WaterCollection.FindOne(ctx, bson.M{"date": dateStr, "userId": userID}).Decode(&w)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return c.JSON(http.StatusOK, models.WaterIntake{Date: dateStr, Glasses: 0})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, w)
}

func UpdateWater(c echo.Context) error {
	var req struct {
		Date    string `json:"date"`
		Glasses int    `json:"glasses"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.Glasses < 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "glasses cannot be negative"})
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

	_, err := db.WaterCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "updated successfully"})
}

// --- Weight Handlers ---

func GetWeightHistory(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

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
	cursor, err := db.WeightCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var weights []models.WeightRecord
	if err := cursor.All(ctx, &weights); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if weights == nil {
		weights = []models.WeightRecord{}
	}

	return c.JSON(http.StatusOK, weights)
}

func AddWeight(c echo.Context) error {
	var req struct {
		Weight float64 `json:"weight"`
		Date   string  `json:"date"` // optional
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.Weight <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "weight must be positive"})
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
	_, err := db.WeightCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		slog.Error("Failed to add weight record", "userID", userID, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	slog.Info("Weight record added/updated", "userID", userID, "weight", req.Weight, "date", recordDate)
	return c.JSON(http.StatusOK, map[string]string{"message": "logged successfully"})
}

func DeleteWeight(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "userId": c.Get("userID").(primitive.ObjectID)}
	result, err := db.WeightCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

// --- Exercise Handlers ---

func GetExerciseHistory(c echo.Context) error {
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

	// Pagination
	pageStr := c.QueryParam("page")
	limitStr := c.QueryParam("limit")
	page := 1
	limit := 100 // Default to more for history
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
		limit = l
	}
	skip := (page - 1) * limit

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(int64(limit)).SetSkip(int64(skip))
	cursor, err := db.ExerciseCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var records []models.ExerciseRecord
	if err := cursor.All(ctx, &records); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if records == nil {
		records = []models.ExerciseRecord{}
	}

	return c.JSON(http.StatusOK, records)
}

func AddExercise(c echo.Context) error {
	var record models.ExerciseRecord
	if err := c.Bind(&record); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if record.DurationMinutes <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "duration must be positive"})
	}
	if record.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "exercise name is required"})
	}

	if record.Date.IsZero() {
		record.Date = time.Now()
	}
	record.UserID = c.Get("userID").(primitive.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// AI Estimation if calories not provided
	if record.CaloriesBurned == nil || *record.CaloriesBurned == 0 {
		var u models.User
		if err := db.UserCollection.FindOne(ctx, bson.M{"_id": record.UserID}).Decode(&u); err == nil {
			est, err := EstimateExerciseCalories(record.Name, record.DurationMinutes, u)
			if err == nil {
				record.CaloriesBurned = &est
				slog.Info("AI Estimated calories", "exercise", record.Name, "duration", record.DurationMinutes, "estimate", est)
			} else {
				slog.Error("AI Estimation failed", "error", err)
			}
		}
	}

	result, err := db.ExerciseCollection.InsertOne(ctx, record)
	if err != nil {
		slog.Error("Failed to add exercise record", "userID", record.UserID, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	record.ID = result.InsertedID.(primitive.ObjectID)
	slog.Info("Exercise record added", "userID", record.UserID, "id", record.ID, "name", record.Name)
	return c.JSON(http.StatusCreated, record)
}

func DeleteExercise(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "userId": c.Get("userID").(primitive.ObjectID)}
	result, err := db.ExerciseCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

func UpdateExercise(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	var req models.ExerciseRecord
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.DurationMinutes <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "duration must be positive"})
	}
	if req.Name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "exercise name is required"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	filter := bson.M{"_id": objID, "userId": userID}

	update := bson.M{
		"$set": bson.M{
			"name":            req.Name,
			"durationMinutes": req.DurationMinutes,
			"caloriesBurned":  req.CaloriesBurned,
			"date":            req.Date,
		},
	}

	_, err = db.ExerciseCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	req.ID = objID
	req.UserID = userID
	return c.JSON(http.StatusOK, req)
}

// --- Sleep Handlers ---

func GetSleepHistory(c echo.Context) error {
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
	cursor, err := db.SleepCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var records []models.SleepRecord
	if err := cursor.All(ctx, &records); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if records == nil {
		records = []models.SleepRecord{}
	}

	return c.JSON(http.StatusOK, records)
}

func AddSleep(c echo.Context) error {
	var record models.SleepRecord
	if err := c.Bind(&record); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if record.DurationHours <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "duration must be positive"})
	}

	if record.Date.IsZero() {
		record.Date = time.Now()
	}
	record.UserID = c.Get("userID").(primitive.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.SleepCollection.InsertOne(ctx, record)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	record.ID = result.InsertedID.(primitive.ObjectID)
	return c.JSON(http.StatusCreated, record)
}

func DeleteSleep(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "userId": c.Get("userID").(primitive.ObjectID)}
	result, err := db.SleepCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}

func UpdateSleep(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	var req models.SleepRecord
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if req.DurationHours <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "duration must be positive"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	filter := bson.M{"_id": objID, "userId": userID}

	update := bson.M{
		"$set": bson.M{
			"durationHours": req.DurationHours,
			"quality":       req.Quality,
			"date":          req.Date,
		},
	}

	_, err = db.SleepCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	req.ID = objID
	req.UserID = userID
	return c.JSON(http.StatusOK, req)
}

// --- Body Measurement Handlers ---

func GetBodyMeasurements(c echo.Context) error {
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
	cursor, err := db.BodyMeasurementCollection.Find(ctx, filter, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var records []models.BodyMeasurement
	if err := cursor.All(ctx, &records); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if records == nil {
		records = []models.BodyMeasurement{}
	}

	return c.JSON(http.StatusOK, records)
}

func AddBodyMeasurement(c echo.Context) error {
	var record models.BodyMeasurement
	if err := c.Bind(&record); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if record.Weight <= 0 || record.WaistCircumference <= 0 || record.BodyFatPercentage <= 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "measurements must be positive"})
	}

	if record.Date.IsZero() {
		record.Date = time.Now()
	}
	record.UserID = c.Get("userID").(primitive.ObjectID)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := db.BodyMeasurementCollection.InsertOne(ctx, record)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	record.ID = result.InsertedID.(primitive.ObjectID)
	return c.JSON(http.StatusCreated, record)
}

func DeleteBodyMeasurement(c echo.Context) error {
	idStr := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid id format"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "userId": c.Get("userID").(primitive.ObjectID)}
	result, err := db.BodyMeasurementCollection.DeleteOne(ctx, filter)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	if result.DeletedCount == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "record not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "deleted successfully"})
}
