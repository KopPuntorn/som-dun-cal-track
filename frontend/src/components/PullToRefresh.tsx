"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PullToRefreshProps {
  children: React.ReactNode;
  isRefreshing: boolean;
  pullDistance: number;
  progress: number;
  isReady: boolean;
}

export default function PullToRefresh({
  children,
  isRefreshing,
  pullDistance,
  progress,
  isReady,
}: PullToRefreshProps) {
  return (
    <div style={{ position: "relative", height: "100%" }}>
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: `${Math.max(pullDistance, isRefreshing ? 50 : 0)}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            <motion.div
              animate={{
                rotate: isRefreshing ? 360 : progress * 180,
                scale: isRefreshing ? 1 : 0.8 + progress * 0.2,
              }}
              transition={
                isRefreshing
                  ? { duration: 1, repeat: Infinity, ease: "linear" }
                  : { duration: 0 }
              }
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                border: "2px solid transparent",
                borderTopColor: isReady ? "var(--accent-pro)" : "var(--text-secondary)",
                borderRightColor: isReady ? "var(--accent-pro)" : "var(--text-secondary)",
                opacity: isRefreshing ? 1 : 0.3 + progress * 0.7,
              }}
            />
            {isRefreshing && (
              <motion.span
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  position: "absolute",
                  bottom: -24,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                Refreshing...
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isRefreshing ? "transform 0.3s ease" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
