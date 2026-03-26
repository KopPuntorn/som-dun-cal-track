package handlers

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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

	// Validate extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}
	if !allowedExts[ext] {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid file extension"})
	}

	// Validate content type
	buff := make([]byte, 512)
	if _, err := src.Read(buff); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file for validation"})
	}
	fileType := http.DetectContentType(buff)
	if !strings.HasPrefix(fileType, "image/") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "file is not an image"})
	}
	// Seek back to start of file for copying
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to read file for upload"})
	}

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
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	targetPath := filepath.Join(uploadDir, filename)

	// Destination
	dst, err := os.Create(targetPath)
	if err != nil {
		slog.Error("Upload failed: could not create destination file", "path", targetPath, "error", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create destination file"})
	}
	defer dst.Close()

	// Copy
	if _, err = io.Copy(dst, src); err != nil {
		slog.Error("Upload failed: could not copy file content", "path", targetPath, "error", err)
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
