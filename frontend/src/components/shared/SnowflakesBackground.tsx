"use client";

import { useState, useEffect } from "react";

const FLAKE_COUNT = 40;

function Snowflake({ delay, duration, x, size }: { delay: number; duration: number; x: number; size: number }) {
  return (
    <div
      className="absolute rounded-full bg-white/60 dark:bg-white/40 pointer-events-none"
      style={{
        left: `${x}%`,
        width: `${size}px`,
        height: `${size}px`,
        animation: `float ${duration}s linear infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  );
}

export function SnowflakesBackground() {
  const [flakes, setFlakes] = useState<Array<{ id: number; delay: number; duration: number; x: number; size: number }>>([]);

  useEffect(() => {
    setFlakes(
      Array.from({ length: FLAKE_COUNT }, (_, i) => ({
        id: i,
        delay: Math.random() * 15,
        duration: 8 + Math.random() * 12,
        x: Math.random() * 100,
        size: 2 + Math.random() * 4,
      }))
    );
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {flakes.map((f) => (
        <Snowflake
          key={f.id}
          delay={f.delay}
          duration={f.duration}
          x={f.x}
          size={f.size}
        />
      ))}
    </div>
  );
}
