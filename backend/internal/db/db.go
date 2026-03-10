package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client
var DB *mongo.Database
var FoodsCollection *mongo.Collection
var GoalsCollection *mongo.Collection
var UserCollection *mongo.Collection
var WaterCollection *mongo.Collection
var WeightCollection *mongo.Collection
var ExerciseCollection *mongo.Collection
var SleepCollection *mongo.Collection

func InitDB(connectionString string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var err error
	Client, err = mongo.Connect(ctx, options.Client().ApplyURI(connectionString))
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the primary
	err = Client.Ping(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	log.Println("Successfully connected to MongoDB!")

	dbName := "calotrack" // Or map from ENV if you want
	DB = Client.Database(dbName)

	FoodsCollection = DB.Collection("foods")
	GoalsCollection = DB.Collection("goals")
	UserCollection = DB.Collection("user")
	WaterCollection = DB.Collection("water")
	WeightCollection = DB.Collection("weight")
	ExerciseCollection = DB.Collection("exercise")
	SleepCollection = DB.Collection("sleep")

	EnsureIndexes()

	return nil
}

func EnsureIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use background indexing to not block startup if the DB is huge, but for this app it's fine.
	indexOpts := options.Index().SetBackground(true)

	// UserCollection: Unique email
	_, err := UserCollection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true).SetBackground(true),
	})
	if err != nil {
		log.Printf("Warning: Failed to create User email index: %v", err)
	}

	// FoodsCollection: UserID + Date (Descending) for fast daily aggregate queries
	_, err = FoodsCollection.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: -1}},
		Options: indexOpts,
	})
	if err != nil {
		log.Printf("Warning: Failed to create Foods index: %v", err)
	}

	// Water, Weight, Exercise, Sleep - user+date indexes for fast queries
	collections := []*mongo.Collection{WaterCollection, WeightCollection, ExerciseCollection, SleepCollection}
	for _, coll := range collections {
		_, err = coll.Indexes().CreateOne(ctx, mongo.IndexModel{
			Keys:    bson.D{{Key: "userId", Value: 1}, {Key: "date", Value: -1}},
			Options: indexOpts,
		})
		if err != nil {
			log.Printf("Warning: Failed to create index on %s: %v", coll.Name(), err)
		}
	}

	log.Println("MongoDB indexes verified.")
}
