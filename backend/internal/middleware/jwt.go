package middleware

import (
	"fmt"
	"net/http"
	"os"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// JWTMiddleware creates a middleware to protect routes
func JWTMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authHeader := c.Request().Header.Get("Authorization")
		if authHeader == "" || len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Missing or invalid token"})
		}

		tokenStr := authHeader[7:]
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "JWT_SECRET not configured"})
		}

		token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token claims"})
		}

		userIDStr, ok := claims["user_id"].(string)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid user_id in token"})
		}

		userID, err := primitive.ObjectIDFromHex(userIDStr)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid user_id format"})
		}

		c.Set("userID", userID)
		return next(c)
	}
}
