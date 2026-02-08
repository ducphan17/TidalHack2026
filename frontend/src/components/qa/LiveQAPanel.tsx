"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQA, type LiveQAState } from "@/hooks/useLiveQA";
import type { LiveQAGrade } from "@/services/gemini";
import { Card, Button } from "@/components/shared";

interface LiveQAPanelProps {
  sessionId: string;
  onEnd?: (grades: LiveQAGrade[]) => void;
}

export function LiveQAPanel({ sessionId, onEnd }: LiveQAPanelProps) {
  const [qaCount, setQaCount] = useState(3);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <section className="space-y-4">
        <Card>
          <div className="flex flex-col items-center gap-6 py-8">
            <h2 className="font-semibold text-zinc-100 text-lg">
              Live Q&A
            </h2>
            <p className="text-sm text-white/70 text-center max-w-sm">
              Your AI coach will ask you questions about your presentation.
              Answer each one by speaking, and get graded feedback after all
              questions are done.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-white">
                Number of questions:
              </label>
              <select
                value={qaCount}
                onChange={(e) => setQaCount(Number(e.target.value))}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => onEnd?.([])}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStarted(true)}>
                Start Q&A
              </Button>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <LiveQASession
      sessionId={sessionId}
      questionCount={qaCount}
      onEnd={onEnd}
    />
  );
}

