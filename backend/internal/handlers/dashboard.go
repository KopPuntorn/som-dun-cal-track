package handlers

import (
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"sync"
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
	Briefing     string                   `json:"briefing"`
}

func GetDashboardSummary(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var summary DashboardSummary

	// Use WaitGroup for parallel fetching
	var wg sync.WaitGroup
	var mu sync.Mutex

	// 1. Get User (Required first or context for others? Actually independent)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var u models.User
		if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
			mu.Lock()
			summary.User = u
			mu.Unlock()
		}
	}()

	// 2. Get Goals
	wg.Add(1)
	go func() {
		defer wg.Done()
		var g models.Goals
		if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
			mu.Lock()
			summary.Goals = g
			mu.Unlock()
		} else {
			mu.Lock()
			summary.Goals = models.Goals{Calories: 2000, Protein: 150, Fat: 70}
			mu.Unlock()
		}
	}()

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
	wg.Add(1)
	go func() {
		defer wg.Done()
		foodFilter := bson.M{"userId": userID}
		if hasRange {
			foodFilter["date"] = bson.M{"$gte": start, "$lte": end}
		} else {
			now := time.Now()
			startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)
			foodFilter["date"] = bson.M{"$gte": startOfDay, "$lte": endOfDay}
		}
		var foods []models.Food
		foodCursor, _ := db.FoodsCollection.Find(ctx, foodFilter, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
		if foodCursor != nil {
			foodCursor.All(ctx, &foods)
		}
		mu.Lock()
		if foods == nil {
			summary.TodayFoods = []models.Food{}
		} else {
			summary.TodayFoods = foods
		}
		mu.Unlock()
	}()

	// 4. Get Water Today
	wg.Add(1)
	go func() {
		defer wg.Done()
		dateStr := time.Now().Format("2006-01-02")
		var w models.WaterIntake
		if err := db.WaterCollection.FindOne(ctx, bson.M{"date": dateStr, "userId": userID}).Decode(&w); err == nil {
			mu.Lock()
			summary.WaterToday = w
			mu.Unlock()
		} else {
			mu.Lock()
			summary.WaterToday = models.WaterIntake{Date: dateStr, Glasses: 0}
			mu.Unlock()
		}
	}()

	// 5. Weight
	wg.Add(1)
	go func() {
		defer wg.Done()
		weightFilter := bson.M{"userId": userID}
		if hasRange {
			weightFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		weightOpts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}})
		if !hasRange {
			weightOpts.SetLimit(30).SetSort(bson.D{{Key: "date", Value: -1}})
		}
		var weights []models.WeightRecord
		weightCursor, _ := db.WeightCollection.Find(ctx, weightFilter, weightOpts)
		if weightCursor != nil {
			weightCursor.All(ctx, &weights)
		}
		mu.Lock()
		if weights == nil {
			summary.WeightRecent = []models.WeightRecord{}
		} else {
			summary.WeightRecent = weights
		}
		mu.Unlock()
	}()

	// 6. Exercise
	wg.Add(1)
	go func() {
		defer wg.Done()
		exFilter := bson.M{"userId": userID}
		if hasRange {
			exFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		exOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
		if !hasRange {
			exOpts.SetLimit(30)
		}
		var exercises []models.ExerciseRecord
		exCursor, _ := db.ExerciseCollection.Find(ctx, exFilter, exOpts)
		if exCursor != nil {
			exCursor.All(ctx, &exercises)
		}
		mu.Lock()
		if exercises == nil {
			summary.Exercise = []models.ExerciseRecord{}
		} else {
			summary.Exercise = exercises
		}
		mu.Unlock()
	}()

	// 7. Sleep
	wg.Add(1)
	go func() {
		defer wg.Done()
		sleepFilter := bson.M{"userId": userID}
		if hasRange {
			sleepFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		sleepOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
		if !hasRange {
			sleepOpts.SetLimit(30)
		}
		var sleep []models.SleepRecord
		sleepCursor, _ := db.SleepCollection.Find(ctx, sleepFilter, sleepOpts)
		if sleepCursor != nil {
			sleepCursor.All(ctx, &sleep)
		}
		mu.Lock()
		if sleep == nil {
			summary.Sleep = []models.SleepRecord{}
		} else {
			summary.Sleep = sleep
		}
		mu.Unlock()
	}()

	// 8. Measurements
	wg.Add(1)
	go func() {
		defer wg.Done()
		mFilter := bson.M{"userId": userID}
		if hasRange {
			mFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		mOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
		if !hasRange {
			mOpts.SetLimit(5)
		}
		var measurements []models.BodyMeasurement
		mCursor, _ := db.BodyMeasurementCollection.Find(ctx, mFilter, mOpts)
		if mCursor != nil {
			mCursor.All(ctx, &measurements)
		}
		mu.Lock()
		if measurements == nil {
			summary.Measurements = []models.BodyMeasurement{}
		} else {
			summary.Measurements = measurements
		}
		mu.Unlock()
	}()

	// 9. Recent Food Suggestions
	wg.Add(1)
	go func() {
		defer wg.Done()
		allFoodCursor, _ := db.FoodsCollection.Find(ctx, bson.M{"userId": userID}, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}).SetLimit(100))
		if allFoodCursor != nil {
			var allFoods []models.Food
			allFoodCursor.All(ctx, &allFoods)

			uniqueNames := make(map[string]bool)
			var recentFoods []models.Food
			for _, f := range allFoods {
				if !uniqueNames[f.Name] {
					uniqueNames[f.Name] = true
					recentFoods = append(recentFoods, f)
					if len(recentFoods) >= 5 {
						break
					}
				}
			}
			mu.Lock()
			if recentFoods == nil {
				summary.RecentFoods = []models.Food{}
			} else {
				summary.RecentFoods = recentFoods
			}
			mu.Unlock()
		}
	}()

	wg.Wait()

	// Show tour logic should be after summary.User is fetched
	if summary.User.Onboarded && !summary.User.TourCompleted {
		summary.User.TourCompleted = false // Just to be explicit for summary struct
	}

	return c.JSON(http.StatusOK, summary)
}

