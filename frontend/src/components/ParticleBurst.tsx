"use client";

import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  scale: number;
  duration: number;
}

interface ParticleBurstProps {
  trigger: number; // Increment to trigger a burst
  originX?: number | string;
  originY?: number | string;
  colors?: string[];
  count?: number;
}

const DEFAULT_COLORS = ["#0ea5e9", "#f43f5e", "#a855f7", "#ffffff"]; // Pro, Cal, Fat (from Neumorphic globals)

export default function ParticleBurst({
  trigger,
  originX = "50%",
  originY = "50%",
  colors = DEFAULT_COLORS,
  count = 12,
}: ParticleBurstProps) {
  const randomFromSeed = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const particles = useMemo<Particle[]>(() => {
    if (trigger === 0) return [];
    const seedBase = trigger * 1000;
    return Array.from({ length: count }).map((_, i) => ({
      id: seedBase + i,
      x: 0,
      y: 0,
      angle: randomFromSeed(seedBase + i) * Math.PI * 2,
      speed: 30 + randomFromSeed(seedBase + i + 1) * 50,
      size: 4 + randomFromSeed(seedBase + i + 2) * 6,
      color: colors[Math.floor(randomFromSeed(seedBase + i + 3) * colors.length)],
      scale: randomFromSeed(seedBase + i + 4) + 0.5,
      duration: 0.6 + randomFromSeed(seedBase + i + 5) * 0.4,
    }));
  }, [trigger, count, colors]);

  if (particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute z-[100]"
      style={{ left: originX, top: originY }}
    >
      <AnimatePresence>
        {particles.map((p) => {
          // Calculate destination
          const destX = Math.cos(p.angle) * p.speed;
          const destY = Math.sin(p.angle) * p.speed;

          return (
            <motion.div
              key={p.id}
              initial={{
                x: 0,
                y: 0,
                opacity: 1,
                scale: 0,
              }}
              animate={{
                x: destX,
                y: destY,
                opacity: 0,
                scale: p.scale,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: p.duration,
                ease: "easeOut",
              }}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
              }}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