function LiveQASession({
  sessionId,
  questionCount,
  onEnd,
}: {
  sessionId: string;
  questionCount: number;
  onEnd?: (grades: LiveQAGrade[]) => void;
}) {
  const {
    state,
    questions,
    currentIndex,
    answers,
    grades,
    transcript,
    error,
    start,
    stop,
    submitCurrentAnswer,
  } = useLiveQA({ sessionId, questionCount });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-start on mount (only once)
  useEffect(() => {
    start();
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state, currentIndex, transcript]);

  const handleEnd = () => {
    stop();
    onEnd?.(grades);
  };

  // Loading state — generating questions
  if (state === "LOADING") {
    return (
      <section className="space-y-4">
        <Card>
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-white/70">
              Generating questions from your presentation...
            </p>
          </div>
        </Card>
      </section>
    );
  }

  // Done state — show grading results
  if (state === "DONE") {
    const avgScore =
      grades.length > 0
        ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
        : 0;

    return (
      <section className="space-y-4">
        <Card>
          <div className="text-center py-4">
            <h2 className="text-xl font-semibold text-zinc-100 mb-2">
              Q&A Results
            </h2>
            <div className="text-4xl font-bold text-[#77A5C6] mb-1">
              {avgScore.toFixed(1)}/10
            </div>
            <p className="text-sm text-white/70">Average Score</p>
          </div>
        </Card>

        {grades.map((grade, i) => (
          <Card key={i}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-white mb-1">
                    Question {i + 1}
                  </p>
                  <p className="text-sm font-medium text-zinc-100">
                    {grade.question}
                  </p>
                </div>
                <ScoreBadge score={grade.score} />
              </div>

              <div>
                <p className="text-xs font-medium text-white mb-1">
                  Your Answer
                </p>
                <p className="text-sm text-white italic">
                  {grade.answer || "(No answer)"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-white mb-1">
                  Feedback
                </p>
                <p className="text-sm text-white">
                  {grade.feedback}
                </p>
              </div>

              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
                  Suggested Answer
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  {grade.suggested_answer}
                </p>
              </div>
            </div>
          </Card>
        ))}

        <div className="flex justify-center pt-2">
          <Button variant="primary" onClick={handleEnd}>
            Done
          </Button>
        </div>
      </section>
    );
  }

  // Grading state — loading spinner
  if (state === "GRADING") {
    return (
      <section className="space-y-4">
        <Card>
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-white/70">
              Grading your answers...
            </p>
            <p className="text-xs text-white">
              This may take a few seconds
            </p>
          </div>
        </Card>
      </section>
    );
  }

  // Active Q&A state (ASKING or LISTENING)
  const currentQuestion = questions[currentIndex];

  return (
    <section className="space-y-4">
      {/* Header with progress */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StateIndicator state={state} />
            <div>
              <h2 className="font-semibold text-zinc-100">
                Live Q&A
                <span className="ml-2 text-xs font-normal text-white/70">
                  Question {currentIndex + 1} of {questions.length}
                </span>
              </h2>
              <p className="text-xs text-white/70">
                {state === "ASKING" && "Listen to the question..."}
                {state === "LISTENING" && "Speak your answer..."}
                {state === "IDLE" && "Getting ready..."}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={handleEnd}>
            End Q&A
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex gap-1.5">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < currentIndex
                  ? "bg-green-500"
                  : i === currentIndex
                  ? "bg-blue-500"
                  : "bg-zinc-700"
              }`}
            />
          ))}
        </div>
      </Card>

      {/* Current question */}
      {currentQuestion && (
        <Card>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-900/40 text-blue-400 text-sm font-semibold">
                {currentIndex + 1}
              </span>
              <div className="flex-1">
                <p className="text-xs text-white mb-1">
                  {currentQuestion.slide_ref}
                </p>
                <p className="text-base font-medium text-zinc-100">
                  {currentQuestion.question}
                </p>
              </div>
            </div>

            {/* User's answer area */}
            {state === "LISTENING" && (
              <div className="space-y-3">
                <div className="rounded-lg border-2 border-dashed border-zinc-600 p-4 min-h-[80px]">
                  {transcript ? (
                    <p className="text-sm text-white">
                      {transcript}
                    </p>
                  ) : (
                    <p className="text-sm text-white/70 italic">
                      Listening... start speaking your answer
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    onClick={submitCurrentAnswer}
                  >
                    {currentIndex < questions.length - 1
                      ? "Next Question"
                      : "Finish & Grade"}
                  </Button>
                </div>
              </div>
            )}

            {state === "ASKING" && (
              <div className="flex items-center gap-2 text-sm text-white/70">
                <span className="flex items-center gap-0.5 h-4">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="w-0.5 bg-blue-500 rounded-full animate-pulse"
                      style={{
                        height: `${8 + (i % 2) * 8}px`,
                        animationDelay: `${i * 150}ms`,
                      }}
                    />
                  ))}
                </span>
                Playing question audio...
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Previous answers summary */}
      {currentIndex > 0 && (
        <Card>
          <h3 className="text-sm font-medium text-white/70 mb-3">
            Previous Answers
          </h3>
          <div className="space-y-2">
            {questions.slice(0, currentIndex).map((q, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                <span className="shrink-0 text-white font-medium">
                  Q{i + 1}:
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-white truncate block">
                    {q.question}
                  </span>
                  <span className="text-white/70 text-xs italic block mt-0.5">
                    Your answer: {answers[i] || "(skipped)"}
                  </span>
                </div>
                <span className="shrink-0 text-green-500">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <Card
          variant="outlined"
          className="border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm"
        >
          {error}
        </Card>
      )}

      <div ref={scrollRef} />
    </section>
  );
}

function StateIndicator({ state }: { state: LiveQAState }) {
  if (state === "LISTENING") {
    return (
      <span className="relative flex h-4 w-4">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
      </span>
    );
  }
  if (state === "ASKING") {
    return (
      <span className="flex items-center gap-0.5 h-4">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-0.5 bg-blue-500 rounded-full animate-pulse"
            style={{
              height: `${8 + (i % 2) * 8}px`,
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </span>
    );
  }
  if (state === "GRADING") {
    return (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    );
  }
  return (
    <span className="h-4 w-4 rounded-full bg-zinc-600" />
  );
}

function ScoreBadge({ score }: { score: number }) {
  let color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (score >= 7) {
    color =
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  } else if (score >= 4) {
    color =
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  }

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${color}`}
    >
      {score}/10
    </span>
  );
}
