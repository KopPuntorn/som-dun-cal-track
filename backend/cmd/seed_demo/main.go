package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

const (
	defaultDemoEmail    = "demo@somdun.local"
	defaultDemoPassword = "Demo12345!"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	_ = godotenv.Load()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "mongodb://localhost:27017"
	}

	if err := db.InitDB(dbURL); err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	email := envOrDefault("DEMO_USER_EMAIL", defaultDemoEmail)
	password := envOrDefault("DEMO_USER_PASSWORD", defaultDemoPassword)

	userID, err := upsertDemoUser(ctx, email, password)
	if err != nil {
		slog.Error("failed to upsert demo user", "error", err)
		os.Exit(1)
	}

	if err := seedDemoData(ctx, userID); err != nil {
		slog.Error("failed to seed demo data", "error", err)
		os.Exit(1)
	}

	fmt.Printf("Demo data ready.\nEmail: %s\nPassword: %s\n", email, password)
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func upsertDemoUser(ctx context.Context, email, password string) (primitive.ObjectID, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return primitive.NilObjectID, err
	}

	var existing models.User
	err = db.UserCollection.FindOne(ctx, bson.M{"email": email}).Decode(&existing)
	if err == nil {
		update := bson.M{"$set": demoUserFields(string(hashedPassword))}
		if _, err = db.UserCollection.UpdateOne(ctx, bson.M{"_id": existing.ID}, update); err != nil {
			return primitive.NilObjectID, err
		}
		return existing.ID, nil
	}

	userID := primitive.NewObjectID()
	userFields := demoUserFields(string(hashedPassword))
	user := models.User{
		ID:                 userID,
		Email:              email,
		PasswordHash:       userFields["passwordHash"].(string),
		Name:               "SomDun Demo",
		Age:                30,
		Weight:             72,
		Height:             175,
		Sex:                "male",
		Onboarded:          true,
		TourCompleted:      true,
		DietaryPreferences: "High protein Thai meals",
		FoodDislikes:       "Overly sweet drinks",
		TonePreference:     "practical and encouraging",
		XP:                 2450,
		Level:              3,
		StreakDays:         8,
		LastActiveDate:     time.Now().Format("2006-01-02"),
		Tier:               "pro",
		SubscriptionStatus: "active",
	}

	_, err = db.UserCollection.InsertOne(ctx, user)
	return userID, err
}

func demoUserFields(passwordHash string) bson.M {
	return bson.M{
		"passwordHash":       passwordHash,
		"name":               "SomDun Demo",
		"age":                30,
		"weight":             72,
		"height":             175,
		"sex":                "male",
		"onboarded":          true,
		"tourCompleted":      true,
		"dietaryPreferences": "High protein Thai meals",
		"foodDislikes":       "Overly sweet drinks",
		"tonePreference":     "practical and encouraging",
		"xp":                 2450,
		"level":              3,
		"streakDays":         8,
		"lastActiveDate":     time.Now().Format("2006-01-02"),
		"tier":               "pro",
		"subscriptionStatus": "active",
	}
}

