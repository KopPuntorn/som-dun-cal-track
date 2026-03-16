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

## 🎨 Design Context

### Users
The primary audience for SomDun ranges from **Athletes** to **Casual users** who want to track their nutrition and health metrics with ease. Athletes use it to maintain peak performance through granular tracking (macros, sleep, exercise), while casual users enjoy the gamified, high-performance feel (like the "Athlete Player Card") to stay motivated.

### Brand Personality
SomDun's personality is **High-performance, Sleek, and Energetic**. It feels like a premium sports training app—think Nike Training Club or FIFA Ultimate Team cards. It's built to evoke confidence, focus, and a sense of achievement.

### Aesthetic Direction
The visual tone is **Ultra-Modern Glassmorphism**.
- **Theme:** Dark mode primary (`#050505`) with deep radial gradients.
- **Visuals:** High-contrast typography (`Outfit`), vibrant neon-to-pastel gradients for functional accents (Calories = Orange/Pink, Protein = Sky/Indigo, etc.).
- **Panels:** Semi-transparent glass panels with high blur (24px) and subtle 1px white-alpha borders.
- **Animations:** Dynamic, snappy, and satisfying (3D-like hover effects, animated progress rings, sliding list items).

### Design Principles

1.  **Performance Visualization**: Every metric should feel like a "stat" on a high-end athlete card. Use gradients and progress bars to show progress at a glance.
2.  **Focus on "The Flow"**: Navigation should be effortless, especially for food logging. Use the centralized "+" action for quick entry.
3.  **Ultra-Premium Feel**: Every interaction should feel polished. No raw borders or flat colors. Use transparency, blur, and subtle inner shadows to create depth.
4.  **Vibrant Clarity**: Use distinct, vibrant colors for different macro-nutrients to make the dashboard scannable. Never sacrifice legibility for aesthetics.
5.  **Gamified Achievement**: Celebrate progress through visual feedback (animated rings, success states) to keep users engaged.
