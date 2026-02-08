const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

export type CoachMode = "recap" | "question" | "qa_feedback";

type ElevenConfig = {
  voiceId: string;
  modelId: string;
  voice_settings: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
};

const MODE_CONFIG: Record<CoachMode, ElevenConfig> = {
  recap: {
    voiceId: "9BWtsMINqrJLrRacOk9x",
    modelId: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.28,
      similarity_boost: 0.78,
      style: 0.35,
      use_speaker_boost: true,
    },
  },
  question: {
    voiceId: "9BWtsMINqrJLrRacOk9x",
    modelId: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.32,
      similarity_boost: 0.78,
      style: 0.25,
      use_speaker_boost: true,
    },
  },
  qa_feedback: {
    voiceId: "9BWtsMINqrJLrRacOk9x",
    modelId: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.30,
      similarity_boost: 0.78,
      style: 0.30,
      use_speaker_boost: true,
    },
  },
};

/**
 * Convert analysis-style text into a spoken coach script.
 * Short sentences + pauses + audio tags (v3) = natural prosody.
 */
function toSpokenCoachScript(raw: string, mode: CoachMode): string {
  let t = (raw ?? "").trim();

  // Remove bullet formatting that makes narration sound like a report
  t = t
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n");

  // Convert mm:ss timestamps into natural phrasing
  t = t.replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, mm, ss) => {
    const m = Number(mm);
    const s = Number(ss);
    if (Number.isNaN(m) || Number.isNaN(s)) return "a moment there";
    if (m === 0) return `around ${s} seconds`;
    return `around ${m} minutes ${s} seconds`;
  });

  const paragraphs = t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (mode === "recap") {
    return paragraphs.map((p) => p).join("\n\n");
  }

  if (mode === "question") {
    return paragraphs.map((p) => p).join("\n\n");
  }

  // qa_feedback
  return paragraphs.map((p) => p).join("\n\n");
}

export const AVAILABLE_VOICES = [
  { id: "9BWtsMINqrJLrRacOk9x", label: "Woman", icon: "👩" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Man", icon: "👨" },
] as const;

export async function generateVoiceFeedback(
  text: string,
  mode: CoachMode = "recap",
  apiKey?: string,
  voiceIdOverride?: string
): Promise<Blob> {
  const key = apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");

  const cfg = MODE_CONFIG[mode];
  const voiceId = voiceIdOverride ?? cfg.voiceId;
  const modelId = cfg.modelId;

  // Strip audio tags — v2 reads them as literal text
  const script = toSpokenCoachScript(text, mode)
    .replace(/\[(calm|encouraging|friendly|supportive|pause)\]\s*/g, "");

  const url = `${ELEVENLABS_API}/text-to-speech/${voiceId}?output_format=mp3_44100_192`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": key,
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: script,
      model_id: modelId,
      apply_text_normalization: "auto",
      voice_settings: cfg.voice_settings,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error: ${res.status} ${err}`);
  }

  return res.blob();
}

export async function generateCoachSpeech(
  text: string,
  mode: CoachMode = "recap",
  voiceIdOverride?: string
): Promise<Blob> {
  return generateVoiceFeedback(text, mode, undefined, voiceIdOverride);
}