func seedDemoData(ctx context.Context, userID primitive.ObjectID) error {
	collections := []struct {
		name   string
		delete func(context.Context, interface{}, ...*options.DeleteOptions) (interface{}, error)
	}{
		{name: "foods", delete: func(ctx context.Context, filter interface{}, opts ...*options.DeleteOptions) (interface{}, error) {
			return db.FoodsCollection.DeleteMany(ctx, filter, opts...)
		}},
		{name: "water", delete: func(ctx context.Context, filter interface{}, opts ...*options.DeleteOptions) (interface{}, error) {
			return db.WaterCollection.DeleteMany(ctx, filter, opts...)
		}},
		{name: "exercise", delete: func(ctx context.Context, filter interface{}, opts ...*options.DeleteOptions) (interface{}, error) {
			return db.ExerciseCollection.DeleteMany(ctx, filter, opts...)
		}},
		{name: "sleep", delete: func(ctx context.Context, filter interface{}, opts ...*options.DeleteOptions) (interface{}, error) {
			return db.SleepCollection.DeleteMany(ctx, filter, opts...)
		}},
		{name: "body_measurement", delete: func(ctx context.Context, filter interface{}, opts ...*options.DeleteOptions) (interface{}, error) {
			return db.BodyMeasurementCollection.DeleteMany(ctx, filter, opts...)
		}},
	}

	for _, collection := range collections {
		if _, err := collection.delete(ctx, bson.M{"userId": userID}); err != nil {
			return fmt.Errorf("clear %s: %w", collection.name, err)
		}
	}

	now := time.Now()
	goals := models.Goals{
		UserID:              userID,
		Calories:            2100,
		Protein:             145,
		Carbs:               230,
		Fat:                 70,
		ExerciseMinutesGoal: 35,
		Objective:           "build_muscle",
	}
	_, err := db.GoalsCollection.UpdateOne(
		ctx,
		bson.M{"userId": userID},
		bson.M{"$set": goals},
		options.Update().SetUpsert(true),
	)
	if err != nil {
		return err
	}

	var foods []interface{}
	var waters []interface{}
	var exercises []interface{}
	var sleeps []interface{}
	var measurements []interface{}

	for i := 6; i >= 0; i-- {
		day := now.AddDate(0, 0, -i)
		dayKey := day.Format("2006-01-02")
		proteinBoost := float64((6 - i) * 5)

		foods = append(foods,
			models.Food{
				UserID:       userID,
				Name:         "Chicken basil rice",
				Calories:     620,
				Protein:      floatPtr(42 + proteinBoost),
				Carbs:        floatPtr(72),
				Fat:          floatPtr(18),
				Sugar:        floatPtr(6),
				Sodium:       floatPtr(780),
				Fiber:        floatPtr(4),
				Date:         time.Date(day.Year(), day.Month(), day.Day(), 12, 10, 0, 0, time.Local),
				MealCategory: "Lunch",
			},
			models.Food{
				UserID:       userID,
				Name:         "Greek yogurt with banana",
				Calories:     330,
				Protein:      floatPtr(28),
				Carbs:        floatPtr(42),
				Fat:          floatPtr(7),
				Sugar:        floatPtr(18),
				Sodium:       floatPtr(120),
				Fiber:        floatPtr(5),
				Date:         time.Date(day.Year(), day.Month(), day.Day(), 8, 0, 0, 0, time.Local),
				MealCategory: "Breakfast",
			},
		)

		waters = append(waters, models.WaterIntake{
			UserID:  userID,
			Date:    dayKey,
			Glasses: 6 + ((7 - i) % 3),
		})

		if i%2 == 0 {
			exercises = append(exercises, models.ExerciseRecord{
				UserID:          userID,
				Date:            time.Date(day.Year(), day.Month(), day.Day(), 18, 30, 0, 0, time.Local),
				Name:            "Strength training",
				DurationMinutes: 45,
				CaloriesBurned:  floatPtr(320),
			})
		}

		sleeps = append(sleeps, models.SleepRecord{
			UserID:        userID,
			Date:          time.Date(day.Year(), day.Month(), day.Day(), 7, 0, 0, 0, time.Local),
			DurationHours: 6.7 + float64((7-i)%4)*0.25,
			Quality:       stringPtr("Good"),
		})
	}

	measurements = append(measurements,
		models.BodyMeasurement{
			UserID:             userID,
			Date:               now.AddDate(0, 0, -14),
			Weight:             73.4,
			WaistCircumference: 84,
			BodyFatPercentage:  18.2,
		},
		models.BodyMeasurement{
			UserID:             userID,
			Date:               now,
			Weight:             72,
			WaistCircumference: 82.5,
			BodyFatPercentage:  17.4,
		},
	)

	if _, err := db.FoodsCollection.InsertMany(ctx, foods); err != nil {
		return err
	}
	if _, err := db.WaterCollection.InsertMany(ctx, waters); err != nil {
		return err
	}
	if len(exercises) > 0 {
		if _, err := db.ExerciseCollection.InsertMany(ctx, exercises); err != nil {
			return err
		}
	}
	if _, err := db.SleepCollection.InsertMany(ctx, sleeps); err != nil {
		return err
	}
	if _, err := db.BodyMeasurementCollection.InsertMany(ctx, measurements); err != nil {
		return err
	}

	return nil
}

func floatPtr(value float64) *float64 {
	return &value
}

func stringPtr(value string) *string {
	return &value
}
