"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQA, type LiveQAHistoryEntry, type LiveQAState } from "@/hooks/useLiveQA";
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
              Your AI coach will ask you questions about your presentation. Answer naturally — just like a real Q&A session.
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
    history,
    currentQuestion,
    userCaption,
    questionsAsked,
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
  }, [history, userCaption]);

  const handleEnd = () => {
    stop();
    onEnd?.(history);
  };

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
                {state === "AI_THINKING" && "Coach is thinking..."}
                {state === "AI_SPEAKING" && "Coach is speaking... (interrupt anytime)"}
                {state === "USER_ANSWERING" && "Your turn — speak your answer"}
                {state === "DONE" && "Q&A complete"}
                {state === "IDLE" && "Starting..."}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={handleEnd}>
            {state === "DONE" ? "Close" : "End Q&A"}
          </Button>
        </div>
      </Card>

      {/* Chat history */}
      <Card>
        <div className="max-h-[28rem] overflow-y-auto space-y-3 p-1">
          {history.length === 0 && state === "AI_THINKING" && (
            <p className="text-center text-sm text-zinc-400 py-8">
              Preparing first question...
            </p>
          )}

          {history.map((entry, i) => (
            <ChatBubble key={i} entry={entry} />
          ))}

          {/* Live user caption (current turn) */}
          {state === "USER_ANSWERING" && (userCaption.final || userCaption.interim) && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2 bg-blue-500 text-white text-sm">
                {userCaption.final && (
                  <span>{userCaption.final}</span>
                )}
                {userCaption.interim && (
                  <span className="opacity-60 italic">
                    {userCaption.final ? " " : ""}{userCaption.interim}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Thinking indicator */}
          {state === "AI_THINKING" && history.length > 0 && (
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

          {/* Done message */}
          {state === "DONE" && (
            <p className="text-center text-sm text-zinc-400 py-4">
              Q&A session complete — {questionsAsked} question{questionsAsked !== 1 ? "s" : ""} asked.
            </p>
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

function StateIndicator({ state }: { state: LiveQAState }) {
  if (state === "USER_ANSWERING") {
    return (
      <span className="relative flex h-4 w-4">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
      </span>
    );
  }
  if (state === "AI_THINKING") {
    return (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
    );
  }
  if (state === "AI_SPEAKING") {
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
  if (state === "DONE") {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500">
        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
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
