package handlers

import (
	"context"
	// "crypto/sha256"
	// "fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type UnifiedActivity struct {
	ID       primitive.ObjectID `json:"id"`
	Type     string             `json:"type"` // food, exercise, sleep, weight
	Name     string             `json:"name"`
	Date     time.Time          `json:"date"`
	Calories float64            `json:"calories,omitempty"`
	Protein  *float64           `json:"protein,omitempty"`
	Carbs    *float64           `json:"carbs,omitempty"`
	Fat      *float64           `json:"fat,omitempty"`
	Duration float64            `json:"duration,omitempty"` // minutes or hours
	Weight   float64            `json:"weight,omitempty"`
	Category string             `json:"category,omitempty"` // mealCategory or quality
}

type DashboardSummary struct {
	User           models.User              `json:"user"`
	Goals          models.Goals             `json:"goals"`
	TodayFoods     []models.Food            `json:"todayFoods"`
	WaterToday     models.WaterIntake       `json:"waterToday"`
	WeightRecent   []models.WeightRecord    `json:"weightRecent"`
	Exercise       []models.ExerciseRecord  `json:"exerciseRecent"`
	Sleep          []models.SleepRecord     `json:"sleepRecent"`
	Measurements   []models.BodyMeasurement `json:"measurementsRecent"`
	RecentFoods    []models.Food            `json:"recentFoods"`
	UnifiedHistory []UnifiedActivity        `json:"unifiedHistory"`
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
			summary.Goals = models.Goals{Calories: 2000, Protein: 150, Carbs: 250, Fat: 70}
			mu.Unlock()
		}
	}()

	// Determine range for historical data
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")
	var start, end time.Time
	hasRange := false
	waterDate := time.Now().Format("2006-01-02")
	if startStr != "" && endStr != "" {
		s, errS := time.Parse(time.RFC3339, startStr)
		e, errE := time.Parse(time.RFC3339, endStr)
		if errS == nil && errE == nil {
			start = s
			end = e
			hasRange = true
			waterDate = end.In(time.Local).Format("2006-01-02")
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
		var w models.WaterIntake
		if err := db.WaterCollection.FindOne(ctx, bson.M{"date": waterDate, "userId": userID}).Decode(&w); err == nil {
			mu.Lock()
			summary.WaterToday = w
			mu.Unlock()
		} else {
			mu.Lock()
			summary.WaterToday = models.WaterIntake{Date: waterDate, Glasses: 0}
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

	// --- Create Unified History (Feed) ---
	// Define date window for filtering feed items (if not already defined by hasRange)
	feedStart := start
	feedEnd := end
	if !hasRange {
		now := time.Now()
		feedStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		feedEnd = feedStart.AddDate(0, 0, 1).Add(-time.Nanosecond)
	}

	var unified []UnifiedActivity
	for _, f := range summary.TodayFoods {
		unified = append(unified, UnifiedActivity{
			ID:       f.ID,
			Type:     "food",
			Name:     f.Name,
			Date:     f.Date,
			Calories: f.Calories,
			Protein:  f.Protein,
			Carbs:    f.Carbs,
			Fat:      f.Fat,
			Category: f.MealCategory,
		})
	}
	for _, e := range summary.Exercise {
		// Only include in feed if it matches today/the requested range
		if e.Date.Before(feedStart) || e.Date.After(feedEnd) {
			continue
		}
		unified = append(unified, UnifiedActivity{
			ID:       e.ID,
			Type:     "exercise",
			Name:     e.Name,
			Date:     e.Date,
			Calories: models.SafeFloat(e.CaloriesBurned),
			Duration: float64(e.DurationMinutes),
		})
	}
	for _, s := range summary.Sleep {
		// Only include in feed if it matches today/the requested range
		if s.Date.Before(feedStart) || s.Date.After(feedEnd) {
			continue
		}
		unified = append(unified, UnifiedActivity{
			ID:       s.ID,
			Type:     "sleep",
			Name:     "Sleep Session",
			Date:     s.Date,
			Duration: s.DurationHours,
			Category: models.SafeString(s.Quality),
		})
	}

	// Sort by date descending
	sort.Slice(unified, func(i, j int) bool {
		return unified[i].Date.After(unified[j].Date)
	})
	summary.UnifiedHistory = unified

	// Show tour logic should be after summary.User is fetched
	if summary.User.Onboarded && !summary.User.TourCompleted {
		summary.User.TourCompleted = false // Just to be explicit for summary struct
	}

	return c.JSON(http.StatusOK, summary)
}
