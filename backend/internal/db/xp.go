package db

import (
	"context"
	"time"

	"backend/internal/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	XP_PER_10_CALORIES  = 1
	XP_PER_WATER_GLASS  = 50
	XP_PER_EXERCISE_MIN = 10
	XP_PER_SLEEP_HOUR   = 100
	XP_PER_LEVEL        = 1000
)

// AddUserXP increments user XP and recalculates Level
func AddUserXP(userID primitive.ObjectID, xpAmount int) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Atomic update for XP
	var u models.User
	err := UserCollection.FindOneAndUpdate(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$inc": bson.M{"xp": xpAmount}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&u)

	if err != nil {
		return err
	}

	// Recalculate Level
	newLevel := (u.XP / XP_PER_LEVEL) + 1
	if u.XP < 0 {
		newLevel = 1
	}

	if newLevel != u.Level {
		_, err = UserCollection.UpdateOne(
			ctx,
			bson.M{"_id": userID},
			bson.M{"$set": bson.M{"level": newLevel}},
		)
		return err
	}

	return nil
}

// UpdateUserStreak checks and updates the user's streak based on activity
func UpdateUserStreak(userID primitive.ObjectID) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var u models.User
	err := UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u)
	if err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")

	// If already active today, no need to update
	if u.LastActiveDate == today {
		return nil
	}

	var newStreak int
	if u.LastActiveDate == yesterday {
		// Consecutive day - increment streak
		newStreak = u.StreakDays + 1
	} else if u.LastActiveDate == "" {
		// First activity
		newStreak = 1
	} else {
		// Streak broken - reset to 1
		newStreak = 1
	}

	// Update streak and last active date
	_, err = UserCollection.UpdateOne(
		ctx,
		bson.M{"_id": userID},
		bson.M{"$set": bson.M{
			"streakDays":     newStreak,
			"lastActiveDate": today,
		}},
	)

	return err
}
