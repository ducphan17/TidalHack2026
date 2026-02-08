"use client";

import { Card } from "@/components/shared";

interface ScoreCardProps {
  score: number;
  maxScore?: number;
  label?: string;
}

export function ScoreCard({
  score,
  maxScore = 10,
  label = "Overall Score",
}: ScoreCardProps) {
  const percentage = Math.min(100, (score / maxScore) * 100);
  const color =
    percentage >= 80
      ? "text-green-600 dark:text-green-400"
      : percentage >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card variant="elevated" className="text-center">
      <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
        {label}
      </div>
      <div
        className={`mt-2 text-4xl font-bold ${color}`}
        data-testid="score-value"
      >
        {Number.isInteger(score) ? score : score.toFixed(1)}
        <span className="text-xl font-normal text-zinc-400">/{maxScore}</span>
      </div>
    </Card>
  );
}
