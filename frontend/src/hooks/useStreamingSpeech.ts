"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface SpeechTurnResult {
  finalText: string;
  interimText: string;
  combinedText: string;
  hasFinalChunk: boolean;
}

export interface UseStreamingSpeechOptions {
  autoRestart?: boolean;
  onResult?: (result: SpeechTurnResult) => void;
}

export function useStreamingSpeech(options: UseStreamingSpeechOptions = {}) {
  const { autoRestart = false } = options;
  const [isListening, setIsListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stoppedRef = useRef(true);

  // Fix stale closure
  const onResultRef = useRef(options.onResult);
  useEffect(() => {
    onResultRef.current = options.onResult;
  }, [options.onResult]);

  // Turn-based tracking
  const turnFinalRef = useRef("");
  const turnInterimRef = useRef("");

  const cleanup = useCallback(() => {
    console.log("[StreamingSpeech] Cleaning up...");
    
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    console.log("[StreamingSpeech] Starting...");
    setError(null);
    setFinalText("");
    setInterimText("");
    turnFinalRef.current = "";
    turnInterimRef.current = "";
    stoppedRef.current = false;

    try {
      // 1. Get temporary token
      const tokenRes = await fetch("/api/stt/token");
      if (!tokenRes.ok) throw new Error("Failed to get STT token");
      const { token } = await tokenRes.json();

      // 2. Connect to AssemblyAI WebSocket
      const ws = new WebSocket(
        `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
      );
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[StreamingSpeech] WebSocket connected");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.message_type === "PartialTranscript") {
          const partial = data.text || "";
          turnInterimRef.current = partial;
          setInterimText(partial);

          console.log("[StreamingSpeech] Partial:", partial);

          onResultRef.current?.({
            finalText: turnFinalRef.current,
            interimText: partial,
            combinedText: turnFinalRef.current + " " + partial,
            hasFinalChunk: false,
          });
        } else if (data.message_type === "FinalTranscript") {
          const final = data.text || "";
          turnFinalRef.current += (turnFinalRef.current ? " " : "") + final;
          turnInterimRef.current = "";

          setFinalText(turnFinalRef.current);
          setInterimText("");

          console.log("[StreamingSpeech] Final:", final);

          onResultRef.current?.({
            finalText: turnFinalRef.current,
            interimText: "",
            combinedText: turnFinalRef.current,
            hasFinalChunk: true,
          });
        } else if (data.message_type === "SessionBegins") {
          console.log("[StreamingSpeech] Session started");
        }
      };

      ws.onerror = (err) => {
        console.error("[StreamingSpeech] WebSocket error:", err);
        setError("Speech connection error");
      };

      ws.onclose = () => {
        console.log("[StreamingSpeech] WebSocket closed");
        if (!stoppedRef.current && autoRestart) {
          setTimeout(() => startListening(), 1000);
        } else {
          setIsListening(false);
        }
      };

      // 3. Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 4. Create AudioContext and AudioWorklet
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/audio-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "audio-processor");
      workletNodeRef.current = workletNode;

      // 5. Send PCM chunks to WebSocket
      workletNode.port.onmessage = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      source.connect(workletNode);

      setIsListening(true);
      console.log("[StreamingSpeech] Mic active, streaming to AssemblyAI");
    } catch (err) {
      console.error("[StreamingSpeech] Start error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start speech recognition"
      );
      cleanup();
    }
  }, [cleanup, autoRestart]);

  const stopListening = useCallback(() => {
    console.log("[StreamingSpeech] Stopping...");
    stoppedRef.current = true;
    cleanup();
  }, [cleanup]);

  // Soft reset: start a new turn without restarting recognition
  const beginTurn = useCallback(() => {
    console.log("[StreamingSpeech] Beginning new turn");
    turnFinalRef.current = "";
    turnInterimRef.current = "";
    setFinalText("");
    setInterimText("");
  }, []);

  // Get committed final text for current turn
  const getTurnFinalText = useCallback(() => {
    return turnFinalRef.current;
  }, []);

  // Ensure listening (for compatibility with old hook API)
  const ensureListening = useCallback(() => {
    if (stoppedRef.current || !wsRef.current) {
      startListening();
    }
  }, [startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    finalText,
    interimText,
    transcript: finalText + " " + interimText,
    isListening,
    error,
    startListening,
    stopListening,
    ensureListening,
    beginTurn,
    getTurnFinalText,
  };
}
