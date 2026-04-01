package handlers

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"backend/internal/db"
	"backend/internal/models"

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
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

type AuthClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func GenerateJWT(user models.User) (string, error) {
	issuer := os.Getenv("JWT_ISSUER")
	audience := os.Getenv("JWT_AUDIENCE")

	claims := AuthClaims{
		UserID: user.ID.Hex(),
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    issuer,
		},
	}
	if audience != "" {
		claims.Audience = jwt.ClaimStrings{audience}
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET environment variable is not set")
	}
	return token.SignedString([]byte(secret))
}

func RegisterUser(c echo.Context) error {
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
	count, _ := db.UserCollection.CountDocuments(ctx, bson.M{"email": req.Email})
	if count > 0 {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Email already exists"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("Registration failed: password hashing error", "email", req.Email, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}

	newUser := models.User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
		Level:        1,
		Tier:         "free",
	}

	res, err := db.UserCollection.InsertOne(ctx, newUser)
	if err != nil {
		slog.Error("Registration failed: database insertion error", "email", req.Email, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
	}
	newUser.ID = res.InsertedID.(primitive.ObjectID)

	// Init default goals for new user
	db.GoalsCollection.InsertOne(ctx, models.Goals{
		UserID:   newUser.ID,
		Calories: 2000,
		Protein:  150,
		Fat:      70,
	})

	token, _ := GenerateJWT(newUser)
	slog.Info("User registered successfully", "email", newUser.Email, "userID", newUser.ID)
	return c.JSON(http.StatusCreated, AuthResponse{Token: token, User: newUser})
}

func LoginUser(c echo.Context) error {
	var req LoginReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	err := db.UserCollection.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
	if err != nil {
		slog.Warn("Login failed: invalid email", "email", req.Email)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	if user.PasswordHash == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Please login with Google"})
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		slog.Warn("Login failed: password mismatch", "email", req.Email)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	token, _ := GenerateJWT(user)
	slog.Info("User logged in successfully", "email", user.Email, "userID", user.ID)
	return c.JSON(http.StatusOK, AuthResponse{Token: token, User: user})
}

func GoogleLogin(c echo.Context) error {
	var req GoogleLoginReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	clientId := os.Getenv("GOOGLE_CLIENT_ID")
	if clientId == "" || clientId == "PLACEHOLDER" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Google Client ID not configured. Please add it to your .env"})
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	payload, err := idtoken.Validate(ctx, req.Token, clientId)
	if err != nil {
		slog.Warn("Google login failed: invalid token", "error", err)
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Google token"})
	}

	emailValue, ok := payload.Claims["email"]
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Google token"})
	}
	email, ok := emailValue.(string)
	if !ok || email == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid Google token"})
	}
	name, _ := payload.Claims["name"].(string)

	var user models.User
	err = db.UserCollection.FindOne(ctx, bson.M{"email": email}).Decode(&user)

	if err != nil {
		// User doesn't exist, create them
		user = models.User{
			Email:    email,
			Name:     name,
			GoogleID: payload.Subject,
			Level:    1,
			Tier:     "free",
		}
		res, err := db.UserCollection.InsertOne(ctx, user)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
		}
		user.ID = res.InsertedID.(primitive.ObjectID)

		db.GoalsCollection.InsertOne(ctx, models.Goals{
			UserID:   user.ID,
			Calories: 2000,
			Protein:  150,
			Fat:      70,
		})
	} else if user.GoogleID == "" {
		// Link Google ID if email matches
		update := bson.M{"$set": bson.M{"googleId": payload.Subject, "name": name}}
		db.UserCollection.UpdateOne(ctx, bson.M{"_id": user.ID}, update)
		user.GoogleID = payload.Subject
		user.Name = name // Update in memory so GenerateJWT and response are correct
	}

	token, _ := GenerateJWT(user)
	slog.Info("User logged in with Google", "email", user.Email, "userID", user.ID)
	return c.JSON(http.StatusOK, AuthResponse{Token: token, User: user})
}
