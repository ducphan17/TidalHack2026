import type { Word, SpeechMetrics } from "./stt";

/* ---------- Legacy type (kept for backwards compat) ---------- */

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

/* ---------- New Blueprint types ---------- */

export interface PresentationReport {
  score: number;
  summary: string;
  filler_words: { word: string; timestamp: number }[];
  unclear_terms: { stt_token: string; timestamp: number; confidence: number }[];
  critique: {
    vocal: string;
    content: string;
    visual: string;
  };
  evidence: { type: string; ref: string; note: string }[];
  improvements: string[];
}

export interface QAQuestion {
  id: string;
  question: string;
  slide_ref: string;
}

export interface QAPack {
  questions: QAQuestion[];
}

export interface QAFeedback {
  score: number;
  feedback: string;
  suggested_answer: string;
}

/* ---------- Helpers ---------- */

function geminiUrl(): string {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
}

async function callGemini(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[],
  maxTokens = 4096
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = geminiUrl();

  const doFetch = () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
    });

  let res = await doFetch();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 30000));
    res = await doFetch();
  }

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      throw new Error(
        "Gemini API quota exceeded. Please wait a few minutes and try again."
      );
    }
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const responseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  const json = responseText.replace(/^```json\n?|\n?```$/g, "");
  return JSON.parse(json);
}

/* ---------- Judge Presentation ---------- */

const JUDGE_PROMPT = `You are an expert presentation coach performing a grounded evaluation.

You receive:
- TRANSCRIPT of what the speaker said
- SPEECH METRICS (pace, filler rate, pauses)
- UNCLEAR TERMS detected by STT (low-confidence words)
- PDF SLIDES as images for visual evaluation

## Rubric
Score 1-10 on three axes — vocal delivery, content quality, visual design.

## Rules
- Cite evidence as "Page N" for slide references or "timestamp Xs" for speech references.
- If you cannot find evidence for a claim, use "INSUFFICIENT_EVIDENCE" as the ref.
- For filler_words, include the timestamp (in seconds) of each occurrence from the transcript.
- For unclear_terms, include the STT token, timestamp, and confidence score provided.

Return this exact JSON:
{
  "presentation_report": {
    "score": 7,
    "summary": "2-3 sentence overall assessment",
    "filler_words": [{"word": "um", "timestamp": 12.5}],
    "unclear_terms": [{"stt_token": "...", "timestamp": 5.2, "confidence": 0.4}],
    "critique": {
      "vocal": "Assessment of vocal delivery (pace, clarity, filler usage)",
      "content": "Assessment of content quality and slide alignment",
      "visual": "Assessment of slide visual design"
    },
    "evidence": [
      {"type": "slide", "ref": "Page 1", "note": "Title slide is clear"},
      {"type": "speech", "ref": "timestamp 30s", "note": "Strong opening statement"}
    ],
    "improvements": ["Improvement 1", "Improvement 2"]
  }
  QABLOCK
}`;

const QA_BLOCK = `,
  "qa_pack": {
    "questions": [
      {"id": "q1", "question": "Question text?", "slide_ref": "Page N"}
    ]
  }`;

export async function judgePresentation(
  transcript: string,
  metrics: SpeechMetrics,
  unclearTerms: Word[],
  pdfBase64: string,
  qaOptIn: boolean,
  qaCount: number
): Promise<{ presentation_report: PresentationReport; qa_pack?: QAPack }> {
  let prompt = JUDGE_PROMPT;
  if (qaOptIn) {
    prompt = prompt.replace(
      "QABLOCK",
      QA_BLOCK.replace(
        "questions",
        `questions (generate exactly ${qaCount} questions)`
      )
    );
  } else {
    prompt = prompt.replace("QABLOCK", "");
  }

  const textContent = `${prompt}

---

TRANSCRIPT:
${transcript}

---

SPEECH METRICS:
${JSON.stringify(metrics)}

---

UNCLEAR TERMS (low STT confidence):
${JSON.stringify(
  unclearTerms.map((w) => ({
    stt_token: w.text,
    timestamp: Math.round(w.start / 1000 * 10) / 10,
    confidence: w.confidence,
  }))
)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: textContent }];

  if (pdfBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: pdfBase64,
      },
    });
  }

  return await callGemini(parts, 4096);
}

/* ---------- Judge Q&A Answer ---------- */

const QA_JUDGE_PROMPT = `You are an expert presentation coach grading a Q&A answer.

The student was asked a question about their presentation slides. Evaluate their spoken answer.

QUESTION: {QUESTION}
SLIDE REFERENCE: {SLIDE_REF}

Grade the answer and return this exact JSON:
{
  "score": 7,
  "feedback": "2-3 sentences on how well they answered",
  "suggested_answer": "A model answer for this question"
}`;

export async function judgeQAAnswer(
  question: string,
  slideRef: string,
  answerTranscript: string,
  pdfBase64: string
): Promise<QAFeedback> {
  const prompt = QA_JUDGE_PROMPT
    .replace("{QUESTION}", question)
    .replace("{SLIDE_REF}", slideRef);

  const textContent = `${prompt}

---

STUDENT'S ANSWER:
${answerTranscript}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [{ text: textContent }];

  if (pdfBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: pdfBase64,
      },
    });
  }

  return await callGemini(parts, 2048);
}

/* ---------- Legacy function (kept for backwards compat) ---------- */

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

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

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

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 30000));
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
