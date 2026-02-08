"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button, Card } from "@/components/shared";

interface VoicePlayerProps {
  audioUrl: string | null;
  text?: string;
}

export function VoicePlayer({ audioUrl, text }: VoicePlayerProps) {
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
    }

    const audio = audioRef.current;

    if (isPlaying) {
      audio.pause();
      audio.currentTime = 0;
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [audioUrl, isPlaying]);

  if (!audioUrl) return null;

  return (
    <Card className="flex items-center gap-4">
      <Button
        variant={isPlaying ? "secondary" : "primary"}
        size="md"
        onClick={togglePlay}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play feedback"}
      </Button>
      {text && (
        <div className="flex-1 min-w-0">
          <p
            ref={textRef}
            className={`text-sm text-zinc-600 dark:text-zinc-400 ${!expanded ? "line-clamp-2" : ""}`}
          >
            {text}
          </p>
          {(isTruncated || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
