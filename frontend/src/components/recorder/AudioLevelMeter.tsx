"use client";

import { useEffect, useRef, useState } from "react";

interface AudioLevelMeterProps {
  stream: MediaStream | null;
}

export function AudioLevelMeter({ stream }: AudioLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const animRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream) return;

    const audioCtx = new AudioContext();
    ctxRef.current = audioCtx;
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(Math.min(100, Math.round((avg / 128) * 100)));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtx.close();
    };
  }, [stream]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-white/70 w-8">Mic</span>
      <div className="flex-1 h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${level}%`,
            backgroundColor:
              level > 60 ? "#22c55e" : level > 20 ? "#eab308" : "#a1a1aa",
          }}
        />
      </div>
    </div>
  );
}
