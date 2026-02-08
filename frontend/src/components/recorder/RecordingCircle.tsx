"use client";

import { RecordingControls } from "./RecordingControls";
import { CircularAudioVisualizer } from "./CircularAudioVisualizer";

interface RecordingCircleProps {
  isRecording: boolean;
  canStart: boolean;
  stream: MediaStream | null;
  onStart: () => void;
  onStop: () => void;
  isLoading?: boolean;
}

const SIZE = 240;

export function RecordingCircle({
  isRecording,
  canStart,
  stream,
  onStart,
  onStop,
  isLoading = false,
}: RecordingCircleProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      {isRecording && stream && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <CircularAudioVisualizer
            stream={stream}
            size={SIZE}
            barCount={24}
          />
        </div>
      )}
      <div className="relative z-10">
        <RecordingControls
          isRecording={isRecording}
          canStart={canStart}
          onStart={onStart}
          onStop={onStop}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
