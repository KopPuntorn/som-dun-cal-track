package main

import (
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	// Load .env
	_ = godotenv.Load()

	// Initialize Database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Println("DATABASE_URL not set, falling back to local MongoDB: mongodb://localhost:27017")
		dbURL = "mongodb://localhost:27017"
	}

	err := InitDB(dbURL)
	if err != nil {
		log.Fatalf("Warning: Could not connect to MongoDB: %v", err)
	}

	// Initialize Echo Server
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"}, // Allow all origins for the prototype
		AllowMethods: []string{echo.GET, echo.PUT, echo.POST, echo.DELETE},
	}))

	// Auth Routes
	e.POST("/api/auth/register", registerUser)
	e.POST("/api/auth/login", loginUser)
	e.POST("/api/auth/google", googleLogin)

	// Protected Data Routes Group
	api := e.Group("/api")
	api.Use(JWTMiddleware)

	api.GET("/foods", getFoods)
	api.POST("/foods", createFood)
	api.PUT("/foods/:id", updateFood)
	api.DELETE("/foods/:id", deleteFood)

	api.GET("/goals", getGoals)
	api.PUT("/goals", updateGoals)

	api.GET("/user", getUserProfile)
	api.PUT("/user", updateUserProfile)

	// Water & Weight
	api.GET("/water", getWater)
	api.POST("/water", updateWater)
	api.GET("/weight", getWeightHistory)
	api.POST("/weight", addWeight)

	// Exercise & Sleep
	api.GET("/exercise", getExerciseHistory)
	api.POST("/exercise", addExercise)
	api.DELETE("/exercise/:id", deleteExercise)

	api.GET("/sleep", getSleepHistory)
	api.POST("/sleep", addSleep)
	api.DELETE("/sleep/:id", deleteSleep)

	// Export & AI
	api.GET("/export", exportData)
	api.POST("/analyze-image", analyzeImage)
	api.POST("/consult", consultAI)
	api.POST("/chat", chatAI)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	e.Logger.Fatal(e.Start(":" + port))
}
