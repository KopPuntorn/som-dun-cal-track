package middleware

import (
	"fmt"
	"net/http"
	"os"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AuthClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

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

		issuer := os.Getenv("JWT_ISSUER")
		audience := os.Getenv("JWT_AUDIENCE")

		claims := AuthClaims{}
		parserOptions := []jwt.ParserOption{
			jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		}
		if issuer != "" {
			parserOptions = append(parserOptions, jwt.WithIssuer(issuer))
		}
		if audience != "" {
			parserOptions = append(parserOptions, jwt.WithAudience(audience))
		}

		token, err := jwt.ParseWithClaims(tokenStr, &claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return []byte(secret), nil
		}, parserOptions...)

		if err != nil || !token.Valid {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
		}
		if claims.UserID == "" {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid user_id in token"})
		}

		userID, err := primitive.ObjectIDFromHex(claims.UserID)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid user_id format"})
		}

		c.Set("userID", userID)
		return next(c)
	}
}
