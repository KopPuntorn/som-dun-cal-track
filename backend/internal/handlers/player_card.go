package handlers

import (
	"context"
	"math"
	"net/http"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// PlayerCardStats represents the 6 individual stats on the card
type PlayerCardStats struct {
	Nutrition  int `json:"nut"`
	Hydration  int `json:"hyd"`
	Fitness    int `json:"fit"`
	Recovery   int `json:"rec"`
	Discipline int `json:"dis"`
	Endurance  int `json:"end"`
}

// PlayerCardResponse is the full card payload
type PlayerCardResponse struct {
	Name     string          `json:"name"`
	Month    string          `json:"month"`
	OVR      int             `json:"ovr"`
	Rarity   string          `json:"rarity"`
	Stats    PlayerCardStats `json:"stats"`
	Position string          `json:"position"`
	DaysInMonth int          `json:"daysInMonth"`
	DaysTracked int          `json:"daysTracked"`
}

// GetPlayerCard computes and returns the player card for a given month
func GetPlayerCard(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)

	// --- Fetch User Data ---
	var user models.User
	if err := db.UserCollection.FindOne(c.Request().Context(), bson.M{"_id": userID}).Decode(&user); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "user not found"})
	}

	monthStr := c.QueryParam("month") // expected: "2026-03"

	// Parse month or default to current
	now := time.Now()
	year, month := now.Year(), now.Month()
	if monthStr != "" {
		parsed, err := time.Parse("2006-01", monthStr)
		if err == nil {
			year = parsed.Year()
			month = parsed.Month()
		}
	}

	startOfMonth := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 1, 0).Add(-time.Nanosecond)
	daysInMonth := endOfMonth.Day()

	// If we're in the current month, only count up to today
	effectiveDays := daysInMonth
	if year == now.Year() && month == now.Month() {
		effectiveDays = now.Day()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// ─── Fetch all data for the month ───
	dateFilter := bson.M{"$gte": startOfMonth, "$lte": endOfMonth}
	userFilter := bson.M{"userId": userID}

	// 1. Foods
	var foods []models.Food
	foodCursor, err := db.FoodsCollection.Find(ctx, bson.M{"userId": userID, "date": dateFilter})
	if err == nil {
		foodCursor.All(ctx, &foods)
		foodCursor.Close(ctx)
	}

	// 2. Goals
	var goals models.Goals
	db.GoalsCollection.FindOne(ctx, userFilter).Decode(&goals)
	if goals.Calories == 0 {
		goals.Calories = 2000
	}
	if goals.Protein == 0 {
		goals.Protein = 150
	}

	// 3. Water
	var waterRecords []models.WaterIntake
	waterCursor, err := db.WaterCollection.Find(ctx, userFilter)
	if err == nil {
		waterCursor.All(ctx, &waterRecords)
		waterCursor.Close(ctx)
	}

	// 4. Exercise
	var exercises []models.ExerciseRecord
	exCursor, err := db.ExerciseCollection.Find(ctx, bson.M{"userId": userID, "date": dateFilter})
	if err == nil {
		exCursor.All(ctx, &exercises)
		exCursor.Close(ctx)
	}

	// 5. Sleep
	var sleepRecords []models.SleepRecord
	sleepCursor, err := db.SleepCollection.Find(ctx, bson.M{"userId": userID, "date": dateFilter})
	if err == nil {
		sleepCursor.All(ctx, &sleepRecords)
		sleepCursor.Close(ctx)
	}

	// --- All data fetched, proceed to calculation ---

	// ─── Calculate Stats ───

	// NUTRITION (NUT): % of days hitting calorie target within ±15%, plus Protein and Fat adherence
	nutScore := calcNutritionScore(foods, goals, effectiveDays)

	// HYDRATION (HYD): Avg glasses/day based on weight
	hydScore := calcHydrationScore(waterRecords, user.Weight, startOfMonth, effectiveDays)

	// FITNESS (FIT): Total exercise minutes + calories burned, scaled
	fitScore := calcFitnessScore(exercises, effectiveDays)

	// RECOVERY (REC): Avg sleep hours and Sleep Quality
	recScore := calcRecoveryScore(sleepRecords)

	// DISCIPLINE (DIS): % of days with ≥1 food entry logged
	disScore := calcDisciplineScore(foods, effectiveDays)

	// ENDURANCE (END): Exercise frequency + duration consistency
	endScore := calcEnduranceScore(exercises, effectiveDays)

	// ─── OVR ───
	ovr := int(math.Round(
		float64(nutScore)*0.25 +
			float64(hydScore)*0.10 +
			float64(fitScore)*0.20 +
			float64(recScore)*0.15 +
			float64(disScore)*0.20 +
			float64(endScore)*0.10,
	))
	ovr = clamp(ovr, 0, 99)

	// ─── Rarity ───
	rarity := "bronze"
	switch {
	case ovr >= 90:
		rarity = "diamond"
	case ovr >= 80:
		rarity = "gold"
	case ovr >= 70:
		rarity = "emerald"
	case ovr >= 60:
		rarity = "silver"
	}

	// ─── Position (fun label based on objective) ───
	position := "ALL" // All-rounder
	switch goals.Objective {
	case "lose_fat":
		position = "ATK" // Attacker — burning calories
	case "lose_weight":
		position = "WNG" // Wing — agile, lean
	case "gain_weight":
		position = "STR" // Striker — heavy hitter
	case "build_muscle":
		position = "DEF" // Defender — building foundation
	case "maintain":
		position = "MID" // Midfielder — balanced
	}

	// Days tracked
	daysTracked := countUniqueDays(foods)

	return c.JSON(http.StatusOK, PlayerCardResponse{
		Name:        user.Name,
		Month:       startOfMonth.Format("2006-01"),
		OVR:         ovr,
		Rarity:      rarity,
		Stats: PlayerCardStats{
			Nutrition:  nutScore,
			Hydration:  hydScore,
			Fitness:    fitScore,
			Recovery:   recScore,
			Discipline: disScore,
			Endurance:  endScore,
		},
		Position:    position,
		DaysInMonth: daysInMonth,
		DaysTracked: daysTracked,
	})
}

