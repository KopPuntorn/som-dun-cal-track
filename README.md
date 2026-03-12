# ⚖️ SomDun (สมดุล) — Smart Calorie & Nutrition Tracker

**SomDun** (meaning "Balance" in Thai) is a modern, intuitive, and feature-rich health tracking application designed to help you maintain a balanced lifestyle. Built with a sleek glassmorphic UI and powered by AI, SomDun makes tracking your nutrition, exercise, and sleep effortless.

---

## 🌟 Key Features

### 🥗 Comprehensive Nutrition Tracking
- **Quick Entry**: Add food items with calories, protein, and fat.
- **Recent Foods**: Quickly re-add your favorite meals from the "Recent" section.
- **Meal Categories**: Organize your intake by Breakfast, Lunch, Dinner, and Snacks.

### 🤖 AI-Powered Health Insights
- **AI Food Scan**: Take a photo of your meal (with lightning-fast client-side compression), and let our AI estimate nutritional values automatically.
- **AI Coach & Analyst**: Get personalized advice tailored to your **Health Objective** (Lose Fat, Build Muscle, etc.). Engaging in real-time chat (via SSE) or get deep historical performance analysis.
- **Dynamic Language AI**: The AI coach automatically responds in your selected interface language (**Thai** or **English**).
- **Barcode & QR Scanner**: Instantly track packaged foods by scanning their labels.

### 🌍 Multi-Language Support
- Full support for **Thai (TH)** and **English (EN)**.
- Toggle languages instantly from the dashboard.

### 🛡️ Secure Authentication
- **Google OAuth**: Fast and secure login with your Google account.
- **Email/Password**: Traditional authentication for multiple user accounts.
- **Persistent Sessions & Security**: Stay logged in securely with JWT, featuring automatic logout upon token expiration.

### 📊 Holistic Health Monitoring
- **Personalized Goals**: Set specific objectives during onboarding (e.g., Maintain, Lose Weight, Gain Weight, Build Muscle) to receive context-aware coaching.
- **Body Measurements**: Track waist circumference, body fat percentage, and attach progress photos.
- **Weight Trends**: Log your daily weight and visualize progress with intuitive charts.
- **Water Tracker**: Stay hydrated with a visual glass-based goal tracker.
- **Exercise & Sleep Log**: Track activities, calories burned, sleep duration, and sleep quality.
- **Data Export**: Easily download all your health tracking data as a `.csv` file.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Glassmorphism UI
- **State Management**: React Context (Auth, Language, Toast)
- **Charts**: Recharts
- **Icons**: Lucide-inspired SVG components

### Backend
- **Language**: Go (Golang)
- **Web Framework**: Echo
- **Structure**: Layered Architecture (cmd/api, internal handlers, db, models, routes)
- **Database**: MongoDB
- **Authentication**: JWT & Google OAuth 2.0 (24h token expiry with Auto-Logout)
- **AI Integration**: Groq Cloud API (**OpenAI GPT-OSS 120B** for insights, Llama 4 for vision)

---

## 🚀 Getting Started

### Prerequisites
- [Go](https://golang.org/doc/install) 1.20+
- [Node.js](https://nodejs.org/en/download/) 18+
- [MongoDB](https://www.mongodb.com/try/download/community) instance

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KopPuntorn/som-dun-cal-track
   cd som-dun-cal-track
   ```

2. **Backend Setup**
   ```bash
   cd backend
   # Create a .env file based on .env.example
   # Then run the server:
   go run ./cmd/api/main.go
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Create a .env.local based on .env
   npm run dev
   ```

---

## 📂 Project Structure

### Backend (`/backend`)
- `cmd/api/`: Application entry point.
- `internal/handlers/`: Domain-specific logic (Auth, Food, AI, Health).
- `internal/models/`: Database schemas and data structures.
- `internal/db/`: Database configuration and initialization.
- `internal/routes/`: Centralized API route definitions.
- `internal/middleware/`: JWT and security middleware.

### Frontend (`/frontend`)
- `src/app/`: Next.js pages and layouts.
- `src/context/`: Global states (Auth with 401/404 handling, Language, UI).
- `src/components/`: Reusable UI elements.

---

## 📄 License
This project is for personal tracking and educational purposes. Check the [LICENSE](LICENSE) file for details.

Developed with ❤️ for a healthier world.
