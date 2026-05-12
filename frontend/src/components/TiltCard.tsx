"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MotionStyle, MotionValue } from "framer-motion";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number; // Maximum tilt angle in degrees
  intensity?: number; // How "snappy" the spring is
  glareOpacity?: number; // Max opacity of the glare
}

type TiltCardMotionStyle = MotionStyle & {
  "--x"?: MotionValue<string>;
  "--y"?: MotionValue<string>;
};

export default function TiltCard({
  children,
  className = "",
  style = {},
  maxTilt = 15,
  intensity = 400,
  glareOpacity = 0.3,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Mouse position relative to center of card (-1 to 1)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for rotation
  const mouseXSpring = useSpring(x, { stiffness: intensity, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: intensity, damping: 30 });

  // Transform values into rotation angles
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [-maxTilt, maxTilt]);

  // Transform values for Glare effect (translates mouse position to background position)
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);
  const cssX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const cssY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareBackground = useTransform(
    [glareX, glareY],
    ([x, y]) => `radial-gradient(farthest-corner at ${x}% ${y}%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 60%)`
  );
  const motionStyle: TiltCardMotionStyle = {
    ...style,
    rotateX,
    rotateY,
    transformStyle: "preserve-3d",
    // Pass mouse position to children via CSS variables
    "--x": cssX,
    "--y": cssY,
  };

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    
    // Calculate distance from center (normalized to -0.5 to 0.5)
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / rect.width - 0.5;
    const yPct = mouseY / rect.height - 0.5;
    
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Reset to center smoothly
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={motionStyle}
      className={`relative overflow-hidden ${className}`}
      // Spring bounce on tap/click
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {/* Glare Layer */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-50 rounded-inherit"
        style={{
          opacity: isHovered ? glareOpacity : 0,
          background: glareBackground,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Holographic Foil Layer */}
      <div 
        className={`holographic-foil ${isHovered ? 'holographic-foil--active' : ''}`}
        style={{
          backgroundPosition: `var(--x) var(--y)`,
        }}
      />
      
      {/* Content wrapper with perspective translation */}
      <div 
        style={{ transform: 'translateZ(0px)', transformStyle: "preserve-3d" }}
        className="h-full w-full relative z-10"
      >
        {children}
      </div>
    </motion.div>
  );
}
