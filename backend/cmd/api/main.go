package main

import (
	"log"
	"os"

	"backend/internal/db"
	"backend/internal/routes"

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

	err := db.InitDB(dbURL)
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

	// Setup Routes
	routes.SetupRoutes(e)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	e.Logger.Fatal(e.Start(":" + port))
}
