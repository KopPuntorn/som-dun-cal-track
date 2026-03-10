# ⚙️ SomDun Backend

The backend for SomDun is a robust, scalable service written in **Go (Golang)** using the **Echo** web framework. It follows a clean, layered architecture to ensure maintainability and ease of feature extension.

## 🏗️ Architecture
The project is structured according to the following internal packages:
- **`cmd/api/`**: Contains the `main.go` entry point. Responsible for bootstrapping the application (load env, init DB, setup router).
- **`internal/handlers/`**: Reusable HTTP handlers categorized by domain:
  - `auth.go`: User identity, registration, and JWT issuance (24h expiry).
  - `foods.go`: Core nutrition logging (CRUD).
  - `goals.go`: Nutritional target management.
  - `user.go`: Profile settings.
  - `ai.go`: Integration with Groq API for image-to-nutrition and RAG chat.
  - `health.go`: Secondary health metrics (Water, Weight, Sleep, Exercise).
  - `export.go`: Data portability (CSV export).
- **`internal/models/`**: Centralized MongoDB schemas and shared data types.
- **`internal/db/`**: Database connection management and collection initialization.
- **`internal/routes/`**: Centralized API route registration.
- **`internal/middleware/`**: Cross-cutting concerns like JWT validation and 401/404 handling logic.

## 🚀 Getting Started

1. **Configure Environment**
   Duplicate `.env.example` to `.env` and fill in the values:
   ```env
   PORT=8080
   DATABASE_URL=mongodb://localhost:27017
   JWT_SECRET=your_secret_key
   GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
   GROQ_API_KEY=your_groq_key
   ```

2. **Run the server**
   ```bash
   go run ./cmd/api/main.go
   ```

3. **Build for Production**
   ```bash
   go build -o server ./cmd/api/main.go
   ./server
   ```

## 🛠️ Tech Stack
- **Go 1.20+**
- **Echo v4** (High-performance web framework)
- **MongoDB** (NoSQL database)
- **JWT** (Stateless authentication)
- **Bcrypt** (Secure password hashing)
- **Groq Cloud** (Llama 3/4 LLM support)
