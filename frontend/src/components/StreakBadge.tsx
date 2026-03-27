"use client";

import React from "react";
import { motion } from "framer-motion";

interface StreakBadgeProps {
  days: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export default function StreakBadge({ days, label, size = "md" }: StreakBadgeProps) {
  const sizes = {
    sm: { container: 36, font: 14, icon: 12 },
    md: { container: 48, font: 18, icon: 16 },
    lg: { container: 64, font: 24, icon: 20 },
  };

  const s = sizes[size];
  const isHot = days >= 7;
  const isFire = days >= 30;

  const getGradient = () => {
    if (isFire) return "linear-gradient(135deg, #ff6b00, #ff2a55)";
    if (isHot) return "linear-gradient(135deg, #ffd700, #ff8c00)";
    return "linear-gradient(135deg, #10b981, #059669)";
  };

  const getEmoji = () => {
    if (isFire) return "🔥";
    if (isHot) return "⭐";
    return "✨";
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <div
        style={{
          width: s.container,
          height: s.container,
          borderRadius: "50%",
          background: getGradient(),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isFire
            ? "0 0 20px rgba(255, 107, 0, 0.5)"
            : isHot
            ? "0 0 16px rgba(255, 215, 0, 0.4)"
            : "0 0 12px rgba(16, 185, 129, 0.3)",
          position: "relative",
        }}
      >
        <span style={{ fontSize: s.icon, position: "absolute", top: -4, right: -4 }}>
          {getEmoji()}
        </span>
        <span
          style={{
            fontSize: s.font,
            fontWeight: 900,
            color: "#fff",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        >
          {days}
        </span>
      </div>
      {label && (
        <span
          style={{
            fontSize: size === "sm" ? 10 : 11,
            fontWeight: 700,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {label}
        </span>
      )}
    </motion.div>
  );
}
