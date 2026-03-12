package middleware

import (
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
)

// RequestLogger returns a middleware that logs HTTP requests using slog
func RequestLogger() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			err := next(c)
			if err != nil {
				c.Error(err)
			}

			stop := time.Now()
			req := c.Request()
			res := c.Response()

			attrs := []slog.Attr{
				slog.String("method", req.Method),
				slog.String("uri", req.RequestURI),
				slog.Int("status", res.Status),
				slog.String("remote_ip", c.RealIP()),
				slog.Duration("latency", stop.Sub(start)),
				slog.String("user_agent", req.UserAgent()),
			}

			if err != nil {
				attrs = append(attrs, slog.String("error", err.Error()))
				slog.LogAttrs(req.Context(), slog.LevelError, "Request failed", attrs...)
			} else {
				slog.LogAttrs(req.Context(), slog.LevelInfo, "Request processed", attrs...)
			}

			return nil
		}
	}
}
