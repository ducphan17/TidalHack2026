"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSpeech } from "./useSpeech";

export type LiveQAState = "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";

export interface LiveQAHistoryEntry {
  role: "user" | "assistant";
  text: string;
}

interface UseLiveQAOptions {
  sessionId: string;
  voiceId?: string;
  silenceTimeoutMs?: number;
  maxQuestions?: number;
}

export function useLiveQA({
  sessionId,
  voiceId = "9BWtsMINqrJLrRacOk9x",
  silenceTimeoutMs = 1500,
  maxQuestions,
}: UseLiveQAOptions) {
  const [state, setState] = useState<LiveQAState>("IDLE");
  const [history, setHistory] = useState<LiveQAHistoryEntry[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<LiveQAState>("IDLE");
  const historyRef = useRef<LiveQAHistoryEntry[]>([]);
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

  const submitUtterance = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        updateState("LISTENING");
        return;
      }

      updateState("THINKING");
      setInterimTranscript("");

      const userEntry: LiveQAHistoryEntry = { role: "user", text: text.trim() };
      const newHistory = [...historyRef.current, userEntry];
      historyRef.current = newHistory;
      setHistory(newHistory);

      try {
        abortRef.current = new AbortController();

        // Get AI response
        const res = await fetch("/api/qa/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            utterance: text.trim(),
            history: historyRef.current.slice(0, -1), // exclude current utterance
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) throw new Error("Failed to get response");
        const { answer } = await res.json();

        // Add assistant entry
        const assistantEntry: LiveQAHistoryEntry = {
          role: "assistant",
          text: answer,
        };
        const updatedHistory = [...historyRef.current, assistantEntry];
        historyRef.current = updatedHistory;
        setHistory(updatedHistory);
        setCurrentAnswer(answer);

        // Get TTS audio
        const ttsRes = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: answer, mode: "recap", voiceId }),
          signal: abortRef.current.signal,
        });

        if (!ttsRes.ok) throw new Error("TTS failed");
        const audioBlob = await ttsRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Play audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          audioRef.current = null;
          if (stateRef.current === "SPEAKING") {
            updateState("LISTENING");
            utteranceRef.current = "";
          }
        };

        updateState("SPEAKING");
        await audio.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong");
        updateState("LISTENING");
        utteranceRef.current = "";
      }
    },
    [sessionId, voiceId, updateState]
  );

  const handleSpeechResult = useCallback(
    (transcript: string, isFinal: boolean) => {
      const currentState = stateRef.current;

      // Barge-in: interrupt AI if user starts speaking
      if (currentState === "SPEAKING") {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        abortRef.current?.abort();
        updateState("LISTENING");
        utteranceRef.current = "";
      }

      if (currentState === "THINKING") return; // ignore speech during thinking

      setInterimTranscript(transcript);

      if (isFinal && transcript.trim()) {
        utteranceRef.current = transcript;
        clearSilenceTimer();

        // Start silence timer — submit after pause
        silenceTimerRef.current = setTimeout(() => {
          const text = utteranceRef.current;
          utteranceRef.current = "";
          submitUtterance(text);
        }, silenceTimeoutMs);
      }
    },
    [updateState, clearSilenceTimer, submitUtterance, silenceTimeoutMs]
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

  const start = useCallback(() => {
    setError(null);
    setHistory([]);
    setCurrentAnswer("");
    setInterimTranscript("");
    historyRef.current = [];
    utteranceRef.current = "";
    updateState("LISTENING");
    startListening();
  }, [startListening, updateState]);

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

  return {
    state,
    transcript: interimTranscript || speechTranscript,
    history,
    currentAnswer,
    isListening,
    start,
    stop,
    error,
  };
}
