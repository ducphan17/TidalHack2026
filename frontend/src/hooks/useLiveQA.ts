"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSpeech } from "./useSpeech";
import type { QAQuestion, LiveQAGrade } from "@/services/gemini";

export type LiveQAState =
  | "IDLE"
  | "LOADING"
  | "ASKING"
  | "LISTENING"
  | "GRADING"
  | "DONE";

export interface LiveQAHistoryEntry {
  role: "user" | "assistant";
  text: string;
}

interface UseLiveQAOptions {
  sessionId: string;
  questionCount: number;
  voiceId?: string;
  silenceTimeoutMs?: number;
}

export function useLiveQA({
  sessionId,
  questionCount,
  voiceId = "9BWtsMINqrJLrRacOk9x",
  silenceTimeoutMs = 2500,
}: UseLiveQAOptions) {
  const [state, setState] = useState<LiveQAState>("IDLE");
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [grades, setGrades] = useState<LiveQAGrade[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<LiveQAState>("IDLE");
  const questionsRef = useRef<QAQuestion[]>([]);
  const currentIndexRef = useRef(0);
  const answersRef = useRef<string[]>([]);
  const utteranceRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  // Refs to speech control functions (avoids circular dependency)
  const stopListeningRef = useRef<(() => void) | null>(null);
  const startListeningRef = useRef<(() => void) | null>(null);

  // Play TTS for a question, then transition to LISTENING
  const askQuestion = useCallback(
    async (question: QAQuestion) => {
      updateState("ASKING");
      setInterimTranscript("");
      utteranceRef.current = "";

      // STOP speech recognition while TTS plays — prevents mic from capturing TTS audio
      stopListeningRef.current?.();

      try {
        abortRef.current = new AbortController();

        const ttsRes = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: question.question,
            mode: "question",
            voiceId,
          }),
          signal: abortRef.current.signal,
        });

        if (!ttsRes.ok) throw new Error("TTS failed");
        const audioBlob = await ttsRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          if (stateRef.current === "ASKING") {
            // RESTART speech recognition fresh — clean transcript, no echo
            startListeningRef.current?.();
            updateState("LISTENING");
          }
        };

        await audio.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("TTS failed, moving to LISTENING:", err);
        // Still restart speech and let user answer
        startListeningRef.current?.();
        updateState("LISTENING");
      }
    },
    [voiceId, updateState]
  );

  // Submit user's answer and move to next question or grading
  const submitAnswer = useCallback(
    async (text: string) => {
      clearSilenceTimer();

      const answer = text.trim() || "(No answer provided)";
      const idx = currentIndexRef.current;
      const qs = questionsRef.current;

      // Store answer
      const newAnswers = [...answersRef.current];
      newAnswers[idx] = answer;
      answersRef.current = newAnswers;
      setAnswers([...newAnswers]);
      setInterimTranscript("");
      utteranceRef.current = "";

      const nextIdx = idx + 1;

      if (nextIdx < qs.length) {
        // Move to next question — askQuestion will stop/restart speech recognition
        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);
        askQuestion(qs[nextIdx]);
      } else {
        // All questions answered — stop listening and grade
        stopListeningRef.current?.();
        updateState("GRADING");

        try {
          abortRef.current = new AbortController();

          const qaPairs = qs.map((q, i) => ({
            question: q.question,
            slide_ref: q.slide_ref,
            answer: newAnswers[i] || "(No answer provided)",
          }));

          const res = await fetch("/api/qa/live/grade-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, qaPairs }),
            signal: abortRef.current.signal,
          });

          if (!res.ok) throw new Error("Grading failed");
          const { grades: gradeResults } = await res.json();

          setGrades(gradeResults);
          updateState("DONE");
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(
            err instanceof Error ? err.message : "Grading failed"
          );
          updateState("DONE");
        }
      }
    },
    [sessionId, askQuestion, clearSilenceTimer, updateState]
  );

  const handleSpeechResult = useCallback(
    (transcript: string, isFinal: boolean) => {
      if (stateRef.current !== "LISTENING") return;

      setInterimTranscript(transcript);

      if (isFinal && transcript.trim()) {
        utteranceRef.current = transcript;
        clearSilenceTimer();

        // Start silence timer — submit after pause
        silenceTimerRef.current = setTimeout(() => {
          const text = utteranceRef.current;
          utteranceRef.current = "";
          submitAnswer(text);
        }, silenceTimeoutMs);
      }
    },
    [clearSilenceTimer, submitAnswer, silenceTimeoutMs]
  );

  const {
    isListening,
    error: speechError,
    startListening,
    stopListening,
    transcript: speechTranscript,
  } = useSpeech({
    autoRestart: true,
    onResult: handleSpeechResult,
  });

  // Keep refs in sync
  useEffect(() => {
    stopListeningRef.current = stopListening;
    startListeningRef.current = startListening;
  }, [stopListening, startListening]);

  // Start the Live Q&A session
  const start = useCallback(async () => {
    setError(null);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setGrades([]);
    setInterimTranscript("");
    questionsRef.current = [];
    currentIndexRef.current = 0;
    answersRef.current = [];
    utteranceRef.current = "";

    updateState("LOADING");

    try {
      abortRef.current = new AbortController();

      const res = await fetch("/api/qa/live/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, count: questionCount }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed to generate questions");
      const { questions: qs } = await res.json();

      if (!qs || qs.length === 0) {
        throw new Error("No questions generated");
      }

      questionsRef.current = qs;
      setQuestions(qs);

      // Ask the first question (it will start speech recognition after TTS ends)
      askQuestion(qs[0]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to start Q&A");
      updateState("IDLE");
    }
  }, [sessionId, questionCount, askQuestion, updateState]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    stopListening();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    abortRef.current?.abort();
    updateState("IDLE");
  }, [stopListening, clearSilenceTimer, updateState]);

  // Sync speech errors
  useEffect(() => {
    if (speechError) setError(speechError);
  }, [speechError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      abortRef.current?.abort();
    };
  }, [clearSilenceTimer]);

  // Let the user manually submit their current answer
  const submitCurrentAnswer = useCallback(() => {
    if (stateRef.current !== "LISTENING") return;
    clearSilenceTimer();
    const text = utteranceRef.current || interimTranscript || speechTranscript;
    utteranceRef.current = "";
    submitAnswer(text);
  }, [clearSilenceTimer, submitAnswer, interimTranscript, speechTranscript]);

  return {
    state,
    questions,
    currentIndex,
    answers,
    grades,
    transcript: interimTranscript || speechTranscript,
    isListening,
    error,
    start,
    stop,
    submitCurrentAnswer,
  };
}
