"use client";

import React from "react";
import { motion } from "framer-motion";

interface StreakBadgeProps {
  days: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export default function StreakBadge({ days, label, size = "md" }: StreakBadgeProps) {
  const isHot = days >= 7;
  const isFire = days >= 30;

  // Determine color theme based on streak intensity
  const getTheme = () => {
    if (isFire) return { 
      glow: "rgba(239, 68, 68, 0.5)", 
      solid: "#ef4444", 
      light: "#fca5a5",
      accent: "fire" 
    };
    if (isHot) return { 
      glow: "rgba(245, 158, 11, 0.4)", 
      solid: "#f59e0b", 
      light: "#fde68a",
      accent: "hot" 
    };
    return { 
      glow: "rgba(16, 185, 129, 0.3)", 
      solid: "#10b981", 
      light: "#6ee7b7",
      accent: "clean" 
    };
  };

  const theme = getTheme();

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`streak-badge streak-badge--${size} streak-badge--${theme.accent}`}
    >
      <div className="streak-badge-content">
        <div className="streak-badge-visual">
          {/* Layered SVG Flame */}
          <svg viewBox="0 0 24 24" className="streak-flame" fill="none">
            <defs>
              <filter id="flame-blur">
                <feGaussianBlur stdDeviation="1" />
              </filter>
            </defs>
            
            {/* Outer Glow Path */}
            <motion.path
              d="M12 2C12 2 7 6 7 11C7 13.76 9.24 16 12 16C14.76 16 17 13.76 17 11C17 6 12 2 12 2Z"
              fill={theme.glow}
              style={{ filter: "blur(2px)" }}
              animate={isFire ? { scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            
            {/* Main Flame Body */}
            <path
              d="M12 4C12 4 8 7.5 8 11.5C8 13.71 9.79 15.5 12 15.5C14.21 15.5 16 13.71 16 11.5C16 7.5 12 4 12 4Z"
              fill={theme.solid}
            />
            
            {/* Inner "Hot" Core */}
            <motion.path
              d="M12 7C12 7 10 9 10 11.5C10 12.6 10.9 13.5 12 13.5C13.1 13.5 14 12.6 14 11.5C14 9 12 7 12 7Z"
              fill={theme.light}
              animate={isFire ? { opacity: [0.7, 1, 0.7] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          </svg>
        </div>

        <div className="streak-badge-info">
          <span className="streak-count">{days}</span>
          {label && size !== "sm" && <span className="streak-label">{label}</span>}
        </div>
      </div>
    </motion.div>
  );
}
