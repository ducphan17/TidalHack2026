"use client";

import { useMemo } from "react";

const BOKEH_COUNT = 15;

function BokehOrb({
  delay,
  duration,
  x,
  y,
  size,
  opacity,
}: {
  delay: number;
  duration: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
}) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, rgba(255, 255, 255, ${opacity}) 0%, rgba(255, 255, 255, ${opacity * 0.5}) 35%, rgba(255, 255, 255, ${opacity * 0.2}) 55%, transparent 75%)`,
        filter: "blur(24px)",
        animation: `bokeh-float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

export function BokehBackground() {
  const orbs = useMemo(
    () =>
      Array.from({ length: BOKEH_COUNT }, (_, i) => ({
        id: i,
        delay: Math.random() * 10,
        duration: 18 + Math.random() * 25,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 160 + Math.random() * 240,
        opacity: 0.5 + Math.random() * 0.35,
      })),
    []
  );

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {orbs.map((o) => (
        <BokehOrb
          key={o.id}
          delay={o.delay}
          duration={o.duration}
          x={o.x}
          y={o.y}
          size={o.size}
          opacity={o.opacity}
        />
      ))}
    </div>
  );
}
