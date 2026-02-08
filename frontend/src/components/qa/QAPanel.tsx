"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, Button } from "@/components/shared";
import { VoicePlayer } from "@/components/feedback";
import { RecordingControls, useMediaRecorder, AudioLevelMeter } from "@/components/recorder";
import { useMedia } from "@/hooks";
import type { QAQuestion, QAFeedback } from "@/services/gemini";

interface QAPanelProps {
  questions: QAQuestion[];
  sessionId: string;
  onComplete: (results: QAFeedback[]) => void;
}

type QAStep = "question" | "recording" | "grading" | "feedback";

export function QAPanel({ questions, sessionId, onComplete }: QAPanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [qaStep, setQaStep] = useState<QAStep>("question");
  const [results, setResults] = useState<QAFeedback[]>([]);
  const [currentFeedback, setCurrentFeedback] = useState<QAFeedback | null>(
    null
  );
  const [questionAudioUrl, setQuestionAudioUrl] = useState<string | null>(null);
  const [feedbackAudioUrl, setFeedbackAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasStartedRecording = useRef(false);
  const pendingRecord = useRef(false);

  const { stream, startMicrophone, stopMicrophone } = useMedia();
  const {
    isRecording,
    blob: answerBlob,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useMediaRecorder({ stream });

  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;

  // Auto-play question audio when entering a new question
  useEffect(() => {
    if (qaStep !== "question") return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: currentQuestion.question,
            mode: "question",
          }),
        });
        if (res.ok && !cancelled) {
          const audioBlob = await res.blob();
          const url = URL.createObjectURL(audioBlob);
          setQuestionAudioUrl(url);
          // Auto-play
          const audio = new Audio(url);
          audio.play().catch(() => {});
        }
      } catch {
        // Voice is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qaStep, currentQuestion]);

  const handleStartAnswer = useCallback(async () => {
    setError(null);
    resetRecorder();
    hasStartedRecording.current = false;
    pendingRecord.current = true;
    try {
      await startMicrophone();
      setQaStep("recording");
    } catch {
      setError("Could not access microphone");
      pendingRecord.current = false;
    }
  }, [startMicrophone, resetRecorder]);

  // Start recording after stream is ready (same pattern as main page)
  useEffect(() => {
    if (
      qaStep === "recording" &&
      stream &&
      !isRecording &&
      !answerBlob &&
      !hasStartedRecording.current &&
      pendingRecord.current
    ) {
      hasStartedRecording.current = true;
      pendingRecord.current = false;
      startRecording();
    }
  }, [qaStep, stream, isRecording, answerBlob, startRecording]);

  const handleStopAnswer = useCallback(() => {
    stopRecording();
    stopMicrophone();
  }, [stopRecording, stopMicrophone]);

  // Auto-grade when recording stops and blob is available
  useEffect(() => {
    if (qaStep === "recording" && !isRecording && answerBlob) {
      gradeAnswer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qaStep, isRecording, answerBlob]);

  const gradeAnswer = useCallback(async () => {
    if (!answerBlob) return;
    setQaStep("grading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("questionId", currentQuestion.id);
      formData.append("answer_audio", answerBlob, "answer.webm");

      const res = await fetch("/api/qa/grade", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Grading failed");
      }

      const { qa_feedback, coach_text } = await res.json();
      setCurrentFeedback(qa_feedback);
      setResults((prev) => [...prev, qa_feedback]);

      // Generate coach feedback audio
      try {
        const voiceRes = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: coach_text, mode: "qa_feedback" }),
        });
        if (voiceRes.ok) {
          const audioBlob = await voiceRes.blob();
          setFeedbackAudioUrl(URL.createObjectURL(audioBlob));
        }
      } catch {
        // Voice is optional
      }

      setQaStep("feedback");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed");
      setQaStep("question");
    }
  }, [answerBlob, sessionId, currentQuestion]);

  const handleNext = useCallback(() => {
    setCurrentFeedback(null);
    setQuestionAudioUrl(null);
    setFeedbackAudioUrl(null);
    resetRecorder();

    if (isLast) {
      onComplete(results);
    } else {
      setCurrentIndex((i) => i + 1);
      setQaStep("question");
    }
  }, [isLast, results, onComplete, resetRecorder]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--heading)] dark:text-zinc-100">
            Q&A Practice
          </h3>
          <span className="text-sm text-zinc-500">
            Question {currentIndex + 1} of {questions.length}
          </span>
        </div>

        <p className="text-zinc-700 dark:text-zinc-300 mb-2">
          {currentQuestion.question}
        </p>
        <p className="text-xs text-zinc-500 mb-4">
          Ref: {currentQuestion.slide_ref}
        </p>

        {qaStep === "question" && (
          <div className="flex gap-3">
            {questionAudioUrl && (
              <VoicePlayer audioUrl={questionAudioUrl} />
            )}
            <Button variant="primary" size="sm" onClick={handleStartAnswer}>
              Record your answer
            </Button>
          </div>
        )}

        {qaStep === "recording" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-4 w-4 animate-pulse rounded-full bg-red-500" />
              <span className="font-medium text-sm">Recording answer...</span>
            </div>
            <AudioLevelMeter stream={stream} />
            <RecordingControls
              isRecording={isRecording}
              canStart={!!stream}
              onStart={handleStartAnswer}
              onStop={handleStopAnswer}
            />
          </div>
        )}

        {qaStep === "grading" && (
          <div className="flex items-center gap-3 py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#77A5C6] border-t-transparent" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Grading your answer...
            </span>
          </div>
        )}
      </Card>

      {qaStep === "feedback" && currentFeedback && (
        <Card>
          <h4 className="font-semibold text-[var(--heading)] dark:text-zinc-100 mb-2">
            Feedback — Score: {currentFeedback.score}/10
          </h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
            {currentFeedback.feedback}
          </p>
          <div className="mb-4">
            <h5 className="text-xs font-medium text-zinc-500 mb-1">
              Suggested answer
            </h5>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {currentFeedback.suggested_answer}
            </p>
          </div>

          {feedbackAudioUrl && (
            <div className="mb-4">
              <VoicePlayer audioUrl={feedbackAudioUrl} text="Coach feedback" />
            </div>
          )}

          <Button variant="primary" onClick={handleNext}>
            {isLast ? "Finish Q&A" : "Next question"}
          </Button>
        </Card>
      )}

      {error && (
        <Card
          variant="outlined"
          className="border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
        >
          {error}
        </Card>
      )}
    </div>
  );
}
