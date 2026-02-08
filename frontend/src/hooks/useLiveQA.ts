"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSpeech, type SpeechTurnResult } from "./useSpeech";

export type LiveQAState =
  | "IDLE"
  | "AI_THINKING"
  | "AI_SPEAKING"
  | "USER_ANSWERING"
  | "DONE";

export interface LiveQAHistoryEntry {
  role: "user" | "assistant";
  text: string;
}

interface UseLiveQAOptions {
  sessionId: string;
  voiceId?: string;
  silenceTimeoutMs?: number;
  maxQuestions?: number;
  maxAnswerTimeSec?: number;
}

const SKIP_PHRASES = [
  "don't know",
  "dont know",
  "not sure",
  "don't remember",
  "dont remember",
  "i don't know",
  "i dont know",
  "no idea",
  "skip",
  "pass",
  "next",
  "next question",
];

function isSkipAnswer(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return SKIP_PHRASES.some((p) => lower.includes(p));
}

export function useLiveQA({
  sessionId,
  voiceId = "9BWtsMINqrJLrRacOk9x",
  silenceTimeoutMs = 1500,
  maxQuestions = 5,
  maxAnswerTimeSec = 300,
}: UseLiveQAOptions) {
  const [state, setState] = useState<LiveQAState>("IDLE");
  const [history, setHistory] = useState<LiveQAHistoryEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [userCaption, setUserCaption] = useState({ final: "", interim: "" });
  const [error, setError] = useState<string | null>(null);
  const [questionsAsked, setQuestionsAsked] = useState(0);

  const stateRef = useRef<LiveQAState>("IDLE");
  const historyRef = useRef<LiveQAHistoryEntry[]>([]);
  const askedQuestionsRef = useRef<string[]>([]);
  const questionsAskedCountRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const currentQuestionRef = useRef("");
  const stoppedRef = useRef(false);

  const updateState = useCallback((s: LiveQAState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearAnswerTimer = useCallback(() => {
    if (answerTimerRef.current) {
      clearTimeout(answerTimerRef.current);
      answerTimerRef.current = null;
    }
  }, []);

  const addHistory = useCallback(
    (entry: LiveQAHistoryEntry) => {
      const updated = [...historyRef.current, entry];
      historyRef.current = updated;
      setHistory(updated);
    },
    []
  );

  // Web Speech API
  const {
    isListening: speechIsListening,
    error: speechError,
    startListening,
    stopListening,
    ensureListening,
    beginTurn,
    getTurnFinalText,
  } = useSpeech({
    autoRestart: true,
    onResult: useCallback(
      (result: SpeechTurnResult) => {
        // BARGE-IN: If user speaks while AI is speaking, interrupt immediately
        if (stateRef.current === "AI_SPEAKING") {
          console.log("[LiveQA] BARGE-IN detected!");
          
          // 1. Stop audio playback
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }

          // 2. Cancel TTS fetch
          if (ttsAbortRef.current) {
            ttsAbortRef.current.abort();
            ttsAbortRef.current = null;
          }

          // 3. Transition to USER_ANSWERING
          updateState("USER_ANSWERING");
        }

        if (stateRef.current !== "USER_ANSWERING") return;

        setUserCaption({ final: result.finalText, interim: result.interimText });

        // Reset silence timer on any speech activity
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (result.hasFinalChunk && result.combinedText.trim()) {
          // Start silence timer — submit after pause
          silenceTimerRef.current = setTimeout(() => {
            submitAnswerRef.current();
          }, silenceTimeoutMs);
        }
      },
      [silenceTimeoutMs, updateState]
    ),
  });

  // Use refs for functions to avoid stale closures
  const askQuestionRef = useRef<(mode: "FIRST_QUESTION" | "NEXT_TURN", answer?: string) => void>(() => {});
  const submitAnswerRef = useRef<() => void>(() => {});

  // Speak text via ElevenLabs
  async function speakTextFn(text: string): Promise<boolean> {
    if (stoppedRef.current) return false;
    
    try {
      ttsAbortRef.current = new AbortController();
      const signal = ttsAbortRef.current.signal;

      const ttsRes = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: "question", voiceId }),
        signal,
      });

      if (!ttsRes.ok) {
        console.warn("[LiveQA] TTS failed, continuing without voice");
        return true;
      }

      if (stoppedRef.current || signal.aborted) return false;

      const audioBlob = await ttsRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise<boolean>((resolve) => {
        if (stoppedRef.current || signal.aborted) {
          URL.revokeObjectURL(audioUrl);
          resolve(false);
          return;
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          ttsAbortRef.current = null;
          resolve(true);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          ttsAbortRef.current = null;
          resolve(false);
        };

        // Listen for abort
        signal.addEventListener("abort", () => {
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          resolve(false);
        });

        audio.play().catch(() => resolve(false));
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.log("[LiveQA] TTS aborted (barge-in)");
        return false;
      }
      console.warn("[LiveQA] Voice error:", err);
      return true; // Continue without voice
    }
  }

  // Core: ask a question (AI thinks → speaks → user answers)
  askQuestionRef.current = async (
    mode: "FIRST_QUESTION" | "NEXT_TURN",
    presenterAnswer?: string
  ) => {
    try {
      updateState("AI_THINKING");
      stoppedRef.current = false;

      // Fetch question from API
      const res = await fetch("/api/qa/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          mode,
          askedQuestions: askedQuestionsRef.current,
          lastQuestion: currentQuestionRef.current || undefined,
          presenterAnswer: presenterAnswer || undefined,
          history: historyRef.current,
        }),
      });

      if (!res.ok) throw new Error("Failed to get response");
      const { question, feedback } = (await res.json()) as {
        question: string;
        feedback?: string;
      };

      if (stoppedRef.current) return;

      // Track asked questions
      askedQuestionsRef.current = [...askedQuestionsRef.current, question];
      questionsAskedCountRef.current += 1;
      setQuestionsAsked(questionsAskedCountRef.current);

      // Speak feedback first (if any), then question
      updateState("AI_SPEAKING");

      if (feedback) {
        addHistory({ role: "assistant", text: feedback });
        setCurrentQuestion(feedback);
        currentQuestionRef.current = feedback;
        const finished = await speakTextFn(feedback);
        if (!finished || stateRef.current === "USER_ANSWERING") {
          console.log("[LiveQA] Skipped feedback voice (barge-in or error)");
        }
        if (stoppedRef.current) return;
      }

      // Speak the question
      addHistory({ role: "assistant", text: question });
      setCurrentQuestion(question);
      currentQuestionRef.current = question;

      const finished = await speakTextFn(question);
      if (!finished || stateRef.current === "USER_ANSWERING") {
        console.log("[LiveQA] Skipped question voice (barge-in or error)");
      }
      if (stoppedRef.current) return;

      // Check if we've hit max questions
      if (questionsAskedCountRef.current >= maxQuestions) {
        updateState("DONE");
        return;
      }

      // Transition to listening
      console.log("[LiveQA] Transitioning to USER_ANSWERING");
      updateState("USER_ANSWERING");
      setUserCaption({ final: "", interim: "" });
      beginTurn();
      ensureListening(); // Ensure mic is active

      // Start max answer timer
      if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
      answerTimerRef.current = setTimeout(() => {
        if (stateRef.current === "USER_ANSWERING") {
          submitAnswerRef.current();
        }
      }, maxAnswerTimeSec * 1000);
    } catch (err) {
      if (stoppedRef.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      updateState("DONE");
    }
  };

  // Submit the user's answer for current turn
  submitAnswerRef.current = () => {
    clearSilenceTimer();
    clearAnswerTimer();

    const answerText = getTurnFinalText().trim();
    console.log("[LiveQA] Submitting answer:", answerText || "(empty)");
    setUserCaption({ final: answerText, interim: "" });

    if (answerText) {
      addHistory({ role: "user", text: answerText });
    }

    // Check if done
    if (questionsAskedCountRef.current >= maxQuestions) {
      updateState("DONE");
      return;
    }

    // Check skip
    if (!answerText || isSkipAnswer(answerText)) {
      askQuestionRef.current("NEXT_TURN", answerText || "(skipped)");
    } else {
      askQuestionRef.current("NEXT_TURN", answerText);
    }
  };

  // Start the session
  const start = useCallback(() => {
    console.log("[LiveQA] Starting session...");
    setError(null);
    setHistory([]);
    setCurrentQuestion("");
    setUserCaption({ final: "", interim: "" });
    setQuestionsAsked(0);
    historyRef.current = [];
    askedQuestionsRef.current = [];
    questionsAskedCountRef.current = 0;
    currentQuestionRef.current = "";
    stoppedRef.current = false;

    // Start mic (handsfree - always on)
    startListening();
    
    // Start first question
    askQuestionRef.current("FIRST_QUESTION");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  // Stop / end session
  const stop = useCallback(() => {
    console.log("[LiveQA] Stopping session...");
    stoppedRef.current = true;
    clearSilenceTimer();
    clearAnswerTimer();
    stopListening();
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    
    updateState("DONE");
  }, [stopListening, clearSilenceTimer, clearAnswerTimer, updateState]);

  // Sync speech errors
  useEffect(() => {
    if (speechError) setError(speechError);
  }, [speechError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      clearSilenceTimer();
      clearAnswerTimer();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (ttsAbortRef.current) {
        ttsAbortRef.current.abort();
      }
    };
  }, [clearSilenceTimer, clearAnswerTimer]);

  return {
    state,
    history,
    currentQuestion,
    userCaption,
    questionsAsked,
    maxQuestions,
    isListening: speechIsListening,
    start,
    stop,
    error,
  };
}
