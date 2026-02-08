"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type SpeechEngine = "webspeech" | "elevenlabs";

export interface SpeechTurnResult {
  finalText: string;
  interimText: string;
  combinedText: string;
  hasFinalChunk: boolean;
}

export interface UseSpeechOptions {
  engine?: SpeechEngine;
  autoRestart?: boolean;
  onResult?: (result: SpeechTurnResult) => void;
}

// Web Speech API types (not in all TS libs)
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionInstance {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export function useSpeech(options: UseSpeechOptions = {}) {
  const { engine = "webspeech", autoRestart = false } = options;
  const [isListening, setIsListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const stoppedRef = useRef(true);

  // Fix stale closure: always read latest onResult via ref
  const onResultRef = useRef(options.onResult);
  useEffect(() => {
    onResultRef.current = options.onResult;
  }, [options.onResult]);

  // Turn-based: soft reset via base index
  const turnBaseIndexRef = useRef(0);
  const resultsLenRef = useRef(0);
  const turnFinalRef = useRef("");

  const startListening = useCallback(() => {
    setError(null);
    setFinalText("");
    setInterimText("");
    turnFinalRef.current = "";
    turnBaseIndexRef.current = 0;
    resultsLenRef.current = 0;

    if (engine === "webspeech") {
      const SpeechRecognition =
        typeof window !== "undefined" &&
        ((window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
          .webkitSpeechRecognition ||
          (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
            .SpeechRecognition);

      if (!SpeechRecognition) {
        setError("Web Speech API not supported in this browser");
        return;
      }

      const recognition = new SpeechRecognition() as SpeechRecognitionInstance;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        resultsLenRef.current = event.results.length;

        let turnFinal = "";
        let turnInterim = "";

        // Only process results from current turn
        for (let i = turnBaseIndexRef.current; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            turnFinal += text;
          } else {
            turnInterim += text;
          }
        }

        turnFinalRef.current = turnFinal;
        const combined = turnFinal + turnInterim;
        const hasFinalChunk = turnFinal.length > 0 && turnInterim.length === 0;

        setFinalText(turnFinal);
        setInterimText(turnInterim);

        onResultRef.current?.({
          finalText: turnFinal,
          interimText: turnInterim,
          combinedText: combined,
          hasFinalChunk,
        });
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent & { error?: string }) => {
        if (event.error === "no-speech" && autoRestart && !stoppedRef.current) {
          return;
        }
        setError(event.error ?? "Unknown error");
        setIsListening(false);
      };

      recognition.onend = () => {
        if (autoRestart && !stoppedRef.current) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
          return;
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      stoppedRef.current = false;
      recognition.start();
      setIsListening(true);
    } else {
      setError("ElevenLabs real-time STT requires API integration");
    }
  }, [engine, autoRestart]);

  const stopListening = useCallback(() => {
    stoppedRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Soft reset: start a new turn without restarting recognition
  const beginTurn = useCallback(() => {
    turnBaseIndexRef.current = resultsLenRef.current;
    turnFinalRef.current = "";
    setFinalText("");
    setInterimText("");
  }, []);

  // Get committed final text for current turn
  const getTurnFinalText = useCallback(() => {
    return turnFinalRef.current;
  }, []);

  return {
    finalText,
    interimText,
    transcript: finalText + interimText, // backwards compat
    isListening,
    error,
    startListening,
    stopListening,
    beginTurn,
    getTurnFinalText,
  };
}
