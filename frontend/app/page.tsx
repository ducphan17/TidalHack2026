"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { LandingPage } from "@/components/landing";
import {
  SlideUpload,
  RecordingCircle,
  useMediaRecorder,
} from "@/components/recorder";
import {
  ScoreCard,
  ScoreBreakdownPanel,
  FeedbackList,
  VoicePlayer,
} from "@/components/feedback";
import { QAPanel } from "@/components/qa";
import { ProgressChart, type ProgressDataPoint } from "@/components/charts";
import { Card, Button } from "@/components/shared";
import { useMedia } from "@/hooks";
import type { PresentationReport, QAQuestion, QAFeedback } from "@/services/gemini";

type Step =
  | "upload"
  | "recording"
  | "recorded_pending"
  | "analyzing"
  | "feedback"
  | "qa_active";

export default function MeetingRoom() {
  const [showLanding, setShowLanding] = useState(true);
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
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const hasStartedRecording = useRef(false);

  // Load history from API on mount
  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((records: Array<{ score: number; attempt: number; timestamp: string }>) => {
        if (Array.isArray(records) && records.length > 0) {
          const points: ProgressDataPoint[] = records.map((r) => ({
            date: new Date(r.timestamp).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            score: r.score,
            attempt: r.attempt,
          }));
          // API returns newest first, chart needs oldest first
          setHistory(points.reverse());
          const maxAttempt = Math.max(...records.map((r) => r.attempt ?? 0));
          setAttemptNumber(maxAttempt);
        }
      })
      .catch(() => {
        // History is optional
      });
  }, []);

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
    formData.append("slide_count", String(slideCount));
    formData.append("qa_opt_in", qaOptIn ? "true" : "false");
    formData.append("qa_count", String(qaCount));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error ?? "Analysis failed";
        if (msg.includes("no spoken audio")) {
          throw new Error(
            "No speech detected. Make sure your microphone is working and try speaking clearly."
          );
        }
        throw new Error(msg);
      }

      const data = await res.json();
      setFeedback(data.presentation_report);
      setSessionId(data.sessionId);
      setTranscript(data.transcript ?? null);
      if (data.qa_pack?.questions?.length) {
        setQaPack(data.qa_pack.questions);
      }

      const newAttempt = attemptNumber + 1;
      setAttemptNumber(newAttempt);

      const newPoint: ProgressDataPoint = {
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        score: data.presentation_report.score,
        attempt: newAttempt,
      };

      setHistory((prev) => [...prev, newPoint]);

      // Persist to history API
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: data.presentation_report.score, attempt: newAttempt }),
      }).catch(() => {
        // History persistence is optional
      });

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
        critique: { vocal: "", content: "" },
        evidence: [],
        improvements: [],
      });
    } finally {
      setStep("feedback");
      stopMicrophone();
    }
  }, [blob, pdfBase64, slideCount, qaOptIn, qaCount, stopMicrophone, attemptNumber]);

  useEffect(() => {
    if (step === "recording" && !isRecording && blob) {
      setStep("recorded_pending");
    }
  }, [step, isRecording, blob]);

  const handleConfirmAnalyze = useCallback(() => {
    if (blob) {
      setStep("analyzing");
      analyzeAndShowFeedback();
    }
  }, [blob, analyzeAndShowFeedback]);

  const handleCancelToDashboard = useCallback(() => {
    resetRecorder();
    hasStartedRecording.current = false;
    setStep("upload");
  }, [resetRecorder]);

  const handleReRecord = useCallback(() => {
    resetRecorder();
    hasStartedRecording.current = false;
    setStep("recording");
  }, [resetRecorder]);

  const handleQAComplete = useCallback((results: QAFeedback[]) => {
    setQaResults(results);
    setStep("feedback");
  }, []);

  const handlePracticeAgain = useCallback(async () => {
    setFeedback(null);
    setVoiceUrl(null);
    setSessionId(null);
    setQaPack(null);
    setQaResults([]);
    setTranscript(null);
    resetRecorder();
    hasStartedRecording.current = false;
    try {
      await startMicrophone();
      setStep("recording");
    } catch {
      setStep("upload");
    }
  }, [resetRecorder, startMicrophone]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setFeedback(null);
    setVoiceUrl(null);
    setSessionId(null);
    setQaPack(null);
    setQaResults([]);
    setTranscript(null);
    setPdfBase64("");
    setSlideCount(0);
    setQaOptIn(false);
    setQaCount(3);
    setAttemptNumber(0);
    setHistory([]);
    resetRecorder();
  }, [resetRecorder]);

  const error = mediaError ?? recordError;
  const canStartRecording = pdfBase64.length > 0;

  const panelDropVariants = {
    hidden: { y: -60, opacity: 0 },
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
    }),
  };

  if (showLanding) {
    return (
      <LandingPage
        projectName="Presently.ai"
        onComplete={() => setShowLanding(false)}
      />
    );
  }

  return (
    <div>
      <header className="backdrop-blur-xl bg-white/50 dark:bg-zinc-900/50 border-b border-zinc-200/50 dark:border-zinc-700/50 shadow-lg">
        <div className="w-full px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 flex items-center justify-center shrink-0">
            <Image
              src="/header-logo.png"
              alt="Presently.ai"
              width={56}
              height={56}
              className="object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--heading)] dark:text-zinc-100">
              Presently.ai
            </h1>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        {(step === "upload" || step === "recording") && !feedback && (
          <div className={`relative ${step === "recording" ? "min-h-[70vh]" : ""}`}>
            {/* Upload section - fades out smoothly when recording */}
            <section
              className={`space-y-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                step === "recording"
                  ? "opacity-0 pointer-events-none absolute inset-x-0 top-0"
                  : "opacity-100"
              }`}
            >
            <motion.div
              custom={0}
              initial="hidden"
              animate="visible"
              variants={panelDropVariants}
              className="rounded-2xl backdrop-blur-xl bg-white/50 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-700/50 transition-shadow duration-300 panel-hover-shadow"
            >
                <button
                  type="button"
                  onClick={() => setStepsExpanded((e) => !e)}
                  className="w-full px-8 py-6 flex items-start justify-between gap-4 text-left"
                >
                  <h2 className="text-xl font-semibold text-[var(--heading)] dark:text-zinc-100 shrink-0">
                    Upload slides, then record your voice
                  </h2>
                  <svg
                    className={`w-5 h-5 text-zinc-600 dark:text-zinc-400 shrink-0 transition-transform ${stepsExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {stepsExpanded && (
                  <div className="px-8 pb-6 pl-12">
                    <p className="text-zinc-400 max-w-md">
                      1. Upload your PDF slides
                      <br />
                      2. Record yourself presenting (voice only)
                      <br />
                      3. Get feedback on delivery & content
                    </p>
                  </div>
                )}
            </motion.div>

            <motion.div
              custom={1}
              initial="hidden"
              animate="visible"
              variants={panelDropVariants}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <Card>
                <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-4">
                  Step 1: Upload slides
                </h3>
                <div className="pl-4 max-w-2xl">
                  <SlideUpload onSlidesUploaded={handleSlidesUploaded} />
                  {slideCount > 0 && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                      {slideCount} slide{slideCount !== 1 ? "s" : ""} detected
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-4">
                  Step 2: Record
                </h3>
                <div className="flex flex-col items-center gap-4 py-4">
                  <RecordingCircle
                    isRecording={false}
                    canStart={canStartRecording}
                    stream={null}
                    onStart={handleStartRecording}
                    onStop={() => {}}
                    isLoading={false}
                  />
                  {!canStartRecording && (
                    <p className="text-sm text-white">
                      Upload slides first to enable recording
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>

            <motion.div custom={2} initial="hidden" animate="visible" variants={panelDropVariants}>
            <Card>
              <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-4">
                Q&A Practice (optional)
              </h3>
              <div className="pl-4 max-w-2xl">
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
              </div>
            </Card>
            </motion.div>

            {error && (
              <motion.div custom={3} initial="hidden" animate="visible" variants={panelDropVariants}>
                <Card
                  variant="outlined"
                  className="border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
                >
                  {error}
                </Card>
              </motion.div>
            )}
            </section>

            {/* Recording section - overlays and fades in smoothly */}
            <section
              className={`absolute inset-x-0 top-0 flex flex-col items-center pt-4 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                step === "recording" ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <Card className="w-full max-w-md animate-recording-panel-enter">
                <div className="flex flex-col items-center gap-6 py-8">
                  <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                    <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    Recording voice...
                  </p>
                  <RecordingCircle
                    isRecording={isRecording}
                    canStart={!!stream}
                    stream={stream}
                    onStart={handleStartRecording}
                    onStop={handleStopRecording}
                  />
                  <p className="text-xs text-zinc-500">Tap the circle to stop</p>
                </div>
              </Card>

              {pdfBase64 && (
                <Card className={`w-full mt-6 transition-opacity duration-300 ${isRecording ? "opacity-40" : "opacity-100"}`}>
                  <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-4">
                    Your Slides
                  </h3>
                  <iframe
                    src={`data:application/pdf;base64,${pdfBase64}`}
                    className="w-full rounded-lg border border-zinc-700"
                    style={{ height: "50vh" }}
                    title="Presentation slides"
                  />
                </Card>
              )}
            </section>
          </div>
        )}

        {step === "recorded_pending" && (
          <section className="space-y-6">
            <Card className="relative">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-8 px-6">
                <div />
                <div className="flex flex-col items-center gap-6 min-w-0">
                  <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                    <span className="flex h-5 w-5 shrink-0 rounded-full bg-green-500/20 p-1">
                      <svg
                        className="h-full w-full text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    <span className="font-medium">Recording complete</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center max-w-sm">
                    Your recording is ready. Re-record or start analysis to get
                    feedback.
                  </p>
                  <div className="flex shrink-0 gap-3">
                    <Button
                      variant="secondary"
                      onClick={handleReRecord}
                    >
                      Re-record
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleConfirmAnalyze}
                    >
                      Start analysis
                    </Button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelToDashboard}
                  className="justify-self-end p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="Cancel and return to dashboard"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </Card>
          </section>
        )}

        {step === "analyzing" && (
          <section className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-800 border-t-transparent" />
            <p className="mt-4 text-[var(--heading)] font-medium">
              Transcribing and analyzing your presentation...
            </p>
            <p className="mt-2 text-xs text-zinc-700">
              This may take 15-30 seconds (free tier)
            </p>
          </section>
        )}

        {step === "feedback" && feedback && (
          <section className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <ScoreCard score={feedback.score} label="Overall score" />
                <span className="absolute top-3 right-3 rounded-full bg-[#77A5C6]/20 px-2.5 py-0.5 text-xs font-medium text-[#77A5C6] dark:text-[#77A5C6]">
                  Attempt #{attemptNumber}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={handlePracticeAgain}
                  className="bg-white text-[var(--heading)] hover:bg-zinc-100 border border-zinc-200 shadow-sm"
                >
                  Practice Again
                </Button>
                <Button variant="secondary" onClick={handleReset}>
                  New Presentation
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

            {feedback.score_breakdown && (
              <ScoreBreakdownPanel
                breakdown={feedback.score_breakdown}
                relevanceGate={feedback.relevance_gate}
              />
            )}

            {voiceUrl && (
              <VoicePlayer audioUrl={voiceUrl} text={feedback.summary} />
            )}

            {transcript && (
              <Card>
                <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-2">
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
                <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-4">
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
              <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-4">
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
