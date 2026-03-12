package handlers

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/labstack/echo/v4"
)

// UploadImage handles file uploads for progress photos and other images
func UploadImage(c echo.Context) error {
	// Read file
	file, err := c.FormFile("image")
	if err != nil {
		slog.Warn("Upload failed: image file missing", "error", err)
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "image file is required"})
	}

	src, err := file.Open()
	if err != nil {
		slog.Error("Upload failed: could not open source file", "filename", file.Filename, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to open image"})
	}
	defer src.Close()

	// Ensure uploads directory exists
	uploadDir := "uploads"
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		slog.Info("Creating uploads directory")
		err = os.MkdirAll(uploadDir, os.ModePerm)
		if err != nil {
			slog.Error("Failed to create upload directory", "error", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create upload directory"})
		}
	}

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg" // default extension if none provided
	}
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	filepath := filepath.Join(uploadDir, filename)

	// Destination
	dst, err := os.Create(filepath)
	if err != nil {
		slog.Error("Upload failed: could not create destination file", "path", filepath, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create destination file"})
	}
	defer dst.Close()

	// Copy
	if _, err = io.Copy(dst, src); err != nil {
		slog.Error("Upload failed: could not copy file content", "path", filepath, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save image"})
	}

	// Return the accessible URL
	imageURL := fmt.Sprintf("/uploads/%s", filename)
	slog.Info("Image uploaded successfully", "filename", filename, "url", imageURL)
	return c.JSON(http.StatusOK, map[string]string{
		"message": "uploaded successfully",
		"url":     imageURL,
	})
}
