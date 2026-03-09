package handlers

import (
	"context"
	"encoding/csv"
	"fmt"
	"net/http"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func ExportData(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// We'll export Foods for now. Can be expanded to zip multiple CSVs.
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	userID := c.Get("userID").(primitive.ObjectID)
	cursor, err := db.FoodsCollection.Find(ctx, bson.M{"userId": userID}, opts)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	defer cursor.Close(ctx)

	var foods []models.Food
	if err := cursor.All(ctx, &foods); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	c.Response().Header().Set("Content-Type", "text/csv")
	c.Response().Header().Set("Content-Disposition", "attachment;filename=calorie_tracker_export.csv")

	writer := csv.NewWriter(c.Response().Writer)

	// Write Header
	writer.Write([]string{"Date", "Name", "MealCategory", "Calories", "Protein", "Carbs", "Fat", "Sugar", "Sodium", "Fiber"})

	for _, f := range foods {
		cat := f.MealCategory
		if cat == "" {
			cat = "Uncategorized"
		}
		writer.Write([]string{
			f.Date.Format("2006-01-02 15:04"),
			f.Name,
			cat,
			fmt.Sprintf("%.1f", f.Calories),
			fmt.Sprintf("%.1f", f.Protein),
			fmt.Sprintf("%.1f", f.Carbs),
			fmt.Sprintf("%.1f", f.Fat),
			fmt.Sprintf("%.1f", f.Sugar),
			fmt.Sprintf("%.1f", f.Sodium),
			fmt.Sprintf("%.1f", f.Fiber),
		})
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return nil
}
