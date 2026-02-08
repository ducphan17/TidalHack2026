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

export interface ScoreBreakdown {
  document_coverage: number;
  content_quality: number;
  audience_understanding: number;
  speech_alignment: number;
  vocal_delivery: number;
  document_coverage_rationale: string;
  content_quality_rationale: string;
  audience_understanding_rationale: string;
  speech_alignment_rationale: string;
  vocal_delivery_rationale: string;
}

export interface RelevanceGate {
  passed: boolean;
  reason?: string;
}

export interface SlideUnderstanding {
  page: number;
  status: "well_explained" | "partially_explained" | "not_well_explained";
  evidence?: string;
}

export interface PresentationReport {
  score: number;
  summary: string;
  relevance_gate?: RelevanceGate;
  score_breakdown?: ScoreBreakdown;
  audience_understanding?: SlideUnderstanding[];
  filler_words: { word: string; timestamp: number }[];
  unclear_terms: { stt_token: string; timestamp: number; confidence: number }[];
  critique: {
    vocal: string;
    content: string;
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

export interface LiveQAGrade {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  suggested_answer: string;
}

/* ---------- Helpers ---------- */

function geminiUrl(): string {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
    if (res.status === 403) {
      throw new Error(
        "Gemini API is not enabled. Enable it at: https://console.developers.google.com/apis/api/generativelanguage.googleapis.com — then wait a few minutes and retry."
      );
    }
    if (res.status === 400) {
      let hint = "";
      try {
        const errJson = JSON.parse(errText);
        const details = errJson?.error?.details;
        if (details?.[0]?.reason) {
          hint = ` (${details[0].reason}: ${details[0].metadata?.field || ""})`;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(
        `Gemini API invalid request${hint}. If using PDF slides, try gemini-2.5-flash. Raw: ${errText.slice(0, 300)}`
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

const JUDGE_PROMPT = `You are grading a student presentation based on the provided document (PDF slides).

You receive:
- TRANSCRIPT of what the speaker said
- SPEECH METRICS (pace, filler rate, pauses)
- UNCLEAR TERMS detected by STT (low-confidence words)
- PDF SLIDES as images for content evaluation

====================
PHASE 1 — RELEVANCE GATE (PASS / FAIL)
====================

Determine whether the spoken presentation is meaningfully related to the provided document.

Fail the relevance gate if:
- The main topic does not match the document
- Most key document concepts are never mentioned
- The spoken content discusses a different subject area

If the relevance gate FAILS:
- Set relevance_gate.passed = false
- Set relevance_gate.reason = brief explanation
- Set final score = 0
- Still include score_breakdown with all 5 criteria (document_coverage=0, content_quality=0, others as assessed)
- Set audience_understanding = [] (empty)
- Provide minimal critique and improvements

If the relevance gate PASSES:
- Set relevance_gate.passed = true
- Proceed to Phase 2

====================
PHASE 2 — GRADING (ONLY IF RELEVANCE PASSED)
====================

Grade using these 5 criteria. Assign each a score 0–10 and a brief rationale:

1) Document Coverage (completeness) — how much of the slides was covered
2) Content Quality & Accuracy — correctness and depth
3) Audience Understanding (slide-level) — how well each slide was explained (see below)
4) Speech–Document Alignment — how well speech matches slides
5) Vocal Delivery (tone & clarity) — pace, fillers, clarity

AUDIENCE UNDERSTANDING (REQUIRED when relevance passes):
Evaluate EACH SLIDE individually. For each slide, determine whether the spoken explanation is understandable to a general audience.
Mark each slide as: well_explained | partially_explained | not_well_explained
Provide evidence (timestamp + quote) for each slide. Do not assume understanding. If a concept is not explained, mark not_well_explained.

SCORING (weighted):
- Return all 5 criteria in score_breakdown with scores (0–10) and rationales
- If relevance_gate.passed = false OR document_coverage = 0 OR content_quality = 0 → final score = 0
- Otherwise: score = (document_coverage × 25% + content_quality × 30% + audience_understanding × 20% + speech_alignment × 15% + vocal_delivery × 10%) (exact, unrounded)
- Weights: Coverage 25%, Content Quality 30%, Audience Understanding 20%, Alignment 15%, Vocal Delivery 10%

## Rules
- Cite evidence as "Page N" for slide references or "timestamp Xs" for speech references.
- For filler_words, include timestamp (seconds) of each occurrence.
- For unclear_terms, include stt_token, timestamp, confidence provided.

Return structured JSON only. audience_understanding MUST include slide-level analysis when relevance passes:
{
  "presentation_report": {
    "score": 0,
    "summary": "2-3 sentence overall assessment",
    "relevance_gate": {"passed": false, "reason": "..."},
    "score_breakdown": {
      "document_coverage": 0,
      "content_quality": 0,
      "audience_understanding": 3,
      "speech_alignment": 0,
      "vocal_delivery": 7,
      "document_coverage_rationale": "1 sentence",
      "content_quality_rationale": "1 sentence",
      "audience_understanding_rationale": "1 sentence",
      "speech_alignment_rationale": "1 sentence",
      "vocal_delivery_rationale": "1 sentence"
    },
    "audience_understanding": [
      {"page": 1, "status": "well_explained", "evidence": "At 12s: \\"The main point is...\\""},
      {"page": 2, "status": "not_well_explained", "evidence": "Concept X was never explained"}
    ],
    "filler_words": [{"word": "um", "timestamp": 12.5}],
    "unclear_terms": [{"stt_token": "...", "timestamp": 5.2, "confidence": 0.4}],
    "critique": {"vocal": "...", "content": "..."},
    "evidence": [{"type": "slide", "ref": "Page 1", "note": "..."}],
    "improvements": ["Improvement 1", "Improvement 2"]
  }
  QABLOCK
}`;

export async function judgePresentation(
  transcript: string,
  metrics: SpeechMetrics,
  unclearTerms: Word[],
  pdfBase64: string,
  slideCount: number,
  qaOptIn: boolean,
  qaCount: number
): Promise<{ presentation_report: PresentationReport; qa_pack?: QAPack }> {
  let prompt = JUDGE_PROMPT;
  if (qaOptIn) {
    prompt = prompt.replace(
      "QABLOCK",
      `,
  "qa_pack": {
    "questions": [
      {"id": "q1", "question": "A challenging question about the presentation content?", "slide_ref": "Page 1"},
      {"id": "q2", "question": "Another question referencing a specific slide?", "slide_ref": "Page 2"}
    ]
  }

IMPORTANT: Generate exactly ${qaCount} questions in qa_pack.questions. Each question must have a unique id (q1, q2, ...), a question about the presentation, and a slide_ref.`
    );
  } else {
    prompt = prompt.replace("QABLOCK", "");
  }

  const slideInfo =
    slideCount > 0
      ? `\nThe PDF has ${slideCount} slide(s). Use this to compute proportional content coverage.\n\n`
      : "";

  const textContent = `${prompt}
${slideInfo}
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

  // Sanitize base64: remove whitespace and data URL prefix
  const cleanBase64 = pdfBase64
    ? pdfBase64
        .replace(/^data:application\/pdf;base64,/, "")
        .replace(/\s/g, "")
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  if (cleanBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: cleanBase64,
      },
    });
  }
  parts.push({ text: textContent });

  try {
    return await callGemini(parts, 4096);
  } catch (e) {
    // If PDF causes 400, retry without PDF (transcript-only evaluation)
    if (cleanBase64 && e instanceof Error && e.message.includes("400")) {
      console.warn("Gemini rejected request with PDF, retrying without slides");
      return await callGemini([{ text: textContent }], 4096);
    }
    throw e;
  }
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

  const cleanBase64 = pdfBase64
    ? pdfBase64
        .replace(/^data:application\/pdf;base64,/, "")
        .replace(/\s/g, "")
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  if (cleanBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: cleanBase64,
      },
    });
  }
  parts.push({ text: textContent });

  try {
    return await callGemini(parts, 2048);
  } catch (e) {
    if (cleanBase64 && e instanceof Error && e.message.includes("400")) {
      console.warn("Gemini rejected Q&A request with PDF, retrying without slides");
      return await callGemini([{ text: textContent }], 2048);
    }
    throw e;
  }
}

/* ---------- Generate Live Q&A Questions ---------- */

const GENERATE_QUESTIONS_PROMPT = `You are a curious audience member who just watched a presentation. Generate exactly {COUNT} questions about the content.

Rules:
- Write ONLY the question itself. No preamble, no filler, no "Great presentation" or "I was wondering". Just the question.
- Each question will be read aloud by text-to-speech, so keep them short (1-2 sentences max).
- Vary the question style: some "why" questions, some "how" questions, some "what if" scenarios, some asking to explain a concept.
- Questions should test different parts of the presentation — don't cluster on one slide.
- Use plain conversational English. No markdown, no bullet points, no formatting.

Return this exact JSON:
{
  "questions": [
    {"id": "q1", "question": "Your first question here?", "slide_ref": "Page 1"},
    {"id": "q2", "question": "Your second question here?", "slide_ref": "Page 2"}
  ]
}`;

export async function generateLiveQuestions(
  pdfBase64: string,
  count: number
): Promise<QAQuestion[]> {
  const prompt = GENERATE_QUESTIONS_PROMPT.replace("{COUNT}", String(count));

  const cleanBase64 = pdfBase64
    ? pdfBase64
        .replace(/^data:application\/pdf;base64,/, "")
        .replace(/\s/g, "")
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  if (cleanBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: cleanBase64,
      },
    });
  }
  parts.push({ text: prompt });

  const result = await callGemini(parts, 2048);
  return result.questions as QAQuestion[];
}

/* ---------- Grade All Live Q&A Answers ---------- */

const GRADE_ALL_PROMPT = `You are an expert presentation coach grading a student's Q&A performance.

The student was asked {COUNT} questions about their presentation. Grade each answer individually.

For each question-answer pair, evaluate:
- Accuracy: Does the answer correctly address the question based on the slide content?
- Completeness: Did the student cover all key aspects?
- Clarity: Was the answer clear and well-articulated?

Score each answer 0–10 and provide:
- feedback: 2-3 sentences on how well they answered
- suggested_answer: A model answer for that question

Return this exact JSON:
{
  "grades": [
    {
      "question": "The question text",
      "answer": "What the student said",
      "score": 7,
      "feedback": "2-3 sentences on how well they answered",
      "suggested_answer": "A model answer for this question"
    }
  ]
}

IMPORTANT: Return exactly {COUNT} grades in the same order as the questions below.`;

export async function gradeLiveAnswers(
  qaPairs: { question: string; slide_ref: string; answer: string }[],
  pdfBase64: string
): Promise<LiveQAGrade[]> {
  const prompt = GRADE_ALL_PROMPT.replace(
    /\{COUNT\}/g,
    String(qaPairs.length)
  );

  const pairsText = qaPairs
    .map(
      (p, i) =>
        `--- Question ${i + 1} (${p.slide_ref}) ---\nQ: ${p.question}\nA: ${p.answer || "(No answer provided)"}`
    )
    .join("\n\n");

  const textContent = `${prompt}\n\n${pairsText}`;

  const cleanBase64 = pdfBase64
    ? pdfBase64
        .replace(/^data:application\/pdf;base64,/, "")
        .replace(/\s/g, "")
    : "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];
  if (cleanBase64) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: cleanBase64,
      },
    });
  }
  parts.push({ text: textContent });

  try {
    const result = await callGemini(parts, 4096);
    return result.grades as LiveQAGrade[];
  } catch (e) {
    if (cleanBase64 && e instanceof Error && e.message.includes("400")) {
      console.warn("Gemini rejected grading with PDF, retrying without slides");
      return ((await callGemini([{ text: textContent }], 4096)) as { grades: LiveQAGrade[] }).grades;
    }
    throw e;
  }
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
    if (res.status === 403) {
      throw new Error(
        "Gemini API is not enabled. Enable it at: https://console.developers.google.com/apis/api/generativelanguage.googleapis.com — then wait a few minutes and retry."
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
