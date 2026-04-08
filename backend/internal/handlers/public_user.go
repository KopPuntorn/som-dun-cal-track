package handlers

import (
	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type PublicUserResponse struct {
	ID                 primitive.ObjectID `json:"id"`
	Email              string             `json:"email"`
	Name               string             `json:"name"`
	Age                int                `json:"age"`
	Weight             float64            `json:"weight"`
	Height             float64            `json:"height"`
	Sex                string             `json:"sex"`
	Onboarded          bool               `json:"onboarded"`
	TourCompleted      bool               `json:"tourCompleted"`
	LongTermContext    string             `json:"longTermContext"`
	DietaryPreferences string             `json:"dietaryPreferences"`
	Allergies          string             `json:"allergies"`
	FoodDislikes       string             `json:"foodDislikes"`
	TonePreference     string             `json:"tonePreference"`
	XP                 int                `json:"xp"`
	Level              int                `json:"level"`
	StreakDays         int                `json:"streakDays"`
	LastActiveDate     string             `json:"lastActiveDate"`
	Tier               string             `json:"tier"`
}

func buildPublicUserResponse(user models.User) PublicUserResponse {
	return PublicUserResponse{
		ID:                 user.ID,
		Email:              user.Email,
		Name:               user.Name,
		Age:                user.Age,
		Weight:             user.Weight,
		Height:             user.Height,
		Sex:                user.Sex,
		Onboarded:          user.Onboarded,
		TourCompleted:      user.TourCompleted,
		LongTermContext:    user.LongTermContext,
		DietaryPreferences: user.DietaryPreferences,
		Allergies:          user.Allergies,
		FoodDislikes:       user.FoodDislikes,
		TonePreference:     user.TonePreference,
		XP:                 user.XP,
		Level:              user.Level,
		StreakDays:         user.StreakDays,
		LastActiveDate:     user.LastActiveDate,
		Tier:               user.Tier,
	}
}
