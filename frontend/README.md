# 🎨 SomDun Frontend

The frontend for SomDun is a high-performance, responsive web application built with **Next.js 14** and **Tailwind CSS**, featuring a premium glassmorphic design and intuitive user experience.

## ✨ Key Features
- **Glassmorphic UI**: A modern, sleek design with subtle glows and transparency.
- **Dynamic Dashboard**: Real-time tracking of calories, macro-nutrients, and health goals.
- **Dynamic Athlete Player Card**: Sport-style performance visualization with monthly OVR ratings.
- **Interactive Charts**: Progress visualization using Recharts.
- **AI Coach & Persistent Chat**: Integrated AI consulting with chat history support.
- **AI Food Analysis**: One-click food recognition from images.
- **Improved Health Logging**: Granular sleep duration (hours/minutes) and exercise tracking.
- **Multilingual**: Instant toggle between Thai and English.
- **Automatic Session Handling**: Intelligent 401/404 interceptors for secure auto-logout.

## 🛠️ Developed With
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Lucide React** (Icons)
- **Date-fns** (Time management)
- **React OAuth/Google** (Authentication)

## 🚀 Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Create a `.env.local` file in this directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   ```

3. **Run for development**
   ```bash
   npm run dev
   ```

## 🏗️ Build for Production
```bash
npm run build
npm start
```
