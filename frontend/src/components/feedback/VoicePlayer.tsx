"use client";

import { useState, useRef, useCallback } from "react";
import { Button, Card } from "@/components/shared";

interface VoicePlayerProps {
  audioUrl: string | null;
  text?: string;
}

export function VoicePlayer({ audioUrl, text }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {text}
        </p>
      )}
    </Card>
  );
}
