"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface LandingPageProps {
  onComplete?: () => void;
  projectName?: string;
}

export function LandingPage({
  onComplete,
  projectName = "Presently.ai",
}: LandingPageProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase("hold"), 1400);
    return () => clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    if (phase !== "hold") return;
    const exitTimer = setTimeout(() => setPhase("exit"), 1500);
    return () => clearTimeout(exitTimer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "exit") return;
    const completeTimer = setTimeout(() => onComplete?.(), 1100);
    return () => clearTimeout(completeTimer);
  }, [phase, onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
      onClick={() => phase === "hold" && onComplete?.()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && phase === "hold" && onComplete?.()}
      aria-label="Click to continue"
    >
      {/* Project name - drops from further, fades in, then dramatic fade out */}
      <motion.h1
        initial={{ y: -280, opacity: 0 }}
        animate={
          phase === "enter" || phase === "hold"
            ? { y: 0, opacity: 1 }
            : { y: -120, opacity: 0 }
        }
        transition={{
          duration: phase === "exit" ? 1 : 1,
          ease: phase === "exit" ? [0.4, 0, 0.6, 1] as const : [0.22, 1, 0.36, 1] as const,
        }}
        className="relative z-10 text-6xl md:text-8xl font-bold text-[var(--heading)] tracking-tight drop-shadow-md"
      >
        {projectName}
      </motion.h1>
    </div>
  );
}
