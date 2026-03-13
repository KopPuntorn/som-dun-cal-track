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

type DashboardSummary struct {
	User         models.User              `json:"user"`
	Goals        models.Goals             `json:"goals"`
	TodayFoods   []models.Food            `json:"todayFoods"`
	WaterToday   models.WaterIntake       `json:"waterToday"`
	WeightRecent []models.WeightRecord     `json:"weightRecent"`
	Exercise     []models.ExerciseRecord   `json:"exerciseRecent"`
	Sleep        []models.SleepRecord      `json:"sleepRecent"`
	Measurements []models.BodyMeasurement `json:"measurementsRecent"`
	RecentFoods  []models.Food            `json:"recentFoods"`
}

func GetDashboardSummary(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var summary DashboardSummary

	// 1. Get User
	if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&summary.User); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// 2. Get Goals
	if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&summary.Goals); err != nil {
		// Fallback to defaults if no goals found
		summary.Goals = models.Goals{
			Calories: 2000,
			Protein:  150,
			Carbs:    250,
			Fat:      70,
		}
	}

	// Determine range for historical data
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")

	var start, end time.Time
	hasRange := false

	if startStr != "" && endStr != "" {
		s, errS := time.Parse(time.RFC3339, startStr)
		e, errE := time.Parse(time.RFC3339, endStr)
		if errS == nil && errE == nil {
			start = s
			end = e
			hasRange = true
		}
	}

	// 3. Get Foods
	foodFilter := bson.M{"userId": userID}
	if hasRange {
		foodFilter["date"] = bson.M{"$gte": start, "$lte": end}
	} else {
		// Default to today if no range provided
		now := time.Now()
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)
		foodFilter["date"] = bson.M{"$gte": startOfDay, "$lte": endOfDay}
	}
	foodCursor, _ := db.FoodsCollection.Find(ctx, foodFilter, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
	if foodCursor != nil {
		foodCursor.All(ctx, &summary.TodayFoods)
	}
	if summary.TodayFoods == nil {
		summary.TodayFoods = []models.Food{}
	}

	// 4. Get Water Today
	dateStr := time.Now().Format("2006-01-02") // Always get current water for today
	if err := db.WaterCollection.FindOne(ctx, bson.M{"date": dateStr, "userId": userID}).Decode(&summary.WaterToday); err != nil {
		summary.WaterToday = models.WaterIntake{Date: dateStr, Glasses: 0}
	}

	// 5. Weight (Range or Last 30)
	weightFilter := bson.M{"userId": userID}
	if hasRange {
		weightFilter["date"] = bson.M{"$gte": start, "$lte": end}
	}
	weightOpts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}}) // Ascending for charts
	if !hasRange {
		weightOpts.SetLimit(30).SetSort(bson.D{{Key: "date", Value: -1}})
	}
	weightCursor, _ := db.WeightCollection.Find(ctx, weightFilter, weightOpts)
	if weightCursor != nil {
		weightCursor.All(ctx, &summary.WeightRecent)
	}
	if summary.WeightRecent == nil {
		summary.WeightRecent = []models.WeightRecord{}
	}

	// 6. Exercise (Range or Last 10)
	exFilter := bson.M{"userId": userID}
	if hasRange {
		exFilter["date"] = bson.M{"$gte": start, "$lte": end}
	}
	exOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	if !hasRange {
		exOpts.SetLimit(10)
	}
	exCursor, _ := db.ExerciseCollection.Find(ctx, exFilter, exOpts)
	if exCursor != nil {
		exCursor.All(ctx, &summary.Exercise)
	}
	if summary.Exercise == nil {
		summary.Exercise = []models.ExerciseRecord{}
	}

	// 7. Sleep (Range or Last 10)
	sleepFilter := bson.M{"userId": userID}
	if hasRange {
		sleepFilter["date"] = bson.M{"$gte": start, "$lte": end}
	}
	sleepOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	if !hasRange {
		sleepOpts.SetLimit(10)
	}
	sleepCursor, _ := db.SleepCollection.Find(ctx, sleepFilter, sleepOpts)
	if sleepCursor != nil {
		sleepCursor.All(ctx, &summary.Sleep)
	}
	if summary.Sleep == nil {
		summary.Sleep = []models.SleepRecord{}
	}

	// 8. Measurements (Range or Last 5)
	mFilter := bson.M{"userId": userID}
	if hasRange {
		mFilter["date"] = bson.M{"$gte": start, "$lte": end}
	}
	mOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	if !hasRange {
		mOpts.SetLimit(5)
	}
	mCursor, _ := db.BodyMeasurementCollection.Find(ctx, mFilter, mOpts)
	if mCursor != nil {
		mCursor.All(ctx, &summary.Measurements)
	}
	if summary.Measurements == nil {
		summary.Measurements = []models.BodyMeasurement{}
	}

	// 9. Recent Food Suggestions (Used by Home page for quick add)
	allFoodCursor, _ := db.FoodsCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(100))
	if allFoodCursor != nil {
		var allFoods []models.Food
		allFoodCursor.All(ctx, &allFoods)

		uniqueNames := make(map[string]bool)
		for _, f := range allFoods {
			if !uniqueNames[f.Name] {
				uniqueNames[f.Name] = true
				summary.RecentFoods = append(summary.RecentFoods, f)
				if len(summary.RecentFoods) >= 5 {
					break
				}
			}
		}
	}
	if summary.RecentFoods == nil {
		summary.RecentFoods = []models.Food{}
	}

	return c.JSON(http.StatusOK, summary)
}
