package main

import (
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"

	"backend/internal/db"
	appMiddleware "backend/internal/middleware"
	"backend/internal/routes"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
)

func main() {
	// Initialize Structured Logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// Load .env
	_ = godotenv.Load()

	// Initialize Database
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Warn("DATABASE_URL not set, falling back to local MongoDB", "fallback", "mongodb://localhost:27017")
		dbURL = "mongodb://localhost:27017"
	}

	err := db.InitDB(dbURL)
	if err != nil {
		slog.Error("Could not connect to MongoDB", "error", err)
		os.Exit(1)
	}

	// Initialize Echo Server
	e := echo.New()

	// Middleware
	e.Use(appMiddleware.RequestLogger())
	e.Use(echoMiddleware.Recover())

	// Security Middleware
	e.Use(echoMiddleware.BodyLimit("5M"))                                           // Max 5MB payload to prevent memory exhaustion
	e.Use(echoMiddleware.RateLimiter(echoMiddleware.NewRateLimiterMemoryStore(20))) // Max 20 requests per second per IP

	frontendURL := os.Getenv("FRONTEND_URL")
	allowedOrigins := []string{"http://localhost:3000", "http://127.0.0.1:3000"}
	if frontendURL == "" {
		slog.Warn("FRONTEND_URL not set, falling back to localhost-only CORS policy")
	} else {
		for _, origin := range strings.Split(frontendURL, ",") {
			origin = normalizeOrigin(origin)
			if origin != "" {
				allowedOrigins = append(allowedOrigins, origin)
			}
		}
	}

	e.Use(echoMiddleware.CORSWithConfig(echoMiddleware.CORSConfig{
		AllowOriginFunc: func(origin string) (bool, error) {
			normalizedOrigin := normalizeOrigin(origin)
			if normalizedOrigin == "" {
				return true, nil
			}

			for _, allowed := range allowedOrigins {
				if normalizedOrigin == allowed {
					return true, nil
				}
				if allowed == "https://*.vercel.app" && strings.HasPrefix(normalizedOrigin, "https://") && strings.HasSuffix(normalizedOrigin, ".vercel.app") {
					return true, nil
				}
			}

			slog.Warn("Blocked CORS origin", "origin", normalizedOrigin)
			return false, nil
		},
		AllowMethods: []string{echo.GET, echo.PUT, echo.POST, echo.DELETE, echo.OPTIONS},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization},
		MaxAge:       86400, // Cache preflight requests for 24 hours
	}))

	// Setup Routes
	routes.SetupRoutes(e)

	// Health routes for Render/proxies that may probe with GET or HEAD.
	healthHandler := func(c echo.Context) error {
		return c.JSON(200, map[string]string{
			"status":  "online",
			"message": "Calorie Track API is running",
		})
	}
	e.Match([]string{http.MethodGet, http.MethodHead}, "/", healthHandler)
	e.Match([]string{http.MethodGet, http.MethodHead}, "/healthz", healthHandler)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	e.Logger.Fatal(e.Start(":" + port))
}

func normalizeOrigin(raw string) string {
	raw = strings.TrimSpace(strings.TrimRight(raw, "/"))
	if raw == "" {
		return ""
	}

	if strings.Contains(raw, "*") {
		return raw
	}

	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return raw
	}

	return parsed.Scheme + "://" + parsed.Host
}
