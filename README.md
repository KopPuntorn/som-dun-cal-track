# SomDun

SomDun is a full-stack nutrition and health tracking app built as a personal portfolio project. It combines food logging, barcode nutrition lookup, AI-assisted meal analysis, daily health dashboards, and bilingual UX in a single product.

This project is meant to demonstrate practical product engineering across frontend, backend, data modeling, and user experience rather than just isolated coding tasks.

## What It Does

- Log meals manually or from saved food templates
- Search food history without duplicate clutter
- Scan barcodes and autofill nutrition data
- Analyze meal photos with AI-assisted nutrition estimation
- Track exercise, sleep, hydration, and body measurements
- View daily progress, trends, and a gamified player card
- Use the app in English or Thai

## Why This Project Is Useful In A Portfolio

SomDun demonstrates:

- End-to-end product thinking across UX, API design, and data flow
- Real-world CRUD and time-series tracking patterns
- External API integration for barcode nutrition data
- AI-assisted product features beyond a simple chat wrapper
- Ongoing refactors to improve data quality, including reusable food templates and normalized search
- A production-minded stack with typed frontend code and backend tests

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- SWR
- Framer Motion
- Recharts

### Backend

- Go 1.25
- Echo
- MongoDB
- JWT authentication
- Google OAuth

### AI And Integrations

- AI meal analysis pipeline
- Open Food Facts barcode lookup

## Key Features

### 1. Nutrition Logging Flow

Users can add food manually, reuse recent items, or search reusable food templates derived from their own history. The app keeps daily logs separate from reusable templates so repeat meals stay easy to add without polluting search results.

### 2. Barcode Nutrition Autofill

Barcode scans fetch product data and map nutrition values into the meal form, including calories, macros, sugar, fiber, and sodium.

### 3. AI-Assisted Meal Analysis

Users can upload a meal photo and receive structured nutrition estimates that can be edited before saving.

### 4. Daily Health Dashboard

The home experience combines nutrition, hydration, activity, sleep, and body data into a single daily workflow with trend visibility and lightweight gamification.

### 5. Bilingual Product UX

The interface supports both English and Thai and includes localized product copy for core flows.

## Architecture Overview

```text
frontend/
  src/app/          Next.js app routes and pages
  src/components/   UI components
  src/context/      Auth, language, toast, and shared state

backend/
  cmd/api/          API entry point
  internal/db/      Mongo setup and indexes
  internal/handlers API handlers
  internal/models/  Domain models
  internal/routes/  Route registration
```

## Local Development

### Prerequisites

- Node.js 20+
- Go 1.25+
- MongoDB

### Setup

1. Create `backend/.env` from `backend/.env.example`
2. Create the required frontend env file
3. Install frontend dependencies

```bash
cd frontend
npm install
```

### Run The App

```bash
# backend
cd backend
go run ./cmd/api/main.go

# frontend
cd frontend
npm run dev
```

## Quality Checks

The repository includes CI checks for:

- `go test ./...` in the backend
- `npx tsc --noEmit` in the frontend

## Demo

Add your deployed demo URL here before sharing this project in job applications.

Suggested format:

- Frontend: `https://your-frontend-url`
- Backend: `https://your-api-url`

## Screenshots To Add Before Applying

Recommended screenshots or GIFs:

- Login / onboarding
- Home dashboard
- Barcode scan or AI meal analysis
- Analytics or player card
- Profile / goals settings

## What I Would Improve Next

- Add stronger automated test coverage for critical flows
- Add a polished live demo with seeded portfolio data
- Add observability and error reporting for production debugging
- Add dedicated food template management UI

## Notes

This is an actively iterated personal project. The goal is to show how I design and improve a product over time, not just how I ship a one-off demo.
