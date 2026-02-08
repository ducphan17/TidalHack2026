"use client";

import { Button } from "@/components/shared";

interface RecordingControlsProps {
  isRecording: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  isLoading?: boolean;
}

export function RecordingControls({
  isRecording,
  canStart,
  onStart,
  onStop,
  isLoading = false,
}: RecordingControlsProps) {
  return (
    <div className="flex gap-4">
      {isRecording ? (
        <Button
          variant="danger"
          size="lg"
          onClick={onStop}
          className="gap-2"
        >
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-white" />
          Stop Recording
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          onClick={onStart}
          disabled={!canStart}
          isLoading={isLoading}
          className="gap-2"
        >
          Start Recording
        </Button>
      )}
    </div>
  );
}
