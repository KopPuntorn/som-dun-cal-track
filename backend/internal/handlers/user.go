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

	return c.JSON(http.StatusOK, u)
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
	if u.Name != "" { update["$set"].(bson.M)["name"] = u.Name }
	if u.Sex != "" { update["$set"].(bson.M)["sex"] = u.Sex }
	
	// Handle numeric values (only update if > 0 to avoid zeroing out during partial updates)
	if u.Age > 0 { update["$set"].(bson.M)["age"] = u.Age }
	if u.Weight > 0 { update["$set"].(bson.M)["weight"] = u.Weight }
	if u.Height > 0 { update["$set"].(bson.M)["height"] = u.Height }
	
	// Only update flags if they are explicitly sent in the payload (optional safety)
	// For now, these flags are rarely updated from settings, but if sent, we keep them.
	if u.Onboarded {
		update["$set"].(bson.M)["onboarded"] = u.Onboarded
	}
	if u.TourCompleted {
		update["$set"].(bson.M)["tourCompleted"] = u.TourCompleted
	}

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
