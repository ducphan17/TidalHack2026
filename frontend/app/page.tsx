"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  SlideUpload,
  RecordingControls,
  useMediaRecorder,
  AudioLevelMeter,
} from "@/components/recorder";
import {
  ScoreCard,
  FeedbackList,
  VoicePlayer,
} from "@/components/feedback";
import { QAPanel } from "@/components/qa";
import { ProgressChart, type ProgressDataPoint } from "@/components/charts";
import { Card, Button } from "@/components/shared";
import { useMedia } from "@/hooks";
import type { PresentationReport, QAQuestion, QAFeedback } from "@/services/gemini";

type Step = "upload" | "recording" | "analyzing" | "feedback" | "qa_active";

export default function MeetingRoom() {
  const [step, setStep] = useState<Step>("upload");
  const [pdfBase64, setPdfBase64] = useState("");
  const [slideCount, setSlideCount] = useState(0);
  const [qaOptIn, setQaOptIn] = useState(false);
  const [qaCount, setQaCount] = useState(3);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PresentationReport | null>(null);
  const [qaPack, setQaPack] = useState<QAQuestion[] | null>(null);
  const [qaResults, setQaResults] = useState<QAFeedback[]>([]);
  const [history, setHistory] = useState<ProgressDataPoint[]>([]);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const hasStartedRecording = useRef(false);

  const { stream, error: mediaError, startMicrophone, stopMicrophone } =
    useMedia();

  const {
    isRecording,
    blob,
    error: recordError,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useMediaRecorder({ stream });

  const handleSlidesUploaded = useCallback(
    (data: { slideCount: number; pdfBase64: string }) => {
      setPdfBase64(data.pdfBase64);
      setSlideCount(data.slideCount);
    },
    []
  );

  const handleStartRecording = useCallback(async () => {
    setFeedback(null);
    resetRecorder();
    hasStartedRecording.current = false;
    try {
      await startMicrophone();
      setStep("recording");
    } catch {
      setStep("upload");
    }
  }, [startMicrophone, resetRecorder]);

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
      startRecording();
    }
  }, [step, stream, isRecording, blob, startRecording]);

  const handleStopRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const analyzeAndShowFeedback = useCallback(async () => {
    if (!blob) return;

    const formData = new FormData();
    formData.append("audio_file", blob, "recording.webm");
    formData.append("slides_pdf_base64", pdfBase64);
    formData.append("qa_opt_in", qaOptIn ? "true" : "false");
    formData.append("qa_count", String(qaCount));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? "Analysis failed");
      }

      const data = await res.json();
      setFeedback(data.presentation_report);
      setSessionId(data.sessionId);
      setTranscript(data.transcript ?? null);
      if (data.qa_pack?.questions?.length) {
        setQaPack(data.qa_pack.questions);
      }

      setHistory((prev) => [
        {
          date: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          score: data.presentation_report.score,
        },
        ...prev,
      ]);

      // Auto-play coach recap
      try {
        const voiceRes = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.presentation_report.summary,
            mode: "recap",
          }),
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
        filler_words: [],
        unclear_terms: [],
        critique: { vocal: "", content: "", visual: "" },
        evidence: [],
        improvements: [],
      });
    } finally {
      setStep("feedback");
      stopMicrophone();
    }
  }, [blob, pdfBase64, qaOptIn, qaCount, stopMicrophone]);

  useEffect(() => {
    if (step === "recording" && !isRecording && blob) {
      setStep("analyzing");
      analyzeAndShowFeedback();
    }
  }, [step, isRecording, blob, analyzeAndShowFeedback]);

  const handleQAComplete = useCallback((results: QAFeedback[]) => {
    setQaResults(results);
    setStep("feedback");
  }, []);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFeedback(null);
    setVoiceUrl(null);
    setSessionId(null);
    setQaPack(null);
    setQaResults([]);
    setTranscript(null);
  }, []);

  const error = mediaError ?? recordError;
  const canStartRecording = pdfBase64.length > 0;

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
                1. Upload your PDF slides
                <br />
                2. Record yourself presenting (voice only)
                <br />
                3. Get feedback on delivery, content & visuals
              </p>
            </div>

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 1: Upload slides
              </h3>
              <SlideUpload onSlidesUploaded={handleSlidesUploaded} />
              {slideCount > 0 && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                  {slideCount} slide{slideCount !== 1 ? "s" : ""} detected
                </p>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Q&A Practice (optional)
              </h3>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qaOptIn}
                  onChange={(e) => setQaOptIn(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Generate Q&A questions after feedback
                </span>
              </label>
              {qaOptIn && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">
                    Number of questions:
                  </label>
                  <select
                    value={qaCount}
                    onChange={(e) => setQaCount(Number(e.target.value))}
                    className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                <span className="font-medium">Recording voice...</span>
              </div>
              <AudioLevelMeter stream={stream} />
              <div className="flex items-center justify-between mt-4">
                <RecordingControls
                  isRecording={isRecording}
                  canStart={!!stream}
                  onStart={handleStartRecording}
                  onStop={handleStopRecording}
                />
              </div>
            </Card>

            {pdfBase64 && (
              <Card>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Your Slides
                </h3>
                <iframe
                  src={`data:application/pdf;base64,${pdfBase64}`}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
                  style={{ height: "70vh" }}
                  title="Presentation slides"
                />
              </Card>
            )}
          </section>
        )}

        {step === "analyzing" && (
          <section className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Transcribing and analyzing your presentation...
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              This may take 15-30 seconds (free tier)
            </p>
          </section>
        )}

        {step === "feedback" && feedback && (
          <section className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <ScoreCard score={feedback.score} label="Overall score" />
              <div className="flex flex-col gap-2">
                <Button variant="primary" onClick={handleReset}>
                  Record again
                </Button>
                {qaPack && qaPack.length > 0 && sessionId && (
                  <Button
                    variant="secondary"
                    onClick={() => setStep("qa_active")}
                  >
                    Start Q&A Practice
                  </Button>
                )}
              </div>
            </div>

            {voiceUrl && (
              <VoicePlayer audioUrl={voiceUrl} text={feedback.summary} />
            )}

            {transcript && (
              <Card>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  What we heard
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {transcript}
                </p>
              </Card>
            )}

            <FeedbackList feedback={feedback} />

            {qaResults.length > 0 && (
              <Card>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Q&A Results
                </h3>
                <div className="space-y-2">
                  {qaResults.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-600 dark:text-zinc-400">
                        Question {i + 1}
                      </span>
                      <span className="font-medium">{r.score}/10</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Progress
              </h3>
              <ProgressChart data={history} />
            </Card>
          </section>
        )}

        {step === "qa_active" && qaPack && sessionId && (
          <QAPanel
            questions={qaPack}
            sessionId={sessionId}
            onComplete={handleQAComplete}
          />
        )}
      </main>
    </div>
  );
}
