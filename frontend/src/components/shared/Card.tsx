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
  const base =
    "rounded-xl p-6 transition-shadow";
  const variants = {
    default:
      "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm",
    elevated:
      "bg-white dark:bg-zinc-900 shadow-lg shadow-zinc-200/50 dark:shadow-zinc-900/50",
    outlined:
      "bg-transparent border-2 border-dashed border-zinc-300 dark:border-zinc-700",
  };

  return (
    <div
      className={`${base} ${variants[variant]} ${className}`}
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
    <div className={`mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100 ${className}`}>
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
