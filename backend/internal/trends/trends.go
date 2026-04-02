package trends

import (
	"context"
	"fmt"
	"sync"
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
	AvgCarbs       float64
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
	wOpts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}})

	// Parallel DB fetches
	var (
		foods     []models.Food
		weights   []models.WeightRecord
		exercises []models.ExerciseRecord
		sleeps    []models.SleepRecord
		wg        sync.WaitGroup
	)

	wg.Add(4)
	go func() {
		defer wg.Done()
		if cur, err := db.FoodsCollection.Find(ctx, filter); err == nil {
			cur.All(ctx, &foods)
		}
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.WeightCollection.Find(ctx, filter, wOpts); err == nil {
			cur.All(ctx, &weights)
		}
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.ExerciseCollection.Find(ctx, filter); err == nil {
			cur.All(ctx, &exercises)
		}
	}()
	go func() {
		defer wg.Done()
		if cur, err := db.SleepCollection.Find(ctx, filter); err == nil {
			cur.All(ctx, &sleeps)
		}
	}()
	wg.Wait()

	// --- Dynamic Period Normalization ---
	// If the user hasn't used the app for the full 'days', we should divide by the actual elapsed days
	divisor := float64(days)
	earliestRecord := endTime
	hasData := false

	for _, f := range foods {
		if f.Date.Before(earliestRecord) {
			earliestRecord = f.Date
			hasData = true
		}
	}
	for _, w := range weights {
		if w.Date.Before(earliestRecord) {
			earliestRecord = w.Date
			hasData = true
		}
	}
	for _, e := range exercises {
		if e.Date.Before(earliestRecord) {
			earliestRecord = e.Date
			hasData = true
		}
	}
	for _, s := range sleeps {
		if s.Date.Before(earliestRecord) {
			earliestRecord = s.Date
			hasData = true
		}
	}

	if hasData {
		daysSinceStart := int(time.Since(earliestRecord).Hours()/24) + 1
		if float64(daysSinceStart) < divisor {
			divisor = float64(daysSinceStart)
		}
	}
	if divisor < 1 {
		divisor = 1
	}

	// --- Calculations ---
	summary := TrendSummary{PeriodDays: int(divisor)} // Use actual divisor for period description if needed

	if len(foods) > 0 {
		var totalCal, totalPro, totalCarb, totalFat float64
		loggedDays := make(map[string]bool)
		for _, f := range foods {
			totalCal += f.Calories
			totalPro += models.SafeFloat(f.Protein)
			totalCarb += models.SafeFloat(f.Carbs)
			totalFat += models.SafeFloat(f.Fat)
			loggedDays[f.Date.Format("2006-01-02")] = true
		}
		summary.AvgCalories = totalCal / divisor
		summary.AvgProtein = totalPro / divisor
		summary.AvgCarbs = totalCarb / divisor
		summary.AvgFat = totalFat / divisor
		summary.Consistency = float64(len(loggedDays)) / divisor
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
	trendText += fmt.Sprintf("- Avg Daily Intake: %.0f kcal (P:%.1fg, C:%.1fg, F:%.1fg)\n", summary.AvgCalories, summary.AvgProtein, summary.AvgCarbs, summary.AvgFat)
	trendText += fmt.Sprintf("- Weight Change: %.1f kg\n", summary.WeightChange)
	trendText += fmt.Sprintf("- Activity: %d sessions, %d total minutes\n", summary.ExerciseCount, summary.TotalExMinutes)
	trendText += fmt.Sprintf("- Sleep: %.1f hours avg\n", summary.SleepAvgHours)
	trendText += fmt.Sprintf("- Logging Consistency: %.0f%%\n", summary.Consistency*100)

	return trendText, nil
}