// ─── Scoring Functions ───

func calcNutritionScore(foods []models.Food, goals models.Goals, days int) int {
	if days == 0 || len(foods) == 0 {
		return 0
	}

	// Group calories by day
	dailyCals := make(map[string]float64)
	dailyPro := make(map[string]float64)
	dailyFat := make(map[string]float64)
	for _, f := range foods {
		day := f.Date.Format("2006-01-02")
		dailyCals[day] += f.Calories
		dailyPro[day] += models.SafeFloat(f.Protein)
		dailyFat[day] += models.SafeFloat(f.Fat)
	}

	hitDays := 0
	for _, cals := range dailyCals {
		calRatio := cals / goals.Calories
		// Within ±15% of target
		if calRatio >= 0.85 && calRatio <= 1.15 {
			hitDays++
		}
	}

	// Also factor in protein and fat adherence
	proHitDays := 0
	for _, pro := range dailyPro {
		proRatio := pro / goals.Protein
		if proRatio >= 0.80 {
			proHitDays++
		}
	}

	fatHitDays := 0
	for _, fat := range dailyFat {
		// For fat, usually keeping it under 120% of goal is good, but hitting at least 70% is healthy
		fatRatio := fat / goals.Fat
		if fatRatio >= 0.70 && fatRatio <= 1.20 {
			fatHitDays++
		}
	}

	trackedDays := len(dailyCals)
	if trackedDays == 0 {
		return 0
	}

	calScore := float64(hitDays) / float64(trackedDays) * 99
	proScore := float64(proHitDays) / float64(trackedDays) * 99
	fatScore := float64(fatHitDays) / float64(trackedDays) * 99

	return clamp(int(math.Round(calScore*0.5+proScore*0.3+fatScore*0.2)), 0, 99)
}

func calcHydrationScore(waters []models.WaterIntake, userWeight float64, startOfMonth time.Time, days int) int {
	if days == 0 {
		return 0
	}

	// Optimal water = weight (kg) * 33 ml per kg. Example: 70kg * 33 = 2310 ml
	// Assuming 1 glass = 250ml
	targetGlasses := 8.0 // default
	if userWeight > 0 {
		targetGlasses = (userWeight * 33.0) / 250.0
	}

	// Filter water records for this month only
	monthStr := startOfMonth.Format("2006-01")
	totalGlasses := 0
	daysWithWater := 0
	for _, w := range waters {
		if len(w.Date) >= 7 && w.Date[:7] == monthStr && w.Glasses > 0 {
			totalGlasses += w.Glasses
			daysWithWater++
		}
	}

	if daysWithWater == 0 {
		return 0
	}

	avgGlasses := float64(totalGlasses) / float64(daysWithWater)
	// target glasses/day = 99, scale linearly
	score := (avgGlasses / targetGlasses) * 99
	// Bonus for consistency
	consistencyBonus := (float64(daysWithWater) / float64(days)) * 15

	return clamp(int(math.Round(score*0.7+consistencyBonus*0.3)), 0, 99)
}

