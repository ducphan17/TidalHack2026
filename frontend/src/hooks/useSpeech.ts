"use client";

import { useState, useCallback, useRef } from "react";

export type SpeechEngine = "webspeech" | "elevenlabs";

export interface UseSpeechOptions {
  engine?: SpeechEngine;
  autoRestart?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
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
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

export function useSpeech(options: UseSpeechOptions = {}) {
  const { engine = "webspeech", autoRestart = false, onResult } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const stoppedRef = useRef(true);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    transcriptRef.current = "";

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
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          if (result.isFinal) {
            finalTranscript += text;
          } else {
            interimTranscript += text;
          }
        }
        transcriptRef.current += finalTranscript;
        const full = transcriptRef.current + interimTranscript;
        setTranscript(full);
        onResult?.(full, interimTranscript === "");
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
  }, [engine, autoRestart, onResult]);

  const stopListening = useCallback(() => {
    stoppedRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return {
    transcript,
    isListening,
    error,
    startListening,
    stopListening,
    setTranscript,
  };
}
