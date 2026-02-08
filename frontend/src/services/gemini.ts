export interface AnalysisFeedback {
  score: number;
  summary: string;
  fillerWords: {
    items: { word: string; count: number }[];
    totalCount: number;
    feedback: string;
  };
  contentAlignment: {
    matches: string[];
    missing: string[];
    extra: string[];
    feedback: string;
  };
  improvements: string[];
}

const ANALYSIS_PROMPT = `You are an expert presentation coach. Analyze this presentation and return JSON only.

You will receive:
1. TRANSCRIPT - what the presenter said
2. SLIDE CONTENT - the text from their slides

Evaluate in 2 main categories:

**1. FILLER WORDS (buzz words)**
Count: "um", "uh", "like", "you know", "basically", "actually", "so", "right", "okay" (when used as filler).
Return each word with its count and overall feedback.

**2. CONTENT ALIGNMENT**
Does the speech match the slide content?
- matches: key points from slides that were properly covered in the speech
- missing: important slide content the speaker did NOT address
- extra: topics the speaker talked about that weren't on the slides (may be good additions or off-topic)
- feedback: 2-3 sentences on how well the speech aligned with the slides

Return this exact JSON structure (no markdown, no extra text):
{
  "score": 7,
  "summary": "2-3 sentence overall assessment",
  "fillerWords": {
    "items": [{"word": "um", "count": 5}, {"word": "like", "count": 3}],
    "totalCount": 8,
    "feedback": "Brief assessment of filler word usage"
  },
  "contentAlignment": {
    "matches": ["Point A from slides was explained well"],
    "missing": ["Slide 3 key finding was not mentioned"],
    "extra": ["Speaker added useful context not on slides"],
    "feedback": "2-3 sentences on alignment"
  },
  "improvements": ["Concrete improvement 1", "Concrete improvement 2"]
}`;

export async function analyzePresentation(
  transcript: string,
  slideContent: string,
  apiKey?: string
): Promise<AnalysisFeedback> {
  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

  const text = `${ANALYSIS_PROMPT}

---

TRANSCRIPT:
${transcript}

---

SLIDE CONTENT:
${slideContent || "(No slides provided)"}`;

  const parts: { text: string }[] = [{ text }];

  const doFetch = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

  let res = await doFetch();

  // Retry once after 11s for rate limit (429)
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 11000));
    res = await doFetch();
  }

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      throw new Error(
        "Gemini API quota exceeded. Please wait a few minutes and try again. Check your usage at https://aistudio.google.com"
      );
    }
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const responseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const json = responseText.replace(/^```json\n?|\n?```$/g, "");
  return JSON.parse(json) as AnalysisFeedback;
}
