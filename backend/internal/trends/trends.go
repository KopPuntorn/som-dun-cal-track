package trends

import (
	"context"
	"fmt"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// TrendSummary contains aggregated data for AI context
type TrendSummary struct {
	PeriodDays     int
	AvgCalories    float64
	AvgProtein     float64
	AvgFat         float64
	WeightChange   float64
	ExerciseCount  int
	TotalExMinutes int
	SleepAvgHours  float64
	Consistency    float64 // 0.0 to 1.0 (days with logs / total days)
}

// CalculateUserTrends aggregates data for the last 'days' for a user
func CalculateUserTrends(userID primitive.ObjectID, days int) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	endTime := time.Now()
	startTime := endTime.AddDate(0, 0, -days)

	// DB filter
	filter := bson.M{
		"userId": userID,
		"date":   bson.M{"$gte": startTime, "$lte": endTime},
	}

	// 1. Fetch Food Logs
	var foods []models.Food
	cursor, err := db.FoodsCollection.Find(ctx, filter)
	if err == nil {
		cursor.All(ctx, &foods)
	}

	// 2. Fetch Weight Records (Sort by date to get change)
	var weights []models.WeightRecord
	wOpts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}})
	wCursor, err := db.WeightCollection.Find(ctx, filter, wOpts)
	if err == nil {
		wCursor.All(ctx, &weights)
	}

	// 3. Fetch Exercises
	var exercises []models.ExerciseRecord
	eCursor, err := db.ExerciseCollection.Find(ctx, filter)
	if err == nil {
		eCursor.All(ctx, &exercises)
	}

	// 4. Fetch Sleep
	var sleeps []models.SleepRecord
	sCursor, err := db.SleepCollection.Find(ctx, filter)
	if err == nil {
		sCursor.All(ctx, &sleeps)
	}

	// --- Calculations ---
	summary := TrendSummary{PeriodDays: days}

	if len(foods) > 0 {
		var totalCal, totalPro, totalFat float64
		loggedDays := make(map[string]bool)
		for _, f := range foods {
			totalCal += f.Calories
			totalPro += models.SafeFloat(f.Protein)
			totalFat += models.SafeFloat(f.Fat)
			loggedDays[f.Date.Format("2006-01-02")] = true
		}
		summary.AvgCalories = totalCal / float64(days)
		summary.AvgProtein = totalPro / float64(days)
		summary.AvgFat = totalFat / float64(days)
		summary.Consistency = float64(len(loggedDays)) / float64(days)
	}

	if len(weights) >= 2 {
		summary.WeightChange = weights[len(weights)-1].Weight - weights[0].Weight
	}

	summary.ExerciseCount = len(exercises)
	for _, e := range exercises {
		summary.TotalExMinutes += e.DurationMinutes
	}

	if len(sleeps) > 0 {
		var totalSleep float64
		for _, s := range sleeps {
			totalSleep += s.DurationHours
		}
		summary.SleepAvgHours = totalSleep / float64(len(sleeps))
	}

	// --- Format readable summary for AI ---
	trendText := fmt.Sprintf("Health Trend Summary (Last %d days):\n", days)
	trendText += fmt.Sprintf("- Avg Daily Intake: %.0f kcal (P:%.1fg, F:%.1fg)\n", summary.AvgCalories, summary.AvgProtein, summary.AvgFat)
	trendText += fmt.Sprintf("- Weight Change: %.1f kg\n", summary.WeightChange)
	trendText += fmt.Sprintf("- Activity: %d sessions, %d total minutes\n", summary.ExerciseCount, summary.TotalExMinutes)
	trendText += fmt.Sprintf("- Sleep: %.1f hours avg\n", summary.SleepAvgHours)
	trendText += fmt.Sprintf("- Logging Consistency: %.0f%%\n", summary.Consistency*100)

	return trendText, nil
}
