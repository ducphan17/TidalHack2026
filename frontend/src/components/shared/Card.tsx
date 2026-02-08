"use client";

import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined";
}

export function Card({
  children,
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  const base = "rounded-xl p-6 transition-shadow duration-300 panel-hover-shadow";
  const blurred = "backdrop-blur-xl bg-white/50 dark:bg-zinc-900/50";

  if (variant === "outlined") {
    return (
      <div
        className={`${base} ${blurred} border border-zinc-200/50 dark:border-zinc-700/50 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 ${blurred} ${base} min-h-0 shadow-lg shadow-zinc-200/40 dark:shadow-zinc-950/50 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 text-lg font-semibold text-[var(--heading)] dark:text-zinc-100 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
