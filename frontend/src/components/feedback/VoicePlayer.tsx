"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button, Card } from "@/components/shared";

interface VoicePlayerProps {
  audioUrl: string | null;
  text?: string;
  /** When provided, renders as a compact inline button (no Card wrapper) */
  label?: string;
}

export function VoicePlayer({ audioUrl, text, label }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el || !text) return;
    setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [text, expanded]);

  const togglePlay = useCallback(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  if (!audioUrl) return null;

  // Compact inline mode — just a button with a label, no Card wrapper
  if (label) {
    return (
      <Button
        variant={isPlaying ? "secondary" : "primary"}
        size="md"
        onClick={togglePlay}
        className="justify-start gap-2"
      >
        <span>{isPlaying ? "⏸" : "▶"}</span>
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <Card className="flex items-center gap-4">
      <Button
        variant={isPlaying ? "secondary" : "primary"}
        size="md"
        onClick={togglePlay}
        className="justify-start gap-2"
      >
        <span>{isPlaying ? "⏸" : "▶"}</span>
        <span>{isPlaying ? "Pause" : "Play feedback"}</span>
      </Button>
      {text && (
        <div className="flex-1 min-w-0">
          <p
            ref={textRef}
            className={`text-sm text-white ${!expanded ? "line-clamp-2" : ""}`}
          >
            {text}
          </p>
          {(isTruncated || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-[#77A5C6] hover:underline mt-0.5"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
