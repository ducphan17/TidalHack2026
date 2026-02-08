"use client";

import { useState, useCallback, useEffect } from "react";

export interface MediaState {
  stream: MediaStream | null;
  error: string | null;
  isReady: boolean;
}

export function useMedia() {
  const [state, setState] = useState<MediaState>({
    stream: null,
    error: null,
    isReady: false,
  });

  const startMicrophone = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      setState({ stream, error: null, isReady: true });
      return stream;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not access microphone";
      setState((s) => ({ ...s, error: message, isReady: false }));
      throw err;
    }
  }, []);

  const stopCamera = useCallback(() => {
    setState((s) => {
      if (s.stream) {
        s.stream.getTracks().forEach((track) => track.stop());
      }
      return { stream: null, error: null, isReady: false };
    });
  }, []);

  useEffect(() => {
    return () => {
      if (state.stream) {
        state.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [state.stream]);

  return { ...state, startMicrophone, stopMicrophone: stopCamera };
}
