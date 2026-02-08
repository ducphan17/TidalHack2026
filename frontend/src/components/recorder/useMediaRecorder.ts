"use client";

import { useState, useCallback, useRef } from "react";

export interface UseMediaRecorderOptions {
  stream: MediaStream | null;
  mimeType?: string;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}

export function useMediaRecorder({
  stream,
  mimeType = "audio/webm;codecs=opus",
  videoBitsPerSecond,
  audioBitsPerSecond = 128_000,
}: UseMediaRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (!stream) {
      setError("No media stream available");
      return;
    }

    setError(null);
    setBlob(null);
    chunksRef.current = [];

    const fallbackMime = "audio/webm";
    const options: MediaRecorderOptions = {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : fallbackMime,
      audioBitsPerSecond,
    };

    try {
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          setBlob(new Blob(chunksRef.current, { type: recorder.mimeType }));
        }
        setIsRecording(false);
      };

      recorder.onerror = (e) => {
        setError((e as ErrorEvent).message ?? "Recording failed");
        setIsRecording(false);
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
    }
  }, [stream, mimeType, audioBitsPerSecond]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    chunksRef.current = [];
  }, []);

  return {
    isRecording,
    blob,
    error,
    startRecording,
    stopRecording,
    reset,
  };
}
