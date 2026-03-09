# ⚖️ SomDun (สมดุล) — Smart Calorie & Nutrition Tracker

**SomDun** (meaning "Balance" in Thai) is a modern, intuitive, and feature-rich health tracking application designed to help you maintain a balanced lifestyle. Built with a sleek glassmorphic UI and powered by AI, SomDun makes tracking your nutrition, exercise, and sleep effortless.

---

## 🌟 Key Features

### 🥗 Comprehensive Nutrition Tracking
- **Quick Entry**: Add food items with calories, protein, and fat.
- **Recent Foods**: Quickly re-add your favorite meals from the "Recent" section.
- **Meal Categories**: Organize your intake by Breakfast, Lunch, Dinner, and Snacks.

### 🤖 AI-Powered Health Insights
- **AI Food Scan**: Take a photo of your meal, and let our AI estimate the nutritional values automatically.
- **AI Performance Analyst**: Get detailed historical insights and personalized advice based on your health trends.
- **Barcode & QR Scanner**: Instantly track packaged foods by scanning their labels.

### 🌍 Multi-Language Support
- Full support for **Thai (TH)** and **English (EN)**.
- Toggle languages instantly from the dashboard.

### 🛡️ Secure Authentication
- **Google OAuth**: Fast and secure login with your Google account.
- **Email/Password**: Traditional authentication for multiple user accounts.
- **Persistent Sessions**: Stay logged in securely across sessions.

### 📊 Holistic Health Monitoring
- **Weight Trends**: Log your daily weight and visualize progress.
- **Water Tracker**: Stay hydrated with a visual glass-based goal tracker.
- **Exercise Log**: Track activities and calories burned.
- **Sleep Tracker**: Monitor sleep duration and quality.

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
- **Database**: MongoDB (with primitive.ObjectID support)
- **Authentication**: JWT & Google OAuth 2.0
- **AI Integration**: Google Gemini AI (for food/performance analysis)

---

## 🚀 Getting Started

### Prerequisites
- [Go](https://golang.org/doc/install) 1.20+
- [Node.js](https://nodejs.org/en/download/) 18+
- [MongoDB](https://www.mongodb.com/try/download/community) instance

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/somdun.git
   cd somdun
   ```

2. **Backend Setup**
   ```bash
   cd backend
   # Create a .env file with your MongoDB URI, JWT Secret, and Google AI Key
   # Then run the server:
   go run .
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   # Create a .env.local with your backend API URL and Google Client ID
   npm run dev
   ```

---

## 📱 Screenshots & UI

*(Screenshots of the minimalist dashboard, AI analyst, and language toggle go here)*

---

## 📄 License
This project is for personal tracking and educational purposes. Check the [LICENSE](LICENSE) file for details.

Developed with ❤️ for a healthier world.
