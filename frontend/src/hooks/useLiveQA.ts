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
  const abortRef = useRef<AbortController | null>(null);
  const currentQuestionRef = useRef("");

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

  const {
    isListening,
    finalText,
    interimText,
    error: speechError,
    startListening,
    stopListening,
    beginTurn,
    getTurnFinalText,
  } = useSpeech({
    autoRestart: true,
    onResult: useCallback(
      (result: SpeechTurnResult) => {
        if (stateRef.current === "AI_SPEAKING") {
          // Barge-in: pause audio, keep AI text visible, switch to listening
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          abortRef.current?.abort();
          updateState("USER_ANSWERING");
          // Don't beginTurn here — the speech result that triggered barge-in
          // is already part of this turn
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
            submitAnswer();
          }, silenceTimeoutMs);
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [silenceTimeoutMs]
    ),
  });

  // Speak text via ElevenLabs, returns when audio finishes (or is interrupted)
  const speakText = useCallback(
    async (text: string, signal: AbortSignal): Promise<boolean> => {
      const ttsRes = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: "recap", voiceId }),
        signal,
      });
      if (!ttsRes.ok) throw new Error("TTS failed");
      const audioBlob = await ttsRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise<boolean>((resolve) => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          resolve(true); // finished naturally
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          resolve(false);
        };

        // If aborted before play
        signal.addEventListener("abort", () => {
          audio.pause();
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          resolve(false);
        });

        audio.play().catch(() => resolve(false));
      });
    },
    [voiceId]
  );

  // Fetch question/feedback from Gemini
  const fetchTurn = useCallback(
    async (
      mode: "FIRST_QUESTION" | "NEXT_TURN",
      presenterAnswer?: string,
      signal?: AbortSignal
    ) => {
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
        signal,
      });
      if (!res.ok) throw new Error("Failed to get response");
      return (await res.json()) as { question: string; feedback?: string };
    },
    [sessionId]
  );

  // Core: ask a question (AI thinks → speaks → user answers)
  const askQuestion = useCallback(
    async (
      mode: "FIRST_QUESTION" | "NEXT_TURN",
      presenterAnswer?: string
    ) => {
      try {
        updateState("AI_THINKING");
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        const { question, feedback } = await fetchTurn(
          mode,
          presenterAnswer,
          signal
        );

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
          const finished = await speakText(feedback, signal);
          if (!finished && stateRef.current === "USER_ANSWERING") {
            // Barge-in happened during feedback — skip question speaking
            return;
          }
        }

        // Speak the question
        addHistory({ role: "assistant", text: question });
        setCurrentQuestion(question);
        currentQuestionRef.current = question;

        const finished = await speakText(question, signal);
        if (!finished && stateRef.current === "USER_ANSWERING") {
          // Barge-in during question — already listening
          return;
        }

        // Check if we've hit max questions
        if (questionsAskedCountRef.current >= maxQuestions) {
          updateState("DONE");
          stopListening();
          return;
        }

        // Transition to listening
        updateState("USER_ANSWERING");
        setUserCaption({ final: "", interim: "" });
        beginTurn();

        // Start max answer timer
        clearAnswerTimer();
        answerTimerRef.current = setTimeout(() => {
          if (stateRef.current === "USER_ANSWERING") {
            submitAnswer();
          }
        }, maxAnswerTimeSec * 1000);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        updateState("DONE");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      fetchTurn,
      speakText,
      addHistory,
      updateState,
      beginTurn,
      stopListening,
      maxQuestions,
      maxAnswerTimeSec,
      clearAnswerTimer,
    ]
  );

  // Submit the user's answer for current turn
  const submitAnswer = useCallback(() => {
    clearSilenceTimer();
    clearAnswerTimer();

    const answerText = getTurnFinalText().trim();
    setUserCaption({ final: answerText, interim: "" });

    if (answerText) {
      addHistory({ role: "user", text: answerText });
    }

    // Check if done
    if (questionsAskedCountRef.current >= maxQuestions) {
      updateState("DONE");
      stopListening();
      return;
    }

    // Check skip
    if (!answerText || isSkipAnswer(answerText)) {
      // Skip: go to next question without feedback
      beginTurn();
      askQuestion("NEXT_TURN", answerText || "(skipped)");
    } else {
      beginTurn();
      askQuestion("NEXT_TURN", answerText);
    }
  }, [
    clearSilenceTimer,
    clearAnswerTimer,
    getTurnFinalText,
    addHistory,
    updateState,
    stopListening,
    beginTurn,
    askQuestion,
    maxQuestions,
  ]);

  // Start the session
  const start = useCallback(() => {
    setError(null);
    setHistory([]);
    setCurrentQuestion("");
    setUserCaption({ final: "", interim: "" });
    setQuestionsAsked(0);
    historyRef.current = [];
    askedQuestionsRef.current = [];
    questionsAskedCountRef.current = 0;
    currentQuestionRef.current = "";

    startListening();
    askQuestion("FIRST_QUESTION");
  }, [startListening, askQuestion]);

  // Stop / end session
  const stop = useCallback(() => {
    clearSilenceTimer();
    clearAnswerTimer();
    stopListening();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    abortRef.current?.abort();
    updateState("DONE");
  }, [stopListening, clearSilenceTimer, clearAnswerTimer, updateState]);

  // Sync speech errors
  useEffect(() => {
    if (speechError) setError(speechError);
  }, [speechError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      clearAnswerTimer();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      abortRef.current?.abort();
    };
  }, [clearSilenceTimer, clearAnswerTimer]);

  return {
    state,
    history,
    currentQuestion,
    userCaption,
    questionsAsked,
    maxQuestions,
    isListening,
    start,
    stop,
    error,
  };
}
