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

// Handlers for User Profile
func GetUserProfile(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	var u models.User
	err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User profile not found"})
	}

	// Get current usage limits
	usage, _ := GetUserUsageState(ctx, u)

	response := struct {
		models.User `bson:",inline"`
		Usage       models.UserUsage `json:"usage"`
	}{
		User:  u,
		Usage: usage,
	}

	return c.JSON(http.StatusOK, response)
}

func MockUpgrade(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	_, err := db.UserCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$set": bson.M{"tier": "pro"}})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "upgrade failed"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Upgraded to Pro!"})
}

func MockDowngrade(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	userID := c.Get("userID").(primitive.ObjectID)
	_, err := db.UserCollection.UpdateOne(ctx, bson.M{"_id": userID}, bson.M{"$set": bson.M{"tier": "free"}})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "downgrade failed"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Downgraded to Free!"})
}

func UpdateUserProfile(c echo.Context) error {
	var u models.User
	if err := c.Bind(&u); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{"$set": bson.M{}}

	// Dynamically build the set map based on what's provided
	// Handle strings
	if u.Name != "" {
		update["$set"].(bson.M)["name"] = u.Name
	}
	if u.Sex != "" {
		update["$set"].(bson.M)["sex"] = u.Sex
	}
	if u.DietaryPreferences != "" {
		update["$set"].(bson.M)["dietaryPreferences"] = u.DietaryPreferences
	}
	if u.Allergies != "" {
		update["$set"].(bson.M)["allergies"] = u.Allergies
	}
	if u.FoodDislikes != "" {
		update["$set"].(bson.M)["foodDislikes"] = u.FoodDislikes
	}
	if u.TonePreference != "" {
		update["$set"].(bson.M)["tonePreference"] = u.TonePreference
	}

	// Handle numeric values (only update if > 0 to avoid zeroing out during partial updates)
	if u.Age > 0 {
		update["$set"].(bson.M)["age"] = u.Age
	}
	if u.Weight > 0 {
		update["$set"].(bson.M)["weight"] = u.Weight
	}
	if u.Height > 0 {
		update["$set"].(bson.M)["height"] = u.Height
	}

	// Only update flags if they are explicitly sent in the payload (optional safety)
	// For now, these flags are rarely updated from settings, but if sent, we keep them.
	if u.Onboarded {
		update["$set"].(bson.M)["onboarded"] = u.Onboarded
	}
	if u.TourCompleted {
		update["$set"].(bson.M)["tourCompleted"] = u.TourCompleted
	}
	// Always allow updating LongTermContext even if empty (user might want to clear it)
	update["$set"].(bson.M)["longTermContext"] = u.LongTermContext

	userID := c.Get("userID").(primitive.ObjectID)
	var updatedUser models.User
	err := db.UserCollection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": userID},
		update,
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&updatedUser)

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, updatedUser)
}
