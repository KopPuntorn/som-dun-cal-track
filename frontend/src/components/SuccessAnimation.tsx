"use client";

import { useEffect, useRef, useCallback } from "react";

type Variant = "food" | "exercise" | "sleep" | "water";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "rect" | "star";
}

const PALETTE: Record<Variant, string[]> = {
  food: ["#82a67d", "#a8d5a2", "#f0c76e", "#e8b84e", "#c5e6c0"],
  exercise: ["#6ea4c8", "#89c4e8", "#4a90b8", "#a0d4f0", "#5fb0d8"],
  sleep: ["#9b7ec8", "#b99de8", "#7a5eb0", "#c4a8f0", "#a380d0"],
  water: ["#4fc3f7", "#29b6f6", "#81d4fa", "#03a9f4", "#b3e5fc"],
};

interface Props {
  trigger: boolean;
  variant: Variant;
  onComplete?: () => void;
}

export default function SuccessAnimation({ trigger, variant, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  const createParticles = useCallback((canvas: HTMLCanvasElement) => {
    const colors = PALETTE[variant];
    const particles: Particle[] = [];
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (let i = 0; i < 45; i++) {
      const angle = (Math.PI * 2 * i) / 45 + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 6;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        shape: (["circle", "rect", "star"] as const)[Math.floor(Math.random() * 3)],
      });
    }
    return particles;
  }, [variant]);

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = createParticles(canvas);
    let frame = 0;
    const maxFrames = 90; // ~1.5s at 60fps

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rotation: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? size : size * 0.4;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const animate = () => {
      if (frame >= maxFrames) {
        cancelAnimationFrame(animRef.current);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onComplete?.();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99; // air resistance
        p.alpha = Math.max(0, 1 - frame / maxFrames);
        p.rotation += p.rotationSpeed;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "rect") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        } else {
          drawStar(ctx, p.x, p.y, p.size, p.rotation);
        }
      }

      ctx.globalAlpha = 1;
      frame++;
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [trigger, createParticles, onComplete]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 10000,
      }}
    />
  );
}
