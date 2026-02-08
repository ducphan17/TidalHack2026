"use client";

import { Card } from "@/components/shared";
import type { PresentationReport } from "@/services/gemini";

interface FeedbackListProps {
  feedback: PresentationReport;
}

export function FeedbackList({ feedback }: FeedbackListProps) {
  const {
    summary,
    filler_words,
    unclear_terms,
    critique,
    evidence,
    improvements,
  } = feedback;

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Summary
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">{summary}</p>
      </Card>

      <Card>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Critique
        </h3>
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Vocal Delivery
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {critique.vocal}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Content Quality
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {critique.content}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Visual Design
            </h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {critique.visual}
            </p>
          </div>
        </div>
      </Card>

      {filler_words.length > 0 && (
        <Card>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Filler Words ({filler_words.length})
          </h3>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
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
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Unclear Terms
          </h3>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
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
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Evidence
          </h3>
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {evidence.map((ev, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium">
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
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            How to improve
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            {improvements.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
