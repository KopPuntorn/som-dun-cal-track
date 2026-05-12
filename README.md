# SomDun

SomDun is a full-stack nutrition and health tracking app built as a personal portfolio project. It combines food logging, barcode nutrition lookup, AI-assisted meal analysis, daily health dashboards, and bilingual UX in a single product.

This project demonstrates practical product engineering across frontend, backend, data modeling, and user experience — not just isolated coding tasks.

## What It Does

- Log meals manually, from saved food templates, or via barcode scan
- Analyze meal photos with AI-powered nutrition estimation (Groq + Llama 4 Scout)
- Track exercise, sleep, hydration, and body measurements
- Get AI-powered daily briefings, 7-day insights, and personalized coaching
- View progress through a gamified player card with XP, streaks, and levels
- Use the app fully in English or Thai

## Demo Account

A seeded demo account is available with 7 days of realistic data:

- **Email:** `demo@somdun.local`
- **Password:** `Demo12345!`

The demo includes pre-populated meals, hydration logs, exercise records, sleep data, body measurements, and configured goals — the dashboard shows useful data immediately.

## Tech Stack

### Frontend

- **Next.js 16** with React 19 and TypeScript
- **SWR** for data fetching with optimistic updates
- **Framer Motion** for micro-animations and transitions
- **Recharts** for trend visualization
- **react-zxing** for barcode scanning
- **Vanilla CSS** with glassmorphism design system

### Backend

- **Go 1.25** with Echo v4 web framework
- **MongoDB** with compound indexes and aggregation pipelines
- **JWT authentication** + Google OAuth
- **Groq API** for AI meal analysis, coaching, and chat
- **Open Food Facts** integration for barcode nutrition lookup

### Infrastructure

- Multi-stage Docker builds for both services
- Docker Compose for local development
- GitHub Actions CI (Go tests + TypeScript type checking)

## Key Features

### 1. Nutrition Logging Flow

Users can add food manually, reuse recent items, or search reusable food templates derived from their own history. The app keeps daily logs separate from reusable templates so repeat meals stay easy to add without polluting search results.

### 2. Barcode Nutrition Autofill

Barcode scans fetch product data from Open Food Facts and map nutrition values into the meal form — calories, macros, sugar, fiber, and sodium — with automatic serving size calculation.

### 3. AI Meal Analysis

Users upload a meal photo and receive structured nutrition estimates powered by Llama 4 Scout via Groq. The pipeline uses chain-of-thought reasoning with a Thai food reference table, math normalization guardrails, and confidence scoring.

### 4. AI Coach & Chat

A context-aware AI coach reads 14 days of behavioral data to generate personalized daily briefings and 7-day insights. Persistent chat sessions allow follow-up conversations with full nutrition context.

### 5. Daily Health Dashboard

The home experience combines nutrition, hydration, activity, sleep, and body data into a single daily workflow with goal tracking, performance rings, trend visibility, and lightweight gamification.

### 6. Bilingual Product UX

Full English and Thai localization across all flows — including AI-generated briefings, coaching copy, and error messages. Language can be switched at any time.

### 7. Player Card & Gamification

XP progression, streak tracking, level-ups with particle effects, and a shareable player card that summarizes the user's health journey.

## Architecture

```text
frontend/
  src/app/            Next.js app routes (home, login, dashboard, ai-chat, profile, player-card)
  src/components/     Reusable UI components (15+ shared, 10 home-specific)
  src/context/        Auth, language, toast providers
  src/translations/   EN/TH localization strings

backend/
  cmd/api/            Server entry point (Echo, CORS, rate limiting)
  cmd/seed_demo/      Demo data seeder
  internal/db/        MongoDB connection, collections, index management
  internal/handlers/  15 handler files (auth, ai, dashboard, food, health, chat, etc.)
  internal/middleware/ JWT auth middleware
  internal/models/    Domain models (User, Food, Goals, Exercise, Sleep, Chat, etc.)
  internal/routes/    Route registration (30+ endpoints)
  internal/trends/    Behavioral trend analysis
```

### API Endpoints

| Area | Endpoints | Description |
|------|-----------|-------------|
| Auth | 3 | Register, login, Google OAuth |
| Food | 6 | CRUD, search, barcode lookup |
| Health | 12 | Water, exercise, sleep, body measurements |
| AI | 4 | Image analysis, goal suggestion, consult, chat |
| Dashboard | 1 | Aggregated daily summary with trends |
| User | 3 | Profile, goals, player card |
| Chat | 5 | Persistent AI conversation sessions |
| Export | 1 | Data export |

## Local Development

### Prerequisites

- Node.js 20+
- Go 1.25+
- MongoDB (local or Atlas)

### Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in your keys:

```bash
cp backend/.env.example backend/.env
```

> **Important:** Generate a strong `JWT_SECRET` — do not use the placeholder value.
> ```bash
> openssl rand -hex 32
> ```

2. Install frontend dependencies:

```bash
cd frontend
npm install
```

### Run

```bash
# Terminal 1 — Backend
cd backend
go run ./cmd/api/main.go

# Terminal 2 — Frontend
cd frontend
npm run dev
```

The app will be available at `http://localhost:3000`.

### Seed Demo Data

```bash
cd backend
go run ./cmd/seed_demo
```

This creates a demo account with 7 days of meals, hydration, exercise, sleep, body measurements, and configured goals.

Override credentials with `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` environment variables.

### Docker

```bash
docker-compose up --build
```

Requires `JWT_SECRET`, `GROQ_API_KEY`, and `GOOGLE_CLIENT_ID` set in your environment or a `.env` file at the project root.

## Quality Checks

CI runs automatically on every push:

- `go test ./...` — backend unit tests
- `npx tsc --noEmit` — frontend type checking

Run locally before pushing:

```bash
cd backend && go test ./...
cd ../frontend && npx tsc --noEmit && npx eslint --quiet
```

## Security

- All secrets are loaded from environment variables — never committed
- JWT tokens expire after 24 hours
- CORS is restricted to configured frontend origins
- Rate limiting at 20 req/s per IP
- Request body limited to 5MB
- See [SECURITY.md](SECURITY.md) for secret rotation procedures

## What I Would Improve Next

- Expand automated test coverage for critical AI and dashboard flows
- Add observability and error reporting for production debugging
- Build a dedicated food template management UI
- Add offline support with service worker caching
- Implement webhook-based Stripe billing for Pro tier

## Notes

This is an actively iterated personal project. The goal is to show how I design and improve a product over time, not just how I ship a one-off demo.
