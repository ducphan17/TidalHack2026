"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQA, type LiveQAHistoryEntry } from "@/hooks/useLiveQA";
import { Card, Button } from "@/components/shared";

interface LiveQAPanelProps {
  sessionId: string;
  onEnd?: (history: LiveQAHistoryEntry[]) => void;
}

export function LiveQAPanel({ sessionId, onEnd }: LiveQAPanelProps) {
  const [qaCount, setQaCount] = useState(3);
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <section className="space-y-4">
        <Card>
          <div className="flex flex-col items-center gap-6 py-8">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg">
              Live Q&A
            </h2>
            <p className="text-sm text-zinc-500 text-center max-w-sm">
              Have a real-time voice conversation with your AI coach about your presentation.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Number of questions:
              </label>
              <select
                value={qaCount}
                onChange={(e) => setQaCount(Number(e.target.value))}
                className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
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
      maxQuestions={qaCount}
      onEnd={onEnd}
    />
  );
}

function LiveQASession({
  sessionId,
  maxQuestions,
  onEnd,
}: {
  sessionId: string;
  maxQuestions: number;
  onEnd?: (history: LiveQAHistoryEntry[]) => void;
}) {
  const {
    state,
    transcript,
    history,
    start,
    stop,
    error,
  } = useLiveQA({ sessionId, maxQuestions });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-start on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      start();
    }
  }, [start]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, transcript]);

  const handleEnd = () => {
    stop();
    onEnd?.(history);
  };

  // Count how many Q&A rounds completed (each round = 1 user + 1 assistant)
  const questionsAsked = history.filter((h) => h.role === "assistant").length;

  return (
    <section className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StateIndicator state={state} />
            <div>
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Live Q&A
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  {questionsAsked}/{maxQuestions}
                </span>
              </h2>
              <p className="text-xs text-zinc-500">
                {state === "LISTENING" && "Listening... speak your answer"}
                {state === "THINKING" && "Processing your response..."}
                {state === "SPEAKING" && "Coach is speaking... (interrupt anytime)"}
                {state === "IDLE" && "Ready to start"}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={handleEnd}>
            End Q&A
          </Button>
        </div>
      </Card>

      {/* Chat history */}
      <Card>
        <div className="max-h-96 overflow-y-auto space-y-3 p-1">
          {history.length === 0 && state === "LISTENING" && (
            <p className="text-center text-sm text-zinc-400 py-8">
              Start speaking to begin the conversation...
            </p>
          )}
          {history.map((entry, i) => (
            <ChatBubble key={i} entry={entry} />
          ))}

          {/* Live transcript preview */}
          {transcript && state === "LISTENING" && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-sm opacity-60 italic">
                {transcript}
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {state === "THINKING" && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-sm">
                <span className="inline-flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </Card>

      {/* Error display */}
      {error && (
        <Card
          variant="outlined"
          className="border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm"
        >
          {error}
        </Card>
      )}
    </section>
  );
}

function StateIndicator({ state }: { state: string }) {
  if (state === "LISTENING") {
    return (
      <span className="relative flex h-4 w-4">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
      </span>
    );
  }
  if (state === "THINKING") {
    return (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    );
  }
  if (state === "SPEAKING") {
    return (
      <span className="flex items-center gap-0.5 h-4">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-0.5 bg-green-500 rounded-full animate-pulse"
            style={{
              height: `${8 + (i % 2) * 8}px`,
              animationDelay: `${i * 150}ms`,
            }}
          />
        ))}
      </span>
    );
  }
  return <span className="h-4 w-4 rounded-full bg-zinc-300 dark:bg-zinc-600" />;
}

function ChatBubble({ entry }: { entry: LiveQAHistoryEntry }) {
  const isUser = entry.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "rounded-br-md bg-blue-500 text-white"
            : "rounded-bl-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {entry.text}
      </div>
    </div>
  );
}
