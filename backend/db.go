package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var client *mongo.Client
var db *mongo.Database
var foodsCollection *mongo.Collection
var goalsCollection *mongo.Collection
var userCollection *mongo.Collection
var waterCollection *mongo.Collection
var weightCollection *mongo.Collection
var exerciseCollection *mongo.Collection
var sleepCollection *mongo.Collection

func InitDB(connectionString string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var err error
	client, err = mongo.Connect(ctx, options.Client().ApplyURI(connectionString))
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the primary
	err = client.Ping(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	log.Println("Successfully connected to MongoDB!")

	dbName := "calotrack" // Or map from ENV if you want
	db = client.Database(dbName)
	// WIPE DATABASE for transition to multi-user
	log.Println("Wiping database for multi-user transition...")
	_ = db.Drop(ctx)

	foodsCollection = db.Collection("foods")
	goalsCollection = db.Collection("goals")
	userCollection = db.Collection("user")
	waterCollection = db.Collection("water")
	weightCollection = db.Collection("weight")
	exerciseCollection = db.Collection("exercise")
	sleepCollection = db.Collection("sleep")

	return nil
}
