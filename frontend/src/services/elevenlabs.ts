const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

export async function generateVoiceFeedback(
  text: string,
  voiceId = "21m00Tcm4TlvDq8ikWAM",
  apiKey?: string
): Promise<Blob> {
  const key = apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const res = await fetch(
    `${ELEVENLABS_API}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": key,
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs API error: ${res.status} ${err}`);
  }

  return res.blob();
}
