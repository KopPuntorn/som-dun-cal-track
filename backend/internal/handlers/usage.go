package handlers

import (
	"context"
	"fmt"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	FreeAIScanLimit = 3
	FreeAIChatLimit = 5
)

// CheckAndIncrementUsage checks if a user is within limits for a specific action.
// If within limit, increments it. Returns (permitted, remaining, error).
func CheckAndIncrementUsage(ctx context.Context, user models.User, actionType string) (bool, int, error) {
	if user.Tier == "pro" {
		return true, -1, nil // Unlimited
	}

	today := time.Now().Format("2006-01-02")
	filter := bson.M{"userId": user.ID, "date": today}

	// Read current state first to check limit before incrementing
	var usage models.UserUsage
	err := db.UserUsageCollection.FindOne(ctx, filter).Decode(&usage)
	if err != nil {
		usage = models.UserUsage{
			UserID:      user.ID,
			Date:        today,
			AIScanCount: 0,
			AIChatCount: 0,
		}
	}

	if actionType == "scan" {
		if usage.AIScanCount >= FreeAIScanLimit {
			return false, 0, nil
		}
	} else if actionType == "chat" {
		if usage.AIChatCount >= FreeAIChatLimit {
			return false, 0, nil
		}
	} else {
		return false, 0, fmt.Errorf("unknown action type: %s", actionType)
	}

	// We are under limit, now increment it
	update := bson.M{
		"$setOnInsert": bson.M{
			"userId": user.ID,
			"date":   today,
		},
		"$inc": bson.M{},
	}

	if actionType == "scan" {
		update["$inc"].(bson.M)["aiScanCount"] = 1
	} else if actionType == "chat" {
		update["$inc"].(bson.M)["aiChatCount"] = 1
	}

	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)
	err = db.UserUsageCollection.FindOneAndUpdate(ctx, filter, update, opts).Decode(&usage)
	if err != nil {
		return false, 0, err
	}

	if actionType == "scan" {
		return true, FreeAIScanLimit - usage.AIScanCount, nil
	} else {
		return true, FreeAIChatLimit - usage.AIChatCount, nil
	}
}

// GetUserUsage returns current usage
func GetUserUsageState(ctx context.Context, user models.User) (models.UserUsage, error) {
	today := time.Now().Format("2006-01-02")
	var usage models.UserUsage
	err := db.UserUsageCollection.FindOne(ctx, bson.M{"userId": user.ID, "date": today}).Decode(&usage)
	if err != nil {
		return models.UserUsage{
			UserID:      user.ID,
			Date:        today,
			AIScanCount: 0,
			AIChatCount: 0,
		}, nil
	}
	return usage, nil
}
