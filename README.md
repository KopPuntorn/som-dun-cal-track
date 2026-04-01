# ⚖️ SomDun (สมดุล) — Full-Stack AI-Powered Health & Nutrition Ecosystem

**SomDun** is a professional-grade health tracking platform that demonstrates a sophisticated integration of modern web technologies, AI-driven insights, and high-performance backend engineering. Designed with a "Mobile-First" philosophy and a premium glassmorphic aesthetic, it simplifies complex health data into actionable, gamified performance metrics.

---

## 🛠️ Engineering Overview

This project showcases a robust implementation of modern full-stack patterns, focusing on **Performance**, **User Experience**, and **Data Integrity**. Key technical achievements include:
- **Scalable AI Pipeline**: Seamless integration of multi-modal vision models and LLM coaching.
- **High-Concurrency Backend**: A Go/Echo architecture optimized for low-latency API response times.
- **Reactive Frontend**: A cutting-edge Next.js 16 implementation utilizing React 19 features and Framer Motion for premium micro-interactions.

### 🏗️ System Architecture

```mermaid
graph TD
    User((User))
    
    subgraph "Frontend (Next.js 16 + React 19)"
        UI[Glassmorphic UI]
        State[React Context / SWR]
        Worker[Client-side Image Compression]
    end

    subgraph "Edge / Auth"
        Google[Google OAuth 2.0]
        JWT[JWT Middleware]
    end

    subgraph "Backend (Go 1.25 + Echo)"
        API[API Gateway]
        AuthS[Auth Service]
        FoodS[Nutrition Service]
        AIS[AI Proxy Service]
    end

    subgraph "Data & External"
        DB[(MongoDB Atlas)]
        Groq[Groq Cloud API / Llama 3.2]
    end

    User --> UI
    UI --> State
    State --> API
    API --> JWT
    JWT --> AuthS
    AuthS --> Google
    API --> FoodS
    API --> AIS
    FoodS --> DB
    AIS --> Groq
```

---

## 🚀 Technical Highlights & Engineering Challenges

### 1. Multi-Modal AI Pipeline (Vision + LLM)
I implemented a sophisticated AI pipeline that transforms food imagery into structured nutritional intelligence.
- **Challenge**: Passing high-resolution images to the AI models often led to increased latency and potential payload failures on unstable mobile networks.
- **Solution**: Developed a **client-side image processing utility** that performs lightning-fast compression before transmission, reducing payload size by ~80% while maintaining the fidelity required for AI vision accuracy.

### 2. The "Athlete Player Card" Algorithm
A core gamification engine that calculates a dynamic "Performance Rating" (OVR) by aggregating multi-dimensional health data:
- **Nutrition Compliance**: Real-time tracking of macros vs. personalized goals.
- **Hydration Syncing**: Visual tracking of water intake.
- **Recovery Tracking**: Granular sleep and exercise logging.
*Technical Detail*: Utilizes complex MongoDB aggregation pipelines to compute rolling averages and performance trends across time-series health data.

### 3. Backend-Proxied Barcode Engine
To overcome browser-level CORS restrictions and `403 Forbidden` errors from external nutrition databases:
- **Implementation**: Built a custom Go-based proxy service. It intercepts requests from the `react-zxing` frontend component, negotiates with external UPC APIs using server-side headers, and delivers standardized JSON to the client.

### 4. Premium Design System (Serene Balance)
- **Aesthetics**: A fully custom design system using **Vanilla CSS 4** variables to implement a consistent, premium glassmorphic UI.
- **Performance**: Optimized rendering using **React 19 Server Components** and `swr` for efficient data fetching and caching.
- **UX**: An animated "Spotlight Tour" using SVG masking to provide an immersive onboarding experience.

---

## 🧰 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Framer Motion, Recharts, Tailwind 4 |
| **Backend** | Go 1.25, Echo Framework, JWT, Google OAuth 2.0 |
| **Database** | MongoDB Atlas (NoSQL) |
| **AI/ML** | Groq Cloud API (Llama 3.2 Vision, OpenAI GPT-OSS-120B) |
| **Infrastructure** | Docker, GitHub Actions CI/CD |

---

## 📂 Project Structure

```text
├── backend/                # Go (Golang) Microservice
│   ├── cmd/api/            # Application entry point & DI
│   ├── internal/           # Handlers, Models, Repositories (Domain-Driven)
│   └── tests/              # End-to-end integration tests
├── frontend/               # Next.js 16 Web Application
│   ├── src/app/            # App Router, Layouts, & Pages
│   ├── src/components/     # UI Design System
│   └── src/context/        # Global State (Auth, Language, UI)
└── docker-compose.yml      # Containerized orchestration
```

---

## 🏁 Development Setup

### 1. Prerequisites
- **Go** 1.25+ | **Node.js** 20+ | **MongoDB Atlas** account

### 2. Implementation
Clone the repository and configure the environment:
- Create `.env` in `/backend` (see `.env.example`)
- Create `.env.local` in `/frontend`

### 3. Run Locally
```bash
# Backend
cd backend && go run ./cmd/api/main.go

# Frontend
cd frontend && npm run dev
```

---

## ⚖️ Portfolio Context
This project was engineered by **[Your Name]** to demonstrate proficiency in modern full-stack architecture, AI integration, and high-quality UI/UX delivery. It solves real-world technical problems (CORS, data aggregation, AI latency) while providing a premium user experience.

---
Developed with a focus on **Scalability**, **Performance**, and **User Experience**.
