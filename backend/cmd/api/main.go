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

	// Security Middleware
	e.Use(middleware.BodyLimit("5M"))                                       // Max 5MB payload to prevent memory exhaustion
	e.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(20))) // Max 20 requests per second per IP

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		log.Println("FRONTEND_URL not set, falling back to http://localhost:3000")
		frontendURL = "http://localhost:3000"
	}

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{frontendURL},
		AllowMethods: []string{echo.GET, echo.PUT, echo.POST, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		MaxAge:       86400, // Cache preflight requests for 24 hours
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
