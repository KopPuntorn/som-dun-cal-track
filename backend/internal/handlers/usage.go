package handlers

import (
	"context"
	"fmt"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
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
	fieldName, limit, err := usageFieldConfig(actionType)
	if err != nil {
		return false, 0, err
	}

	baseFilter := bson.M{"userId": user.ID, "date": today}
	updateOpts := options.FindOneAndUpdate().SetReturnDocument(options.After)

	// Atomic increment for an existing document that is still below the limit.
	var usage models.UserUsage
	err = db.UserUsageCollection.FindOneAndUpdate(
		ctx,
		bson.M{
			"userId": user.ID,
			"date":   today,
			fieldName: bson.M{
				"$lt": limit,
			},
		},
		bson.M{"$inc": bson.M{fieldName: 1}},
		updateOpts,
	).Decode(&usage)
	if err == nil {
		return true, limit - usageCount(usage, actionType), nil
	}
	if err != mongo.ErrNoDocuments {
		return false, 0, err
	}

	err = db.UserUsageCollection.FindOne(ctx, baseFilter).Decode(&usage)
	switch err {
	case nil:
		if usageCount(usage, actionType) >= limit {
			return false, 0, nil
		}

		err = db.UserUsageCollection.FindOneAndUpdate(
			ctx,
			bson.M{
				"userId": user.ID,
				"date":   today,
				fieldName: bson.M{
					"$lt": limit,
				},
			},
			bson.M{"$inc": bson.M{fieldName: 1}},
			updateOpts,
		).Decode(&usage)
		if err == mongo.ErrNoDocuments {
			return false, 0, nil
		}
		if err != nil {
			return false, 0, err
		}
		return true, limit - usageCount(usage, actionType), nil
	case mongo.ErrNoDocuments:
		usage = models.UserUsage{
			UserID:      user.ID,
			Date:        today,
			AIScanCount: 0,
			AIChatCount: 0,
		}
		if actionType == "scan" {
			usage.AIScanCount = 1
		} else {
			usage.AIChatCount = 1
		}

		_, err = db.UserUsageCollection.InsertOne(ctx, usage)
		if err == nil {
			return true, limit - 1, nil
		}
		if !mongo.IsDuplicateKeyError(err) {
			return false, 0, err
		}

		err = db.UserUsageCollection.FindOneAndUpdate(
			ctx,
			bson.M{
				"userId": user.ID,
				"date":   today,
				fieldName: bson.M{
					"$lt": limit,
				},
			},
			bson.M{"$inc": bson.M{fieldName: 1}},
			updateOpts,
		).Decode(&usage)
		if err == mongo.ErrNoDocuments {
			return false, 0, nil
		}
		if err != nil {
			return false, 0, err
		}
		return true, limit - usageCount(usage, actionType), nil
	default:
		return false, 0, err
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

func usageFieldConfig(actionType string) (string, int, error) {
	switch actionType {
	case "scan":
		return "aiScanCount", FreeAIScanLimit, nil
	case "chat":
		return "aiChatCount", FreeAIChatLimit, nil
	default:
		return "", 0, fmt.Errorf("unknown action type: %s", actionType)
	}
}

func usageCount(usage models.UserUsage, actionType string) int {
	if actionType == "scan" {
		return usage.AIScanCount
	}
	return usage.AIChatCount
}
