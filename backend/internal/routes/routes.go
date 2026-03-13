package routes

import (
	"backend/internal/handlers"
	"backend/internal/middleware"

	"github.com/labstack/echo/v4"
)

func SetupRoutes(e *echo.Echo) {
	// Auth Routes
	e.POST("/api/auth/register", handlers.RegisterUser)
	e.POST("/api/auth/login", handlers.LoginUser)
	e.POST("/api/auth/google", handlers.GoogleLogin)

	// Protected Data Routes Group
	api := e.Group("/api")
	api.Use(middleware.JWTMiddleware)

	api.GET("/foods", handlers.GetFoods)
	api.GET("/foods/search", handlers.SearchFoods)
	api.POST("/foods", handlers.CreateFood)
	api.PUT("/foods/:id", handlers.UpdateFood)
	api.DELETE("/foods/:id", handlers.DeleteFood)

	api.GET("/goals", handlers.GetGoals)
	api.PUT("/goals", handlers.UpdateGoals)

	api.GET("/user", handlers.GetUserProfile)
	api.PUT("/user", handlers.UpdateUserProfile)

	// Water & Weight
	api.GET("/water", handlers.GetWater)
	api.POST("/water", handlers.UpdateWater)
	api.GET("/weight", handlers.GetWeightHistory)
	api.POST("/weight", handlers.AddWeight)

	// Exercise & Sleep
	api.GET("/exercise", handlers.GetExerciseHistory)
	api.POST("/exercise", handlers.AddExercise)
	api.DELETE("/exercise/:id", handlers.DeleteExercise)

	api.GET("/sleep", handlers.GetSleepHistory)
	api.POST("/sleep", handlers.AddSleep)
	api.DELETE("/sleep/:id", handlers.DeleteSleep)

	// Body Measurements
	api.GET("/measurements", handlers.GetBodyMeasurements)
	api.POST("/measurements", handlers.AddBodyMeasurement)
	api.DELETE("/measurements/:id", handlers.DeleteBodyMeasurement)

	// Uploads
	api.POST("/upload", handlers.UploadImage)

	// Export & AI
	api.GET("/export", handlers.ExportData)
	api.POST("/analyze-image", handlers.AnalyzeImage)
	api.POST("/consult", handlers.ConsultAI)
	api.POST("/chat", handlers.ChatAI)

	// Dashboard
	api.GET("/dashboard/summary", handlers.GetDashboardSummary)

	// Player Card
	api.GET("/player-card", handlers.GetPlayerCard)

	// Chat Sessions
	api.POST("/chat/sessions", handlers.CreateChatSession)
	api.GET("/chat/sessions", handlers.ListChatSessions)
	api.GET("/chat/sessions/:id", handlers.GetChatSession)
	api.DELETE("/chat/sessions/:id", handlers.DeleteChatSession)
}
