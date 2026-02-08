"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSpeech } from "./useSpeech";
import type { SpeechTurnResult } from "./useSpeech";
import type { QAQuestion, LiveQAGrade } from "@/services/gemini";

export type LiveQAState =
  | "IDLE"
  | "LOADING"
  | "ASKING"
  | "LISTENING"
  | "GRADING"
  | "DONE";

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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const clearAnswerTimer = useCallback(() => {
    if (answerTimerRef.current) {
      clearTimeout(answerTimerRef.current);
      answerTimerRef.current = null;
    }
  }, []);

  // Refs to speech control functions (avoids circular dependency)
  const stopListeningRef = useRef<(() => void) | null>(null);
  const beginTurnRef = useRef<(() => void) | null>(null);
  const getTurnFinalTextRef = useRef<(() => string) | null>(null);

  // Play TTS for a question, then transition to LISTENING
  const askQuestion = useCallback(
    async (question: QAQuestion) => {
      updateState("ASKING");
      setInterimTranscript("");

      // Begin a new speech turn (soft reset) — prevents mic from capturing TTS audio as answer
      beginTurnRef.current?.();

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
            // Begin a fresh turn for the user's answer — clean transcript
            beginTurnRef.current?.();
            updateState("LISTENING");
          }
        };

        await audio.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("TTS failed, moving to LISTENING:", err);
        // Still let user answer
        beginTurnRef.current?.();
        updateState("LISTENING");
      }
    },
    [voiceId, updateState]
  );

  // Submit user's answer and move to next question or grading
  const submitAnswer = useCallback(
    async (text: string) => {
      clearSilenceTimer();
      clearAnswerTimer();

      const answer = text.trim() || "(No answer provided)";
      const idx = currentIndexRef.current;
      const qs = questionsRef.current;

      // Store answer
      const newAnswers = [...answersRef.current];
      newAnswers[idx] = answer;
      answersRef.current = newAnswers;
      setAnswers([...newAnswers]);
      setInterimTranscript("");

      const nextIdx = idx + 1;

      if (nextIdx < qs.length) {
        // Move to next question — askQuestion will begin a new turn
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
    [sessionId, askQuestion, clearSilenceTimer, clearAnswerTimer, updateState]
  );

  // Handle speech recognition results (turn-based API)
  const handleSpeechResult = useCallback(
    (result: SpeechTurnResult) => {
      if (stateRef.current !== "LISTENING") return;

      setInterimTranscript(result.combinedText);

      // When we get a final chunk with no more interim text, start silence timer
      if (result.hasFinalChunk) {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          const text = getTurnFinalTextRef.current?.() || result.finalText;
          submitAnswer(text);
        }, silenceTimeoutMs);
      }
    },
    [clearSilenceTimer, submitAnswer, silenceTimeoutMs]
  );

  const {
    isListening,
    transcript: speechTranscript,
    error: speechError,
    startListening,
    stopListening,
    beginTurn,
    getTurnFinalText,
  } = useSpeech({
    autoRestart: true,
    onResult: handleSpeechResult,
  });

  // Keep refs in sync
  useEffect(() => {
    stopListeningRef.current = stopListening;
    beginTurnRef.current = beginTurn;
    getTurnFinalTextRef.current = getTurnFinalText;
  }, [stopListening, beginTurn, getTurnFinalText]);

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

      // Start listening, then ask the first question (TTS will begin a new turn)
      startListening();
      askQuestion(qs[0]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to start Q&A");
      updateState("IDLE");
    }
  }, [sessionId, questionCount, askQuestion, startListening, updateState]);

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

  // Let the user manually submit their current answer
  const submitCurrentAnswer = useCallback(() => {
    if (stateRef.current !== "LISTENING") return;
    clearSilenceTimer();
    const text = getTurnFinalText() || interimTranscript || speechTranscript;
    submitAnswer(text);
  }, [clearSilenceTimer, submitAnswer, interimTranscript, speechTranscript, getTurnFinalText]);

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
