"use client";

import { Card } from "@/components/shared";
import type { AnalysisFeedback } from "@/services/gemini";

interface FeedbackListProps {
  feedback: AnalysisFeedback;
}

export function FeedbackList({ feedback }: FeedbackListProps) {
  const { fillerWords, contentAlignment, improvements, summary } = feedback;

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
          Filler words
        </h3>
        <div className="space-y-4">
          {fillerWords.items.length > 0 && (
            <div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Total: {fillerWords.totalCount} filler words
              </p>
              <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                {fillerWords.items.map((fw) => (
                  <li key={fw.word}>
                    <strong>&quot;{fw.word}&quot;</strong>: {fw.count}×
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {fillerWords.feedback}
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Content vs slides
        </h3>
        <div className="space-y-4">
          {contentAlignment.matches.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                ✓ Covered well
              </h4>
              <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400">
                {contentAlignment.matches.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {contentAlignment.missing.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                Missing from speech
              </h4>
              <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400">
                {contentAlignment.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {contentAlignment.extra.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Extra (not on slides)
              </h4>
              <ul className="list-disc list-inside text-sm text-zinc-600 dark:text-zinc-400">
                {contentAlignment.extra.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {contentAlignment.feedback}
          </p>
        </div>
      </Card>

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
