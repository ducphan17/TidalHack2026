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

type AnalyzeStep = "transcribing" | "computing" | "analyzing" | "done";

const ANALYZE_STEPS: { key: AnalyzeStep; label: string }[] = [
  { key: "transcribing", label: "Transcribing audio..." },
  { key: "computing", label: "Computing speech metrics..." },
  { key: "analyzing", label: "Analyzing presentation with AI..." },
];

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
  const [voiceCompare, setVoiceCompare] = useState<
    { model: string; label: string; url: string }[]
  >([]);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [analyzeStep, setAnalyzeStep] = useState<AnalyzeStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<AnalyzeStep>>(new Set());
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

    setAnalyzeStep(null);
    setCompletedSteps(new Set());

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
        throw new Error("Analysis failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let resultData: {
        sessionId: string;
        transcript: string;
        presentation_report: PresentationReport;
        qa_pack: { questions: QAQuestion[] } | null;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          if (!json) continue;

          const event = JSON.parse(json);

          if (event.step === "error") {
            throw new Error(event.message);
          }

          if (event.step === "done") {
            // Mark analyzing as completed
            setCompletedSteps((prev) => new Set(prev).add("analyzing"));
            setAnalyzeStep("done");
            resultData = event.data;
          } else {
            // Mark previous step as completed, set current
            setAnalyzeStep((prev) => {
              if (prev && prev !== "done") {
                setCompletedSteps((s) => new Set(s).add(prev));
              }
              return event.step;
            });
          }
        }
      }

      if (!resultData) throw new Error("No result received");

      setFeedback(resultData.presentation_report);
      setSessionId(resultData.sessionId);
      setTranscript(resultData.transcript ?? null);
      if (resultData.qa_pack?.questions?.length) {
        setQaPack(resultData.qa_pack.questions);
      }

      const newAttempt = attemptNumber + 1;
      setAttemptNumber(newAttempt);

      const newPoint: ProgressDataPoint = {
        date: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        score: resultData.presentation_report.score,
        attempt: newAttempt,
      };

      setHistory((prev) => [...prev, newPoint]);

      // Persist to history API
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: resultData.presentation_report.score, attempt: newAttempt }),
      }).catch(() => {
        // History persistence is optional
      });

      // Generate both voice options (Woman / Man) in parallel
      const voices = [
        { id: "9BWtsMINqrJLrRacOk9x", label: "Woman", icon: "👩" },
        { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Man", icon: "👨" },
      ];
      try {
        const results = await Promise.allSettled(
          voices.map(async (v) => {
            const voiceRes = await fetch("/api/voice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: data.presentation_report.summary,
                mode: "recap",
                voiceId: v.id,
              }),
            });
            if (!voiceRes.ok) throw new Error("failed");
            const audioBlob = await voiceRes.blob();
            return { model: v.id, label: `${v.icon} ${v.label}`, url: URL.createObjectURL(audioBlob) };
          })
        );
        const successful = results
          .filter((r): r is PromiseFulfilledResult<{ model: string; label: string; url: string }> => r.status === "fulfilled")
          .map((r) => r.value);
        setVoiceCompare(successful);
        // Default to Woman voice
        if (successful.length > 0) setVoiceUrl(successful[0].url);
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
      setAnalyzeStep(null);
      setCompletedSteps(new Set());
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
    setVoiceCompare([]);
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
    setVoiceCompare([]);
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
                3. Get feedback on delivery & content
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
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <div className="mt-6 w-full max-w-xs space-y-3">
              {ANALYZE_STEPS.map(({ key, label }) => {
                const isCompleted = completedSteps.has(key);
                const isCurrent = analyzeStep === key;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 text-sm transition-opacity ${
                      isCompleted || isCurrent
                        ? "opacity-100"
                        : "opacity-30"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-5 w-5 shrink-0 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : isCurrent ? (
                      <div className="h-5 w-5 shrink-0 flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
                    )}
                    <span
                      className={
                        isCompleted
                          ? "text-green-600 dark:text-green-400"
                          : isCurrent
                          ? "text-zinc-900 dark:text-zinc-100 font-medium"
                          : "text-zinc-400 dark:text-zinc-600"
                      }
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-zinc-400">
              This may take 15-30 seconds
            </p>
          </section>
        )}

        {step === "feedback" && feedback && (
          <section className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <ScoreCard score={feedback.score} label="Overall score" />
                <span className="absolute top-3 right-3 rounded-full bg-blue-100 dark:bg-blue-900 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                  Attempt #{attemptNumber}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="primary" onClick={handlePracticeAgain}>
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

            {voiceCompare.length > 0 && (
              <Card>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                  Choose Coach Voice
                </h3>
                <div className="space-y-3">
                  {voiceCompare.map((v) => (
                    <div key={v.model} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 w-36 shrink-0">
                        {v.label}
                      </span>
                      <VoicePlayer audioUrl={v.url} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  {feedback.summary}
                </p>
              </Card>
            )}
            {!voiceCompare.length && voiceUrl && (
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
