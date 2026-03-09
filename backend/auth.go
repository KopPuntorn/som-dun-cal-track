package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/api/idtoken"
)

type RegisterReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type LoginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type GoogleLoginReq struct {
	Token string `json:"token"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

func generateJWT(user User) (string, error) {
	claims := jwt.MapClaims{
		"user_id": user.ID.Hex(),
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "default-secret-key-change-me"
	}
	return token.SignedString([]byte(secret))
}

func registerUser(c echo.Context) error {
	var req RegisterReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	if req.Email == "" || req.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Email and password required"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Check if email exists
	count, _ := userCollection.CountDocuments(ctx, bson.M{"email": req.Email})
	if count > 0 {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Email already exists"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}

	newUser := User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
	}

	res, err := userCollection.InsertOne(ctx, newUser)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
	}
	newUser.ID = res.InsertedID.(primitive.ObjectID)

	// Init default goals for new user
	goalsCollection.InsertOne(ctx, Goals{
		UserID:   newUser.ID,
		Calories: 2000,
		Protein:  150,
		Fat:      70,
	})

	token, _ := generateJWT(newUser)
	return c.JSON(http.StatusCreated, AuthResponse{Token: token, User: newUser})
}

func loginUser(c echo.Context) error {
	var req LoginReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user User
	err := userCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	if user.PasswordHash == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Please login with Google"})
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	token, _ := generateJWT(user)
	return c.JSON(http.StatusOK, AuthResponse{Token: token, User: user})
}

func googleLogin(c echo.Context) error {
	var req GoogleLoginReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	clientId := os.Getenv("GOOGLE_CLIENT_ID")
	if clientId == "" || clientId == "PLACEHOLDER" {
		// Mock bypass for frontend testing without a real Client ID
		if req.Token == "MOCK_GOOGLE_TOKEN_123" {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			email := "mock-user@gmail.com"
			var user User
			err := userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
			if err != nil {
				user = User{
					Email:    email,
					Name:     "Mock Google User",
					GoogleID: "mock-google-id-123456",
				}
				res, _ := userCollection.InsertOne(ctx, user)
				user.ID = res.InsertedID.(primitive.ObjectID)
				goalsCollection.InsertOne(ctx, Goals{
					UserID: user.ID, Calories: 2000, Protein: 150, Fat: 70,
				})
			}
			token, _ := generateJWT(user)
			return c.JSON(http.StatusOK, AuthResponse{Token: token, User: user})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Google Client ID not configured. Please add it to your .env"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payload, err := idtoken.Validate(ctx, req.Token, clientId)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Google token"})
	}

	email := payload.Claims["email"].(string)
	name, _ := payload.Claims["name"].(string)

	var user User
	err = userCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)

	if err != nil {
		// User doesn't exist, create them
		user = User{
			Email:    email,
			Name:     name,
			GoogleID: payload.Subject,
		}
		res, err := userCollection.InsertOne(ctx, user)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
		}
		user.ID = res.InsertedID.(primitive.ObjectID)

		goalsCollection.InsertOne(ctx, Goals{
			UserID:   user.ID,
			Calories: 2000,
			Protein:  150,
			Fat:      70,
		})
	} else if user.GoogleID == "" {
		// Link Google ID if email matches
		update := bson.M{"$set": bson.M{"googleId": payload.Subject, "name": name}}
		userCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, update)
		user.GoogleID = payload.Subject
	}

	token, _ := generateJWT(user)
	return c.JSON(http.StatusOK, AuthResponse{Token: token, User: user})
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
			secret = "default-secret-key-change-me"
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
