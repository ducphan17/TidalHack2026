"use client";

import { useEffect, useRef } from "react";

const STAR_COUNT = 200;

interface Star {
  x: number;
  y: number;
  radius: number;
  speed: number;
  baseOpacity: number;
  currentOpacity: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      if (starsRef.current.length === 0) {
        starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: Math.random() * 1.5,
          speed: 0.1 + Math.random() * 0.5,
          baseOpacity: Math.random(),
          currentOpacity: Math.random(),
        }));
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.fillStyle = "rgba(119,165,198,0.08)";
      ctx.fillRect(0, 0, w, h);

      for (const star of starsRef.current) {
        star.y += star.speed;
        if (star.y > h) {
          star.y = 0;
          star.x = Math.random() * w;
        }

        star.currentOpacity =
          star.baseOpacity + (Math.random() - 0.5) * 0.3;
        star.currentOpacity = Math.max(0, Math.min(1, star.currentOpacity));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${star.currentOpacity})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "transparent" }}
      aria-hidden
    />
  );
}
