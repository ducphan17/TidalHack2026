"use client";

interface RecordingControlsProps {
  isRecording: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
  isLoading?: boolean;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function RecordingControls({
  isRecording,
  canStart,
  onStart,
  onStop,
  isLoading = false,
}: RecordingControlsProps) {
  return (
    <button
      type="button"
      onClick={isRecording ? onStop : onStart}
      disabled={!canStart && !isRecording}
      className={`
        relative flex items-center justify-center rounded-full
        w-20 h-20 min-w-[80px] min-h-[80px]
        transition-all duration-300 ease-out
        focus:outline-none focus:ring-4 focus:ring-[#77A5C6]/40
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        ${isRecording
          ? "bg-red-500/90 hover:bg-red-500 text-white shadow-lg shadow-red-500/30"
          : "bg-[#77A5C6] hover:bg-[#5f8fb5] text-white shadow-lg shadow-[#77A5C6]/30"
        }
      `}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      {isLoading ? (
        <span className="w-8 h-8 border-2 border-white/60 border-t-white rounded-full animate-spin" />
      ) : isRecording ? (
        <StopIcon className="w-8 h-8" />
      ) : (
        <MicIcon className="w-10 h-10" />
      )}
    </button>
  );
}
