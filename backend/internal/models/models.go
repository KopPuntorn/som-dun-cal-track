package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Food represents a single food entry
type Food struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID       primitive.ObjectID `json:"userId" bson:"userId"`
	Name         string             `json:"name" bson:"name"`
	Calories     float64            `json:"calories" bson:"calories"`
	Protein      float64            `json:"protein" bson:"protein"`
	Carbs        float64            `json:"carbs" bson:"carbs"`
	Fat          float64            `json:"fat" bson:"fat"`
	Sugar        float64            `json:"sugar" bson:"sugar"`
	Sodium       float64            `json:"sodium" bson:"sodium"`
	Fiber        float64            `json:"fiber" bson:"fiber"`
	Date         time.Time          `json:"date" bson:"date"`
	MealCategory string             `json:"mealCategory" bson:"mealCategory"` // Breakfast, Lunch, Dinner, Snack
}

// Goals represents the daily target for calories and protein
type Goals struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID    primitive.ObjectID `json:"userId" bson:"userId"`
	Calories  float64            `json:"calories" bson:"calories"`
	Protein   float64            `json:"protein" bson:"protein"`
	Carbs     float64            `json:"carbs" bson:"carbs"`
	Fat       float64            `json:"fat" bson:"fat"`
	Sugar     float64            `json:"sugar" bson:"sugar"`
	Sodium    float64            `json:"sodium" bson:"sodium"`
	Fiber     float64            `json:"fiber" bson:"fiber"`
	Objective string             `json:"objective" bson:"objective"` // lose_fat, lose_weight, gain_weight, build_muscle, maintain
}

// User represents authenticated user and their personal profile
type User struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	Email        string             `json:"email" bson:"email"`
	PasswordHash string             `json:"-" bson:"passwordHash,omitempty"`
	GoogleID     string             `json:"googleId,omitempty" bson:"googleId,omitempty"`
	Name         string             `json:"name" bson:"name"`
	Age          int                `json:"age" bson:"age"`
	Weight       float64            `json:"weight" bson:"weight"`
	Height       float64            `json:"height" bson:"height"`
	Sex          string             `json:"sex" bson:"sex"`
	Onboarded    bool               `json:"onboarded" bson:"onboarded"`
}

// WaterIntake represents amount of water consumed on a specific date
type WaterIntake struct {
	ID      primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID  primitive.ObjectID `json:"userId" bson:"userId"`
	Date    string             `json:"date" bson:"date"` // stored as YYYY-MM-DD
	Glasses int                `json:"glasses" bson:"glasses"`
}

// WeightRecord represents a user's weight on a specific date
type WeightRecord struct {
	ID     primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID primitive.ObjectID `json:"userId" bson:"userId"`
	Date   time.Time          `json:"date" bson:"date"`
	Weight float64            `json:"weight" bson:"weight"`
}

// ExerciseRecord represents a user's physical activity
type ExerciseRecord struct {
	ID              primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID          primitive.ObjectID `json:"userId" bson:"userId"`
	Date            time.Time          `json:"date" bson:"date"`
	Name            string             `json:"name" bson:"name"`
	DurationMinutes int                `json:"durationMinutes" bson:"durationMinutes"`
	CaloriesBurned  float64            `json:"caloriesBurned" bson:"caloriesBurned"`
}

// SleepRecord represents a user's sleep duration
type SleepRecord struct {
	ID            primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID        primitive.ObjectID `json:"userId" bson:"userId"`
	Date          time.Time          `json:"date" bson:"date"`
	DurationHours float64            `json:"durationHours" bson:"durationHours"`
	Quality       string             `json:"quality" bson:"quality"` // Optional: Good, Fair, Poor
}

// BodyMeasurement represents a user's body metrics and progress photos
type BodyMeasurement struct {
	ID                  primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID              primitive.ObjectID `json:"userId" bson:"userId"`
	Date                time.Time          `json:"date" bson:"date"`
	Weight              float64            `json:"weight" bson:"weight"`
	WaistCircumference  float64            `json:"waistCircumference" bson:"waistCircumference"`
	BodyFatPercentage   float64            `json:"bodyFatPercentage" bson:"bodyFatPercentage"`
	ProgressPhotoURL    string             `json:"progressPhotoUrl,omitempty" bson:"progressPhotoUrl,omitempty"`
}