func calcFitnessScore(exercises []models.ExerciseRecord, days int) int {
	if len(exercises) == 0 {
		return 0
	}

	totalMinutes := 0
	totalCalsBurned := 0.0
	for _, e := range exercises {
		totalMinutes += e.DurationMinutes
		totalCalsBurned += models.SafeFloat(e.CaloriesBurned)
	}

	// Target: ~150 min/week → ~600 min/month for a perfect score
	minuteScore := math.Min(float64(totalMinutes)/600.0, 1.0) * 99

	// Calories burned bonus (target: ~2000 kcal/month for bonus)
	calBonus := math.Min(totalCalsBurned/2000.0, 1.0) * 20

	return clamp(int(math.Round(minuteScore+calBonus)), 0, 99)
}

func calcRecoveryScore(sleepRecords []models.SleepRecord) int {
	if len(sleepRecords) == 0 {
		return 0
	}

	totalHours := 0.0
	goodNights := 0
	for _, s := range sleepRecords {
		totalHours += s.DurationHours
		// 7-9 hours is optimal + "Good" quality bonus
		isGoodDuration := s.DurationHours >= 7 && s.DurationHours <= 9
		if isGoodDuration && models.SafeString(s.Quality) == "Good" {
			goodNights += 2 // double points for perfect sleep
		} else if isGoodDuration || models.SafeString(s.Quality) == "Good" {
			goodNights += 1 // partial points
		}
	}

	avgHours := totalHours / float64(len(sleepRecords))

	// Bell curve scoring: 8h = peak (99), drops off on both sides
	var hourScore float64
	if avgHours >= 7 && avgHours <= 9 {
		hourScore = 99
	} else if avgHours >= 6 && avgHours < 7 {
		hourScore = 70 + (avgHours-6)*29
	} else if avgHours > 9 && avgHours <= 10 {
		hourScore = 99 - (avgHours-9)*20
	} else if avgHours >= 5 && avgHours < 6 {
		hourScore = 40 + (avgHours-5)*30
	} else {
		hourScore = math.Max(10, 40-(math.Abs(avgHours-8)*10))
	}

	qualityBonus := float64(goodNights) / (float64(len(sleepRecords)) * 2) * 20

	return clamp(int(math.Round(hourScore*0.7+qualityBonus+10)), 0, 99)
}

func calcDisciplineScore(foods []models.Food, days int) int {
	if days == 0 || len(foods) == 0 {
		return 0
	}

	uniqueDays := countUniqueDays(foods)
	ratio := float64(uniqueDays) / float64(days)

	// Non-linear: reward consistency heavily
	score := math.Pow(ratio, 0.8) * 99

	return clamp(int(math.Round(score)), 0, 99)
}

func calcEnduranceScore(exercises []models.ExerciseRecord, days int) int {
	if days == 0 || len(exercises) == 0 {
		return 0
	}

	// Count unique exercise days
	exDays := make(map[string]bool)
	totalDuration := 0
	for _, e := range exercises {
		day := e.Date.Format("2006-01-02")
		exDays[day] = true
		totalDuration += e.DurationMinutes
	}

	// Frequency: target 4 days/week → ~16 days/month
	freqScore := math.Min(float64(len(exDays))/16.0, 1.0) * 70

	// Duration consistency: avg session > 30 min is good
	avgDuration := float64(totalDuration) / float64(len(exercises))
	durationScore := math.Min(avgDuration/45.0, 1.0) * 29

	return clamp(int(math.Round(freqScore+durationScore)), 0, 99)
}

// ─── Helpers ───

func clamp(val, min, max int) int {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

func countUniqueDays(foods []models.Food) int {
	days := make(map[string]bool)
	for _, f := range foods {
		days[f.Date.Format("2006-01-02")] = true
	}
	return len(days)
}
