"use client";

import { Card } from "@/components/shared";
import type { ScoreBreakdown, RelevanceGate } from "@/services/gemini";

interface ScoreBreakdownPanelProps {
  breakdown: ScoreBreakdown;
  relevanceGate?: RelevanceGate | null;
}

function scoreColor(score: number) {
  const pct = (score / 10) * 100;
  if (pct >= 80) return "text-green-600 dark:text-green-400";
  if (pct >= 60) return "text-amber-600 dark:text-amber-400";
  if (pct >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

const CRITERIA = [
  {
    key: "document_coverage" as const,
    label: "Document coverage (completeness)",
    weight: 0.25,
  },
  {
    key: "content_quality" as const,
    label: "Content quality and accuracy",
    weight: 0.30,
  },
  {
    key: "audience_understanding" as const,
    label: "Audience understanding (slide-level)",
    weight: 0.20,
  },
  {
    key: "speech_alignment" as const,
    label: "Speech–document alignment",
    weight: 0.15,
  },
  {
    key: "vocal_delivery" as const,
    label: "Vocal delivery (tone & clarity)",
    weight: 0.10,
  },
] as const;

export function ScoreBreakdownPanel({
  breakdown,
  relevanceGate,
}: ScoreBreakdownPanelProps) {
  const axes = CRITERIA.map((c) => ({
    label: c.label,
    score: breakdown[c.key],
    weight: c.weight,
    rationale: breakdown[`${c.key}_rationale` as const],
  }));

  const weightedSum = axes.reduce(
    (s, a) => s + a.score * a.weight,
    0
  );
  const contentFails =
    breakdown.document_coverage === 0 || breakdown.content_quality === 0;

  const formulaText =
    relevanceGate?.passed === false
      ? "Overall = 0 (relevance gate failed — presentation did not match the document)"
      : contentFails
        ? "Overall = 0 (content must match slides — good delivery alone does not earn points)"
        : `Overall = weighted sum (Coverage 25%, Content 30%, Audience 20%, Alignment 15%, Vocal 10%) = ${weightedSum.toFixed(1)}/10`;

  const criteriaSummary = [
    { label: "Coverage", pct: 25 },
    { label: "Content Quality", pct: 30 },
    { label: "Audience Understanding", pct: 20 },
    { label: "Alignment", pct: 15 },
    { label: "Vocal Delivery", pct: 10 },
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold text-zinc-100 mb-2">
        Why this score?
      </h3>
      <p className="text-sm text-white mb-3">
        Criteria weights:
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white mb-4">
        {criteriaSummary.map(({ label, pct }) => (
          <span key={label}>
            {label}: {pct}%
          </span>
        ))}
      </div>
      <p className="text-sm text-white mb-4">
        {formulaText}
      </p>
      <div className="space-y-4">
        {axes.map(({ label, score, weight, rationale }) => (
          <div
            key={label}
            className="flex gap-4 items-start border-b border-zinc-700 last:border-0 pb-4 last:pb-0"
          >
            <div className="shrink-0 w-14 text-right">
              <span
                className={`text-lg font-bold ${scoreColor(score)}`}
                title={`${score}/10`}
              >
                {score}/10
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white flex items-center gap-2">
                {label}
                <span className="text-xs font-normal text-white">
                  ({(weight * 100)}%)
                </span>
              </div>
              <p className="text-sm text-white mt-0.5">
                {rationale}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
