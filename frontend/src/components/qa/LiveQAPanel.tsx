"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveQA, type LiveQAHistoryEntry, type LiveQAState } from "@/hooks/useLiveQA";
import { Card, Button } from "@/components/shared";

interface LiveQAPanelProps {
  sessionId: string;
  onEnd?: (history: LiveQAHistoryEntry[]) => void;
}

export function LiveQAPanel({ sessionId, onEnd }: LiveQAPanelProps) {
  const [duration, setDuration] = useState(180);
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
              Answer naturally — just like a real Q&A session.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm text-white">
                Session duration:
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
              >
                <option value={30}>30 sec</option>
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={180}>3 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
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
      sessionDurationSec={duration}
      onEnd={onEnd}
    />
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LiveQASession({
  sessionId,
  sessionDurationSec,
  onEnd,
}: {
  sessionId: string;
  sessionDurationSec: number;
  onEnd?: (history: LiveQAHistoryEntry[]) => void;
}) {
  const {
    state,
    history,
    currentQuestion,
    userCaption,
    questionsAsked,
    timeRemaining,
    isListening,
    isMuted,
    toggleMute,
    start,
    stop,
    error,
  } = useLiveQA({ sessionId, sessionDurationSec });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-start on mount (React Strict Mode safe)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasStarted.current) {
        hasStarted.current = true;
        start();
      }
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <h2 className="font-semibold text-zinc-100 text-lg">
                Live Q&A
                <span className={`ml-2 text-xs font-normal ${timeRemaining <= 30 ? "text-red-400" : "text-white/70"}`}>
                  {formatTime(timeRemaining)}
                </span>
              </h2>
              <p className="text-xs text-white/70">
                {state === "AI_THINKING" && "Coach is thinking..."}
                {state === "AI_SPEAKING" && "Coach is speaking..."}
                {state === "USER_ANSWERING" && (
                  <span>
                    Your turn — speak your answer
                    <span className="ml-2">
                      {isMuted ? "🔇 Muted" : isListening ? "🎤 Listening..." : "⚠️ Mic not active"}
                    </span>
                  </span>
                )}
                {state === "DONE" && "Q&A complete"}
                {state === "IDLE" && "Starting..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state !== "DONE" && state !== "IDLE" && (
              <button
                onClick={toggleMute}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isMuted
                    ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                    : "bg-zinc-700/50 text-white/70 hover:bg-zinc-700"
                }`}
                title={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? "🔇 Unmute" : "🎤 Mute"}
              </button>
            )}
            <Button variant="secondary" onClick={handleEnd}>
              {state === "DONE" ? "Close" : "End Q&A"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Mic level bar — visible when user is answering */}
      <MicLevelBar active={state === "USER_ANSWERING" && !isMuted} />

      {/* Chat history */}
      <Card>
        <div className="max-h-112 overflow-y-auto space-y-3 p-1">
          {history.length === 0 && state === "AI_THINKING" && (
            <p className="text-center text-sm text-white/70 py-8">
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
              <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2 bg-zinc-800 text-sm">
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
            <p className="text-center text-sm text-white/70 py-4">
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
          className="border-red-900 text-red-300 text-sm"
        >
          {error}
        </Card>
      )}
    </section>
  );
}

function MicLevelBar({ active }: { active: boolean }) {
  const [level, setLevel] = useState(0);
  const animRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    if (ctxRef.current) {
      ctxRef.current.close();
      ctxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setLevel(0);
  }, []);

  useEffect(() => {
    if (!active) {
      cleanup();
      return;
    }

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const audioCtx = new AudioContext();
        ctxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animRef.current = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {
        // Mic access denied or unavailable — bar stays at 0
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, cleanup]);

  if (!active) return null;

  return (
    <div className="rounded-xl bg-zinc-900/30 backdrop-blur-xl border border-zinc-700/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="text-xs text-white/70 shrink-0">Listening</span>
        <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${Math.max(2, level)}%`,
              backgroundColor:
                level > 50 ? "#22c55e" : level > 15 ? "#77C9E0" : "#52525b",
            }}
          />
        </div>
        <span className="text-xs text-white/40 shrink-0 w-8 text-right">
          {level}%
        </span>
      </div>
    </div>
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
  return <span className="h-4 w-4 rounded-full bg-zinc-600" />;
}

function ChatBubble({ entry }: { entry: LiveQAHistoryEntry }) {
  const isUser = entry.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "rounded-br-md bg-blue-500 text-white"
            : "rounded-bl-md bg-zinc-800 text-zinc-100"
        }`}
      >
        {entry.text}
      </div>
    </div>
  );
}
