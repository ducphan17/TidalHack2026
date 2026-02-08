"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  SlideUpload,
  RecordingControls,
  useMediaRecorder,
} from "@/components/recorder";
import {
  ScoreCard,
  FeedbackList,
  VoicePlayer,
} from "@/components/feedback";
import { ProgressChart, type ProgressDataPoint } from "@/components/charts";
import { Card, Button } from "@/components/shared";
import { useMedia } from "@/hooks";
import { useSpeech } from "@/hooks/useSpeech";
import type { AnalysisFeedback } from "@/services/gemini";

type Step = "upload" | "recording" | "analyzing" | "feedback";

export default function MeetingRoom() {
  const [step, setStep] = useState<Step>("upload");
  const [slideContent, setSlideContent] = useState("");
  const [feedback, setFeedback] = useState<AnalysisFeedback | null>(null);
  const [history, setHistory] = useState<ProgressDataPoint[]>([]);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const hasStartedRecording = useRef(false);

  const { stream, error: mediaError, isReady, startMicrophone, stopMicrophone } =
    useMedia();
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    setTranscript,
  } = useSpeech({ onResult: () => {} });

  const {
    isRecording,
    blob,
    error: recordError,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useMediaRecorder({ stream });

  const handleStartRecording = useCallback(async () => {
    setFeedback(null);
    setTranscript("");
    resetRecorder();
    hasStartedRecording.current = false;
    try {
      await startMicrophone();
      setStep("recording");
    } catch {
      setStep("upload");
    }
  }, [startMicrophone, setTranscript, resetRecorder]);

  // Start recording only after React has re-rendered with the stream
  useEffect(() => {
    if (
      step === "recording" &&
      stream &&
      !isRecording &&
      !blob &&
      !hasStartedRecording.current
    ) {
      hasStartedRecording.current = true;
      startListening();
      startRecording();
    }
  }, [step, stream, isRecording, blob, startListening, startRecording]);

  const handleStopRecording = useCallback(() => {
    stopListening();
    stopRecording();
  }, [stopListening, stopRecording]);

  const analyzeAndShowFeedback = useCallback(async () => {
    if (!blob) return;

    const formData = new FormData();
    formData.append("transcript", transcript || "(No speech detected)");
    formData.append("slideContent", slideContent);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data: AnalysisFeedback = await res.json();
      setFeedback(data);

      setHistory((prev) => [
        {
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          score: data.score,
        },
        ...prev,
      ]);

      try {
        const voiceRes = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: data.summary }),
        });
        if (voiceRes.ok) {
          const audioBlob = await voiceRes.blob();
          setVoiceUrl(URL.createObjectURL(audioBlob));
        }
      } catch {
        // Voice is optional
      }
    } catch (err) {
      console.error(err);
      setFeedback({
        score: 0,
        summary: err instanceof Error ? err.message : "Analysis failed",
        fillerWords: {
          items: [],
          totalCount: 0,
          feedback: "",
        },
        contentAlignment: {
          matches: [],
          missing: [],
          extra: [],
          feedback: "",
        },
        improvements: [],
      });
    } finally {
      setStep("feedback");
      stopMicrophone();
    }
  }, [blob, transcript, slideContent, stopMicrophone]);

  useEffect(() => {
    if (step === "recording" && !isRecording && blob) {
      setStep("analyzing");
      analyzeAndShowFeedback();
    }
  }, [step, isRecording, blob, analyzeAndShowFeedback]);

  const error = mediaError ?? recordError;
  const canStartRecording = slideContent.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Present AI
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Practice like you have feedback
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {step === "upload" && !feedback && (
          <section className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-white">
              <h2 className="text-xl font-semibold">
                Upload slides, then record your voice
              </h2>
              <p className="mt-2 text-blue-100">
                1. Upload your PPTX slides
                <br />
                2. Record yourself presenting (voice only)
                <br />
                3. Get feedback on filler words & content alignment
              </p>
            </div>

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 1: Upload slides
              </h3>
              <SlideUpload onSlidesParsed={setSlideContent} />
            </Card>

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 2: Record
              </h3>
              <RecordingControls
                isRecording={false}
                canStart={canStartRecording}
                onStart={handleStartRecording}
                onStop={() => {}}
                isLoading={false}
              />
              {!canStartRecording && (
                <p className="mt-2 text-sm text-zinc-500">
                  Upload slides first to enable recording
                </p>
              )}
            </Card>

            {error && (
              <Card
                variant="outlined"
                className="border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
              >
                {error}
              </Card>
            )}

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Your progress
              </h3>
              <ProgressChart data={history} />
            </Card>
          </section>
        )}

        {step === "recording" && (
          <section className="space-y-6">
            <Card>
              <div className="flex items-center gap-3 py-4">
                <span className="flex h-4 w-4 animate-pulse rounded-full bg-red-500" />
                <span className="font-medium">Recording voice…</span>
              </div>
              <div className="flex items-center justify-between">
                <RecordingControls
                  isRecording={isRecording}
                  canStart={!!stream}
                  onStart={handleStartRecording}
                  onStop={handleStopRecording}
                />
                {isListening && (
                  <span className="text-sm text-zinc-500">Listening…</span>
                )}
              </div>
            </Card>
            {transcript && (
              <Card variant="outlined">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-6">
                  {transcript}
                </p>
              </Card>
            )}
          </section>
        )}

        {step === "analyzing" && (
          <section className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Analyzing your presentation…
            </p>
          </section>
        )}

        {step === "feedback" && feedback && (
          <section className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <ScoreCard score={feedback.score} label="Overall score" />
              <Button
                variant="primary"
                onClick={() => {
                  setStep("upload");
                  setFeedback(null);
                  setVoiceUrl(null);
                }}
              >
                Record again
              </Button>
            </div>

            {voiceUrl && (
              <VoicePlayer audioUrl={voiceUrl} text={feedback.summary} />
            )}

            <FeedbackList feedback={feedback} />

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Progress
              </h3>
              <ProgressChart data={history} />
            </Card>
          </section>
        )}
      </main>
    </div>
  );
}
