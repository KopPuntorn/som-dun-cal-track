# Security Notes

SomDun uses external services for authentication, database access, and AI features. Treat all keys and connection strings as secrets.

## Local Secrets

- Keep real values in local environment files or deployment environment variables only.
- Use `backend/.env.example` as the template for required backend variables.
- Do not commit real MongoDB connection strings, OAuth client secrets, JWT secrets, Groq API keys, or Stripe keys.

## If A Secret Was Committed

1. Rotate or revoke the exposed key in the provider dashboard.
2. Replace the committed value with a placeholder.
3. Move the real value into local or deployment environment variables.
4. Consider cleaning git history before publishing the repository publicly.

## Pre-Demo Checklist

- Confirm `git diff` does not contain secret values.
- Confirm `.env`, `.env.local`, and deployment config files are ignored or sanitized.
- Run backend and frontend quality checks before sharing a live URL.
