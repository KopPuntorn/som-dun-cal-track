package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func SafeFloat(p *float64) float64 {
	if p == nil {
		return 0
	}
	return *p
}

func SafeString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// Food represents a single food entry
type Food struct {
	ID           primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID       primitive.ObjectID `json:"userId" bson:"userId"`
	Name         string             `json:"name" bson:"name"`
	Calories     float64            `json:"calories" bson:"calories"`
	Protein      *float64           `json:"protein,omitempty" bson:"protein,omitempty"`
	Fat          *float64           `json:"fat,omitempty" bson:"fat,omitempty"`
	Date         time.Time          `json:"date" bson:"date"`
	MealCategory string             `json:"mealCategory" bson:"mealCategory"` // Breakfast, Lunch, Dinner, Snack
}

// Goals represents the daily target for calories and protein
type Goals struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID    primitive.ObjectID `json:"userId" bson:"userId"`
	Calories  float64            `json:"calories" bson:"calories"`
	Protein   float64            `json:"protein" bson:"protein"`
	Fat       float64            `json:"fat" bson:"fat"`
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
	Onboarded     bool               `json:"onboarded" bson:"onboarded"`
	TourCompleted bool               `json:"tourCompleted" bson:"tourCompleted"`
	LastBriefing     string          `json:"lastBriefing" bson:"lastBriefing"`
	LastBriefingHash string          `json:"lastBriefingHash" bson:"lastBriefingHash"`
	LongTermContext  string          `json:"longTermContext" bson:"longTermContext"`
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
	CaloriesBurned  *float64           `json:"caloriesBurned,omitempty" bson:"caloriesBurned,omitempty"`
}

// SleepRecord represents a user's sleep duration
type SleepRecord struct {
	ID            primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID        primitive.ObjectID `json:"userId" bson:"userId"`
	Date          time.Time          `json:"date" bson:"date"`
	DurationHours float64            `json:"durationHours" bson:"durationHours"`
	Quality       *string            `json:"quality,omitempty" bson:"quality,omitempty"` // Optional: Good, Fair, Poor
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

// ChatMessage represents a single message in a chat session
type ChatMessage struct {
	Role      string    `json:"role" bson:"role"` // user or assistant
	Content   string    `json:"content" bson:"content"`
	Timestamp time.Time `json:"timestamp" bson:"timestamp"`
}

// ChatSession represents a persistent conversation
type ChatSession struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID    primitive.ObjectID `json:"userId" bson:"userId"`
	Title     string             `json:"title" bson:"title"`
	Messages  []ChatMessage      `json:"messages" bson:"messages"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
}
