import { AssemblyAI } from "assemblyai";

export interface Word {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface SpeechMetrics {
  pace_wpm: number;
  filler_rate_per_min: number;
  long_pauses_count: number;
  pause_ratio: number;
}

export interface TranscriptResult {
  transcript: string;
  words: Word[];
  disfluencies: string[];
}

const FILLER_WORDS = new Set([
  "um", "uh", "uh-huh", "hmm", "mm", "mhm",
  "like", "you know", "basically", "actually",
  "so", "right", "okay", "well", "i mean",
]);

export async function transcribeAudio(
  buffer: Buffer
): Promise<TranscriptResult> {
  const apiKey = process.env.STT_API_KEY;
  if (!apiKey) {
    throw new Error("STT_API_KEY is not set");
  }

  const client = new AssemblyAI({ apiKey });

  const transcript = await client.transcripts.transcribe({
    audio: buffer,
    word_boost: Array.from(FILLER_WORDS),
    speech_models: ["universal-2"],
  });

  if (transcript.status === "error") {
    throw new Error(`Transcription failed: ${transcript.error}`);
  }

  const words: Word[] = (transcript.words ?? []).map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence,
  }));

  const disfluencies = words
    .filter((w) => FILLER_WORDS.has(w.text.toLowerCase()))
    .map((w) => w.text.toLowerCase());

  return {
    transcript: transcript.text ?? "",
    words,
    disfluencies,
  };
}

export function computeMetrics(
  words: Word[],
  durationMs: number
): { metrics: SpeechMetrics; unclear_terms: Word[] } {
  const durationMin = durationMs / 60000;
  if (durationMin === 0) {
    return {
      metrics: {
        pace_wpm: 0,
        filler_rate_per_min: 0,
        long_pauses_count: 0,
        pause_ratio: 0,
      },
      unclear_terms: [],
    };
  }

  const totalWords = words.length;
  const pace_wpm = Math.round(totalWords / durationMin);

  const fillerCount = words.filter((w) =>
    FILLER_WORDS.has(w.text.toLowerCase())
  ).length;
  const filler_rate_per_min = Math.round((fillerCount / durationMin) * 10) / 10;

  let long_pauses_count = 0;
  let totalPauseMs = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 0) totalPauseMs += gap;
    if (gap > 2000) long_pauses_count++;
  }
  const pause_ratio =
    durationMs > 0 ? Math.round((totalPauseMs / durationMs) * 100) / 100 : 0;

  const unclear_terms = words.filter((w) => w.confidence < 0.65);

  return {
    metrics: { pace_wpm, filler_rate_per_min, long_pauses_count, pause_ratio },
    unclear_terms,
  };
}
