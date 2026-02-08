"use client";

import { useEffect, useRef, useState } from "react";

interface CircularAudioVisualizerProps {
  stream: MediaStream | null;
  size?: number;
  barCount?: number;
}

export function CircularAudioVisualizer({
  stream,
  size = 200,
  barCount = 24,
}: CircularAudioVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(Array(barCount).fill(0));
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
      const bucketSize = Math.floor(data.length / barCount);
      const newLevels: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const start = i * bucketSize;
        const bucket = data.slice(start, start + bucketSize);
        const avg =
          bucket.reduce((a, b) => a + b, 0) / (bucket.length || 1);
        newLevels.push(Math.min(100, (avg / 128) * 100));
      }
      setLevels(newLevels);
      animRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtx.close();
    };
  }, [stream, barCount]);

  const radius = size / 2;
  const innerRadius = radius * 0.38;
  const maxBarLength = radius - 12;
  const barWidth = 3;
  const gapAngle = (2 * Math.PI) / barCount;

  return (
    <svg
      width={size}
      height={size}
      className="overflow-visible"
      aria-hidden
    >
      {levels.map((level, i) => {
        const angle = (i * gapAngle) - Math.PI / 2;
        const minLength = innerRadius + 4;
        const barLength = minLength + (level / 100) * (maxBarLength - minLength);
        const x1 = radius + innerRadius * Math.cos(angle);
        const y1 = radius + innerRadius * Math.sin(angle);
        const x2 = radius + barLength * Math.cos(angle);
        const y2 = radius + barLength * Math.sin(angle);

        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#77A5C6"
            strokeWidth={barWidth}
            strokeLinecap="round"
            opacity={0.4 + (level / 100) * 0.6}
            style={{
              transition: "opacity 0.05s ease-out",
            }}
          />
        );
      })}
    </svg>
  );
}
