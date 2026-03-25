"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
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
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;

    const newParticles: Particle[] = Array.from({ length: count }).map((_, i) => ({
      id: Date.now() + i,
      x: 0,
      y: 0,
      angle: Math.random() * Math.PI * 2,
      speed: 30 + Math.random() * 50,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setParticles(newParticles);

    // Clean up particles after animation (approx ~800ms)
    const timeout = setTimeout(() => {
      setParticles([]);
    }, 1000);

    return () => clearTimeout(timeout);
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
                scale: Math.random() + 0.5,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.6 + Math.random() * 0.4,
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
