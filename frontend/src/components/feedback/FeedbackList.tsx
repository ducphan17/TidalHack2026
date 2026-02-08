"use client";

import { Card } from "@/components/shared";
import type { PresentationReport } from "@/services/gemini";

interface FeedbackListProps {
  feedback: PresentationReport;
}

function statusLabel(
  status: "well_explained" | "partially_explained" | "not_well_explained"
) {
  switch (status) {
    case "well_explained":
      return { text: "Well explained", color: "text-green-600 dark:text-green-400" };
    case "partially_explained":
      return { text: "Partially explained", color: "text-amber-600 dark:text-amber-400" };
    case "not_well_explained":
      return { text: "Not well explained", color: "text-red-600 dark:text-red-400" };
  }
}

export function FeedbackList({ feedback }: FeedbackListProps) {
  const {
    summary,
    relevance_gate,
    audience_understanding,
    filler_words,
    unclear_terms,
    critique,
    evidence,
    improvements,
  } = feedback;

  return (
    <div className="space-y-6">
      {relevance_gate?.passed === false && (
        <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
          <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">
            Relevance gate: not passed
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400">
            {relevance_gate.reason ??
              "The presentation content does not match the provided slides."}
          </p>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-zinc-100 mb-2">
          Summary
        </h3>
        <p className="text-white">{summary}</p>
      </Card>

      {audience_understanding && audience_understanding.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">
            Slide-by-slide understanding
          </h3>
          <ul className="space-y-3">
            {audience_understanding.map((s, i) => {
              const { text, color } = statusLabel(s.status);
              return (
                <li
                  key={i}
                  className="flex flex-col gap-1 border-b border-zinc-700 last:border-0 pb-3 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white">
                      Page {s.page}
                    </span>
                    <span className={`text-sm font-medium ${color}`}>
                      {text}
                    </span>
                  </div>
                  {s.evidence && (
                    <p className="text-sm text-white">
                      {s.evidence}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">
          Critique
        </h3>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-white mb-1">
              Vocal Delivery
            </h4>
            <p className="text-sm text-white">
              {critique.vocal}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-white mb-1">
              Content Quality
            </h4>
            <p className="text-sm text-white">
              {critique.content}
            </p>
          </div>
        </div>
      </Card>

      {filler_words.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">
            Filler Words ({filler_words.length})
          </h3>
          <ul className="space-y-1 text-sm text-white">
            {filler_words.map((fw, i) => (
              <li key={i}>
                <strong>&quot;{fw.word}&quot;</strong> at{" "}
                {fw.timestamp.toFixed(1)}s
              </li>
            ))}
          </ul>
        </Card>
      )}

      {unclear_terms.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">
            Unclear Terms
          </h3>
          <ul className="space-y-1 text-sm text-white">
            {unclear_terms.map((ut, i) => (
              <li key={i}>
                &quot;{ut.stt_token}&quot; at {ut.timestamp.toFixed(1)}s
                <span className="text-amber-600 dark:text-amber-400 ml-2">
                  (confidence: {(ut.confidence * 100).toFixed(0)}%)
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {evidence.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">
            Evidence
          </h3>
          <ul className="space-y-2 text-sm text-white">
            {evidence.map((ev, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 rounded bg-zinc-800 px-2 py-0.5 text-xs font-medium">
                  {ev.ref}
                </span>
                <span>{ev.note}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {improvements.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-zinc-100 mb-4">
            How to improve
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-white">
            {improvements.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