func GetDashboardBriefing(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	lang := c.QueryParam("lang")
	if lang == "" {
		lang = "en"
	}

	// We need summary data to generate briefing
	// Instead of refetching everything in parallel again (which we could, but let's keep it simple for now),
	// we fetch just what's needed for the hash and briefing.
	var summary DashboardSummary

	var wg sync.WaitGroup
	var mu sync.Mutex

	// User
	wg.Add(1)
	go func() {
		defer wg.Done()
		var u models.User
		db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
		mu.Lock()
		summary.User = u
		mu.Unlock()
	}()

	// Goals
	wg.Add(1)
	go func() {
		defer wg.Done()
		var g models.Goals
		db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g)
		mu.Lock()
		summary.Goals = g
		mu.Unlock()
	}()

	// Today's Foods
	wg.Add(1)
	go func() {
		defer wg.Done()
		now := time.Now()
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)
		cursor, _ := db.FoodsCollection.Find(ctx, bson.M{"userId": userID, "date": bson.M{"$gte": startOfDay, "$lte": endOfDay}})
		var foods []models.Food
		if cursor != nil {
			cursor.All(ctx, &foods)
		}
		mu.Lock()
		summary.TodayFoods = foods
		mu.Unlock()
	}()

	// Today's Water
	wg.Add(1)
	go func() {
		defer wg.Done()
		dateStr := time.Now().Format("2006-01-02")
		var w models.WaterIntake
		db.WaterCollection.FindOne(ctx, bson.M{"date": dateStr, "userId": userID}).Decode(&w)
		mu.Lock()
		summary.WaterToday = w
		mu.Unlock()
	}()

	// Today's Exercise
	wg.Add(1)
	go func() {
		defer wg.Done()
		now := time.Now()
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)
		cursor, _ := db.ExerciseCollection.Find(ctx, bson.M{"userId": userID, "date": bson.M{"$gte": startOfDay, "$lte": endOfDay}})
		var exercise []models.ExerciseRecord
		if cursor != nil {
			cursor.All(ctx, &exercise)
		}
		mu.Lock()
		summary.Exercise = exercise
		mu.Unlock()
	}()

	wg.Wait()

	// Calculate Hash & Generate Briefing (same logic as before)
	totalCal := 0.0
	for _, f := range summary.TodayFoods {
		totalCal += f.Calories
	}
	totalExMinutes := 0
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayEnd := todayStart.AddDate(0, 0, 1).Add(-time.Nanosecond)
	for _, e := range summary.Exercise {
		if e.Date.After(todayStart) && e.Date.Before(todayEnd) {
			totalExMinutes += e.DurationMinutes
		}
	}

	stateStr := fmt.Sprintf("%s|%.0f|%d|%d|%s", todayStart.Format("2006-01-02"), totalCal, summary.WaterToday.Glasses, totalExMinutes, lang)
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(stateStr)))

	var briefing string
	if summary.User.LastBriefingHash == hash && summary.User.LastBriefing != "" {
		briefing = summary.User.LastBriefing
	} else {
		briefing = GenerateDailyBriefing(ctx, userID, summary, lang)
		db.UserCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$set": bson.M{"lastBriefing": briefing, "lastBriefingHash": hash}})
	}

	return c.JSON(http.StatusOK, map[string]string{"briefing": briefing})
}
