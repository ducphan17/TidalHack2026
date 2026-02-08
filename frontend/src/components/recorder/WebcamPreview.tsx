"use client";

import { useRef, useEffect } from "react";

interface WebcamPreviewProps {
  stream: MediaStream | null;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
}

export function WebcamPreview({
  stream,
  muted = true,
  mirrored = true,
  className = "",
}: WebcamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  if (!stream) {
    return (
      <div
        className={`flex aspect-video w-full items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 ${className}`}
      >
        <span>Camera off</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`aspect-video w-full rounded-xl bg-black object-cover ${mirrored ? "scale-x-[-1]" : ""} ${className}`}
    />
  );
}
