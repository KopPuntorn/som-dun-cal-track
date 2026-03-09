package db

import (
	"context"
	"fmt"
	"log"
	"time"

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

	return nil
}
