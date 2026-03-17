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
- **AI Coach & Analyst**: Get personalized advice tailored to your **Health Objective** (Lose Fat, Build Muscle, etc.). Now featuring **Strict Language Lockdown** to ensure 100% natural Thai/English responses without character leakage.
- **Improved Barcode Scanner**: Enforced rear-camera usage and state-persistent data fetching from Open Food Facts.
- **Date-Persistent Logging**: Log meals, exercise, and sleep for any specific date using the intuitive date picker.

### 🏆 Dynamic Athlete Player Card
- **Monthly Performance Rating (OVR)**: Your health data is transformed into a sport-style "Player Card".
- **Advanced Scoring**: Monthly ratings are calculated based on:
    - **Nutrition (NUT)**: Calorie and protein adherence consistency.
    - **Hydration (HYD)**: Daily water intake habits.
    - **Fitness (FIT)**: Total activity minutes and calories burned.
    - **Recovery (REC)**: Average sleep duration and quality.
    - **Discipline (DIS)**: Logging consistency.
    - **Endurance (END)**: Exercise frequency and durability.
- **Rarity System**: Earn Bronze, Silver, Emerald, Gold, or Diamond status based on your performance.

### 🌍 Multi-Language Support
- **Dual Language UI**: Toggle between Thai and English instantly.
- **Clean AI Output**: AI responses are strictly filtered to remove non-target symbols (no Chinese or Russian "leaks").

### 🛡️ Secure Authentication
- **Google OAuth**: Fast and secure login with your Google account. (Supports per-account goal tracking).
- **Persistent Sessions**: Stay logged in securely with JWT, featuring automatic logout upon token expiration.

### 📊 Holistic Health Monitoring
- **Personalized Goals**: Set specific objectives during onboarding (e.g., Maintain, Lose Weight, Gain Weight, Build Muscle) to receive context-aware coaching.
- **Weight Trends**: Log your daily weight and visualize progress with intuitive charts.
- **Water Tracker**: Stay hydrated with a visual glass-based goal tracker.
- **Exercise & Sleep Log**: Track activities, calories burned, and sleep (granular hours and minutes tracking).
- **Data Export**: Easily download all your health tracking data as a `.csv` file.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Vanilla CSS with Glassmorphism & High-End Micro-animations
- **State Management**: React Context (Auth, Language, Toast)
- **Charts**: Recharts
- **Barcode Engine**: react-zxing (Optimized for Rear Camera)
- **Typography**: Inter & Outfit (Google Fonts)

### Backend
- **Language**: Go (Golang)
- **Web Framework**: Echo
- **Structure**: Clean Layered Architecture
- **Database**: MongoDB
- **Authentication**: JWT & Google OAuth 2.0 (24h token expiry)
- **AI Integration**: Groq Cloud API (**OpenAI GPT-OSS 120B** for deep insights, Llama 3.2 Vision for image analysis)

---

## 🚀 Getting Started

### Prerequisites
- [Go](https://golang.org/doc/install) 1.22+
- [Node.js](https://nodejs.org/en/download/) 18+
- [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) or local instance

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
   # Required: MONGO_URI, JWT_SECRET, GROQ_API_KEY
   go run ./cmd/api/main.go
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Create a .env.local with NEXT_PUBLIC_API_URL
   npm run dev
   ```

---

## 📂 Project Structure

### Backend (`/backend`)
- `cmd/api/`: Application entry point.
- `internal/handlers/`: Domain-specific logic (Auth, Food, AI, Health).
- `internal/models/`: Database schemas.
- `internal/routes/`: Centralized API routing.

### Frontend (`/frontend`)
- `src/app/`: Next.js pages and layouts.
- `src/context/`: Global states (Auth, Language, UI).
- `src/translations/`: Multi-language string management.

---

## ⚖️ Disclaimer

**SomDun** is an AI-powered tool designed to assist with nutritional awareness and should not be used as a substitute for professional medical advice, diagnosis, or treatment. 

### AI Accuracy Note
AI food recognition systems achieve high accuracy (up to 94%) but can still vary based on image quality, overlapping ingredients, and portion sizes. Always consult with a registered dietitian or healthcare provider before making significant changes to your diet.

---

## 📄 License
This project is for personal tracking and educational purposes. Check the [LICENSE](LICENSE) file for details.

Developed with ❤️ for a healthier world.
