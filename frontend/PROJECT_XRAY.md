# PROJECT X-RAY: Presently.ai

Generated: 2026-02-08
By: Vibecode Kit v4.0 — XRAY Protocol

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Architecture](#3-architecture)
4. [Key Components](#4-key-components)
5. [API Reference](#5-api-reference)
6. [Database Schema](#6-database-schema)
7. [Environment Variables](#7-environment-variables)
8. [Services Layer](#8-services-layer)
9. [Data Flow](#9-data-flow)
10. [Common Tasks](#10-common-tasks)
11. [Troubleshooting](#11-troubleshooting)
12. [Code Health](#12-code-health)
13. [Future Improvements](#13-future-improvements)

---

## 1. Overview

### What is this project?

**Presently.ai** is an AI-powered presentation coaching platform for students. Users upload their slide deck (PDF), record themselves presenting, and receive instant AI feedback on content coverage, vocal delivery, filler words, pace, and audience understanding. A Live Q&A mode simulates a real audience member asking follow-up questions grounded in the slide content.

### Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript (strict) | ^5 |
| UI Library | React | 19.2.3 |
| Styling | Tailwind CSS | ^4 |
| Animation | Framer Motion | ^12.33.0 |
| Charts | Recharts | ^3.7.0 |
| Database | MongoDB Atlas | ^7.1.0 |
| AI Analysis | Google Gemini 2.0 Flash | @google/genai ^1.40.0 |
| Speech-to-Text | AssemblyAI | ^4.23.0 |
| Text-to-Speech | ElevenLabs | REST API v1 |
| Deployment | Vercel-compatible | — |

### Project Metrics

| Metric | Value |
|--------|-------|
| Total TS/TSX files | ~56 |
| Lines of code | ~5,200 |
| Components | 30 |
| API Routes | 9 |
| Custom Hooks | 3 |
| Services | 9 |
| TODO/FIXME items | 0 |
| npm audit vulnerabilities | 0 |
| TypeScript errors | 1 (pre-existing framer-motion type mismatch in GlassCard.tsx) |

---

## 2. Quick Start

### Prerequisites

- Node.js >= 18
- npm
- API keys: Gemini (required), AssemblyAI (required), ElevenLabs (optional)
- MongoDB Atlas cluster (required for persistence)

### Installation

```bash
git clone https://github.com/ducphan17/TidalHack2026.git
cd TidalHack2026/frontend
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```
GEMINI_API_KEY=your_gemini_key          # Required
STT_API_KEY=your_assemblyai_key         # Required
MONGODB_URI=mongodb+srv://...           # Required
ELEVENLABS_API_KEY=your_elevenlabs_key  # Optional (voice coaching)
GEMINI_MODEL=gemini-2.0-flash-lite     # Optional override
```

### Run

```bash
npm run dev
# Open http://localhost:3000
```

### Atlas Vector Search Setup (for RAG)

In the MongoDB Atlas UI, create a vector search index on the `pdf_chunks` collection:

- Index name: `pdf_chunks_vec`
- Field mappings:
  - `embedding`: vector, 768 dimensions, cosine similarity
  - `pdfHash`: filter

---

## 3. Architecture

### Directory Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout (Starfield bg, gradient blurs)
│   ├── page.tsx                # Main app (MeetingRoom — 777 lines)
│   ├── globals.css             # Theme variables, keyframe animations
│   └── api/
│       ├── analyze/route.ts    # SSE: transcribe → metrics → Gemini → session
│       ├── history/route.ts    # GET/POST presentation history (MongoDB)
│       ├── pdf/
│       │   ├── index/route.ts  # Index PDF slides as vectors
│       │   └── search/route.ts # Vector search on slide chunks
│       ├── qa/
│       │   ├── grade/route.ts  # Grade Q&A answer (audio → transcript → Gemini)
│       │   ├── live/route.ts   # Conversational Q&A with RAG context
│       │   └── stream/route.ts # SSE: MongoDB Change Streams on qa_turns
│       ├── slides/
│       │   └── upload/route.ts # PDF upload → base64 + page count
│       └── voice/route.ts      # ElevenLabs TTS proxy
├── src/
│   ├── components/
│   │   ├── landing/            # LandingPage (animated splash)
│   │   ├── recorder/           # Webcam, audio visualizers, slide upload
│   │   ├── feedback/           # ScoreCard, breakdown, feedback list, voice
│   │   ├── qa/                 # QAPanel (structured), LiveQAPanel (conversational)
│   │   ├── charts/             # ProgressChart (Recharts line chart)
│   │   ├── shared/             # Button, Card, BokehBackground, Snowflakes
│   │   ├── ui/                 # GlassCard, CardBlock, card (shadcn-style)
│   │   └── Starfield.tsx       # Canvas star animation
│   ├── hooks/
│   │   ├── useMedia.ts         # Camera/mic access
│   │   ├── useSpeech.ts        # Web Speech API (interim + final text)
│   │   └── useLiveQA.ts        # Live Q&A state machine (core hook)
│   └── services/
│       ├── mongoClient.ts      # Cached MongoClient singleton
│       ├── db.ts               # getDb() → tidalhack database
│       ├── collections.ts      # Typed collections + index setup
│       ├── sessionStore.ts     # save/getSession via MongoDB
│       ├── gemini.ts           # AI analysis, Q&A grading, conversational QA
│       ├── geminiEmbeddings.ts # Gemini embedding API (768-dim vectors)
│       ├── pdfChunks.ts        # PDF slide indexing + vector search
│       ├── stt.ts              # AssemblyAI transcription + metrics
│       └── elevenlabs.ts       # TTS voice generation
├── package.json
├── next.config.ts
├── tsconfig.json
└── .env.example
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                           │
│                                                                     │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ Landing  │→ │  Recording  │→ │ Feedback │→ │   Live Q&A    │   │
│  │  Page    │  │  + Upload   │  │ + Score  │  │  (barge-in)   │   │
│  └──────────┘  └──────┬──────┘  └────┬─────┘  └───────┬───────┘   │
│                       │              │                 │            │
│           useMedia  useMediaRecorder │       useLiveQA + useSpeech │
└───────────────────────┼──────────────┼─────────────────┼───────────┘
                        │              │                 │
                   ═════╪══════════════╪═════════════════╪═════════
                        ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTES                             │
│                                                                     │
│  /api/slides/upload   →  PDF → base64 + page count                 │
│  /api/analyze (SSE)   →  Audio → AssemblyAI → Gemini → Session     │
│  /api/voice           →  Text → ElevenLabs → Audio blob            │
│  /api/qa/live         →  Conversational Q&A (RAG + Gemini)         │
│  /api/qa/grade        →  Answer audio → Gemini grading             │
│  /api/qa/stream (SSE) →  MongoDB Change Streams → live updates     │
│  /api/history         →  GET/POST presentation records             │
│  /api/pdf/index       →  Slide text → Gemini embeddings → MongoDB  │
│  /api/pdf/search      →  Query → Atlas Vector Search → chunks      │
└──────────────┬──────────────────┬──────────────────┬────────────────┘
               │                  │                  │
               ▼                  ▼                  ▼
┌──────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│   AssemblyAI     │  │  Google Gemini  │  │     MongoDB Atlas       │
│   (STT)          │  │  2.0 Flash      │  │                         │
│                  │  │  + Embeddings   │  │  sessions (TTL 24h)     │
│  Audio → Text    │  │                 │  │  history                │
│  + word-level    │  │  Analysis       │  │  qa_turns               │
│    timing        │  │  Q&A grading    │  │  pdf_chunks (vectors)   │
└──────────────────┘  │  Conversational │  │                         │
                      │  Embeddings     │  │  Atlas Vector Search    │
┌──────────────────┐  └─────────────────┘  └─────────────────────────┘
│   ElevenLabs     │
│   (TTS)          │
│                  │
│  Text → Audio    │
│  Coach voice     │
└──────────────────┘
```

---

## 4. Key Components

### app/page.tsx — MeetingRoom (777 lines)

The monolithic main page component managing the entire user flow as a state machine:

**Steps:** `upload` → `recording` → `recorded_pending` → `analyzing` → `feedback` → `qa_active` / `live_qa`

Key state:
- `step` — current UI step
- `analysisResult` — Gemini response (report + Q&A pack)
- `pdfBase64` / `slideCount` — uploaded PDF data
- `audioBlob` — recorded audio
- `qaMode` — "structured" or "live"

### src/hooks/useLiveQA.ts (398 lines)

The core Live Q&A state machine hook. States: `IDLE` → `AI_THINKING` → `AI_SPEAKING` → `USER_ANSWERING` → `DONE`

Features:
- **Barge-in**: user can interrupt AI mid-speech, which pauses audio and starts capturing answer
- **Silence detection**: auto-submits answer after 1.5s of silence
- **Skip detection**: recognizes phrases like "don't know", "skip", "next"
- **Max answer timer**: safety timeout (default 300s)
- **Max questions**: configurable limit (1-5)

### src/components/qa/LiveQAPanel.tsx (263 lines)

UI for Live Q&A with setup screen (question count selection) and chat-style conversation display with:
- Chat bubbles for AI and user messages
- Real-time caption display (final + interim)
- State indicator (AI thinking, speaking, user answering)
- Auto-scroll

### src/components/feedback/ScoreBreakdownPanel.tsx (110 lines)

Displays the 5-criterion weighted scoring:
- Document Coverage (25%)
- Content Quality (30%)
- Audience Understanding (20%)
- Speech Alignment (15%)
- Vocal Delivery (10%)

### src/components/recorder/SlideUpload.tsx (117 lines)

PDF upload component that sends to `/api/slides/upload` and returns slide count + base64 data.

---

## 5. API Reference

### POST /api/analyze

**Purpose:** Full presentation analysis pipeline (streaming SSE)

**Input:** `FormData`
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| audio_file | File | Yes | Recording audio blob |
| slides_pdf_base64 | string | No | PDF base64 string |
| slide_count | string | No | Number of slides |
| qa_opt_in | string | No | "true" to generate Q&A questions |
| qa_count | string | No | Number of Q&A questions (default: 3) |

**Response:** SSE stream with events:
```
data: {"step":"transcribing","message":"..."}
data: {"step":"computing","message":"..."}
data: {"step":"analyzing","message":"..."}
data: {"step":"done","data":{"sessionId":"...","transcript":"...","presentation_report":{...},"qa_pack":{...}}}
```

---

### POST /api/qa/live

**Purpose:** Conversational Q&A (AI asks human questions)

**Input:** JSON
```json
{
  "sessionId": "uuid",
  "mode": "FIRST_QUESTION" | "NEXT_TURN",
  "askedQuestions": ["previous question 1", "..."],
  "lastQuestion": "most recent question",
  "presenterAnswer": "user's answer text",
  "history": [{"role":"user"|"assistant","text":"..."}]
}
```

**Response:**
```json
{
  "question": "Next question text",
  "feedback": "Brief feedback on answer (NEXT_TURN only)"
}
```

**RAG:** Before calling Gemini, searches `pdf_chunks` via vector search for relevant slide context. Falls back to full PDF on first question if vector search is unavailable.

---

### POST /api/qa/grade

**Purpose:** Grade a Q&A answer (audio input)

**Input:** `FormData`
| Field | Type | Required |
|-------|------|----------|
| sessionId | string | Yes |
| questionId | string | Yes |
| answer_audio | File | Yes |

**Response:**
```json
{
  "qa_feedback": {"score": 8, "feedback": "...", "suggested_answer": "..."},
  "coach_text": "Your score is 8 out of 10. ..."
}
```

---

### GET /api/qa/stream?sessionId=uuid

**Purpose:** SSE stream for real-time Q&A turn updates (MongoDB Change Streams)

**Response:** SSE events for each new `qa_turns` document.

---

### POST /api/voice

**Purpose:** ElevenLabs TTS proxy

**Input:** JSON `{ "text": "...", "mode": "recap"|"question"|"qa_feedback", "voiceId": "optional" }`

**Response:** `audio/mpeg` blob

---

### GET /api/history?userId=default

**Response:** Array of presentation records (last 50, sorted by timestamp desc)

### POST /api/history

**Input:** JSON with `score`, `userId`, and other metadata

**Response:** Created record

---

### POST /api/slides/upload

**Input:** `FormData` with `file` (PDF)

**Response:** `{ "slideCount": N, "pdfBase64": "..." }`

---

### POST /api/pdf/index

**Input:** `{ "pdfHash": "...", "slides": [{"slide": 1, "text": "..."}] }`

**Response:** `{ "ok": true, "indexed": N }`

---

### POST /api/pdf/search

**Input:** `{ "pdfHash": "...", "query": "search text" }`

**Response:** `{ "chunks": [{"slide": 1, "text": "...", "score": 0.95}] }`

---

## 6. Database Schema

**Database:** `tidalhack` on MongoDB Atlas

### sessions

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string (unique) | UUID, primary key |
| pdfBase64 | string | Full PDF as base64 |
| qaQuestions | QAQuestion[] | Generated Q&A questions |
| report | PresentationReport | Full analysis report |
| createdAt | Date | Creation timestamp |
| expiresAt | Date | TTL expiry (createdAt + 24h) |

**Indexes:** `sessionId` (unique), `expiresAt` (TTL, expireAfterSeconds: 0)

### history

| Field | Type | Description |
|-------|------|-------------|
| userId | string | User identifier (default: "default") |
| score | number | Presentation score |
| attempt | number | Attempt number for this user |
| timestamp | Date | When recorded |

**Indexes:** `{ userId: 1, timestamp: -1 }`

### qa_turns

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | Links to session |
| role | "user" \| "assistant" | Speaker |
| text | string | Turn content |
| questionNumber | number | Q&A question sequence number |
| createdAt | Date | Timestamp |

**Indexes:** `{ sessionId: 1, createdAt: 1 }`

### pdf_chunks

| Field | Type | Description |
|-------|------|-------------|
| pdfHash | string | Unique identifier for the PDF |
| slide | number | Slide number |
| text | string | Slide text content |
| embedding | number[] | 768-dim Gemini embedding vector |
| createdAt | Date | When indexed |

**Indexes:** `{ pdfHash: 1, slide: 1 }` + Atlas Vector Search index `pdf_chunks_vec`

---

## 7. Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| GEMINI_API_KEY | Yes | Google AI Studio API key | AIzaSy... |
| STT_API_KEY | Yes | AssemblyAI API key | a47fe8... |
| MONGODB_URI | Yes | MongoDB Atlas connection string | mongodb+srv://... |
| ELEVENLABS_API_KEY | No | ElevenLabs voice API key | sk_52a6... |
| GEMINI_MODEL | No | Override Gemini model (default: gemini-2.0-flash) | gemini-2.0-flash-lite |

---

## 8. Services Layer

### gemini.ts (596 lines) — Core AI Engine

**`judgePresentation()`** — Main analysis function
- Sends transcript + PDF + speech metrics to Gemini
- Returns structured JSON: relevance gate, 5-criterion score breakdown, slide-by-slide understanding, filler words, unclear terms, critique, evidence, improvements
- Optionally generates Q&A pack

**`conversationalQA()`** — Live Q&A generation
- Two modes: `FIRST_QUESTION` (no feedback), `NEXT_TURN` (feedback + next question)
- Accepts `ragContext` from vector search for faster grounded responses
- Falls back to full PDF if no RAG context available
- Tracks "already asked" questions to prevent repetition

**`judgeQAAnswer()`** — Answer grading
- Returns score (0-10), feedback, suggested answer

### stt.ts (109 lines) — Speech-to-Text

- `transcribeAudio(buffer)` — Sends audio to AssemblyAI, returns transcript + word-level timing
- `computeMetrics(words, durationMs)` — Calculates WPM, filler rate, pause detection, unclear terms

### elevenlabs.ts (152 lines) — Voice Feedback

- `generateCoachSpeech(text, mode, voiceId)` — Generates spoken coach feedback
- Three modes with different voice profiles: recap, question, qa_feedback
- Two voices: Woman (default), Man

### mongoClient.ts / db.ts / collections.ts / sessionStore.ts — Data Layer

MongoDB persistence layer with:
- Cached connection across Next.js hot reloads
- Typed document interfaces
- Auto-created indexes (TTL, compound, unique)
- 24-hour session expiry

### geminiEmbeddings.ts / pdfChunks.ts — Vector Search (RAG)

- `embedTexts(texts[])` — Gemini embedding model (768 dimensions)
- `indexPdfSlides(pdfHash, slides[])` — Chunk per slide, embed, bulk insert
- `searchChunks(pdfHash, query, limit)` — `$vectorSearch` aggregation pipeline

---

## 9. Data Flow

### Presentation Analysis Flow

```
User uploads PDF → /api/slides/upload → base64 + slideCount stored in client state
         │
User records audio → useMediaRecorder → audioBlob
         │
User clicks "Analyze" → /api/analyze (SSE stream)
         │
         ├─ Step 1: Audio → AssemblyAI → transcript + word timing
         ├─ Step 2: computeMetrics → WPM, filler rate, pauses
         ├─ Step 3: Gemini judgePresentation(transcript, metrics, PDF)
         │          → relevance gate, 5-criterion scoring, critique, Q&A pack
         ├─ Step 4: Session saved to MongoDB (24h TTL)
         └─ Step 5: Result streamed to client → feedback UI
```

### Live Q&A Flow

```
User selects question count → LiveQAPanel → useLiveQA.start()
         │
         ├─ State: AI_THINKING
         │  └─ /api/qa/live (mode: FIRST_QUESTION)
         │     └─ Vector search pdf_chunks for RAG context
         │     └─ Gemini generates question grounded in slides
         │
         ├─ State: AI_SPEAKING
         │  └─ /api/voice → ElevenLabs TTS → plays audio
         │  └─ User can barge-in (interrupts audio, starts capturing)
         │
         ├─ State: USER_ANSWERING
         │  └─ Web Speech API captures answer
         │  └─ Silence detection (1.5s) → auto-submit
         │  └─ Skip detection ("don't know", "skip", etc.)
         │
         └─ Loop: AI_THINKING → ... until maxQuestions reached → DONE
```

### History Persistence

```
Analysis complete → client POST /api/history → MongoDB history collection
Page load → client GET /api/history → ProgressChart display
Server restart → data persists (MongoDB Atlas)
```

---

## 10. Common Tasks

### Add a new page

1. Create `app/[route]/page.tsx`
2. Component should be a default export
3. For client components, add `"use client"` at top

### Add a new API route

1. Create `app/api/[name]/route.ts`
2. Export `GET`, `POST`, etc. as named async functions
3. Use `NextRequest` / `NextResponse` from `"next/server"`
4. For long operations, set `export const maxDuration = 120;`

### Add a new component

1. Create in `src/components/[category]/ComponentName.tsx`
2. Add `"use client"` if it uses hooks, events, or browser APIs
3. Export from the category's `index.ts`

### Add a new service

1. Create in `src/services/[name].ts`
2. Import via `@/services/[name]` (path alias)
3. For MongoDB operations, use `getCollections()` from collections.ts

### Modify the scoring formula

Edit `app/api/analyze/route.ts` lines 112-118 — the weighted score calculation:
```ts
report.score =
  b.document_coverage * 0.25 +
  b.content_quality * 0.3 +
  b.audience_understanding * 0.2 +
  b.speech_alignment * 0.15 +
  b.vocal_delivery * 0.1;
```

### Change the Gemini prompt

Edit `src/services/gemini.ts` — the prompt constants:
- `BLUEPRINT_PROMPT` for presentation analysis
- `LIVE_QA_PROMPT` for conversational Q&A
- `QA_GRADE_PROMPT` for answer grading

### Modify styling

- Global theme: `app/globals.css` (CSS variables under `:root`)
- Component styles: Tailwind classes inline
- No tailwind.config.ts — uses Tailwind CSS v4 with `@tailwindcss/postcss`

---

## 11. Troubleshooting

### "MONGODB_URI environment variable is not set"

Ensure `.env.local` (or `.env`) has the `MONGODB_URI` variable. Restart `npm run dev` after changes.

### "Session not found" (404) on Q&A routes

Sessions expire after 24 hours. If the session was created before a server restart with the old in-memory store, it won't exist in MongoDB. Re-analyze to create a new session.

### AssemblyAI returns empty transcript

- Check microphone permissions in browser
- Ensure `STT_API_KEY` is valid
- Audio must contain audible speech (not silence)

### ElevenLabs voice not playing

- `ELEVENLABS_API_KEY` is optional — if not set, voice coaching won't work
- Check browser autoplay policies (some browsers block audio autoplay)

### GlassCard.tsx TypeScript error

Pre-existing framer-motion type mismatch (`ease: number[]` vs `Easing`). Not blocking — `skipLibCheck` handles it at build time. Fix by casting: `ease: [0.25, 0.1, 0.25, 1] as const`

### Vector search returns no results

- Ensure Atlas Vector Search index `pdf_chunks_vec` is created in Atlas UI
- PDF slides must be indexed first via `/api/pdf/index`
- The Live Q&A route falls back to full PDF if vector search fails

---

## 12. Code Health

```
🟢 HEALTHY
├── 0 TODO/FIXME items
├── 0 npm vulnerabilities
├── TypeScript strict mode enabled
├── Path aliases configured (@/*)
├── MongoDB indexes auto-created
├── Session TTL (24h auto-cleanup)
├── Error handling on all API routes
└── .gitignore excludes .env files

🟡 NEEDS ATTENTION
├── 15 console.log/warn/error calls across 10 files (mostly error logging — OK)
├── 1 pre-existing TS error in GlassCard.tsx (non-blocking)
├── No test suite
├── app/page.tsx is 777 lines (monolithic — could benefit from splitting)
└── README.md slightly outdated (doesn't reflect MongoDB/RAG additions)

🔴 WATCH OUT
├── .env committed to repo with real API keys — should be rotated
├── No authentication system — userId defaults to "default"
└── No rate limiting on API routes
```

---

## 13. Future Improvements

### Technical Debt

- [ ] Split `app/page.tsx` (777 lines) into smaller page components
- [ ] Add unit tests for services (especially gemini.ts scoring logic)
- [ ] Add integration tests for API routes
- [ ] Rotate exposed API keys in `.env` and remove from git history
- [ ] Fix GlassCard.tsx framer-motion type error

### Planned Features

- [ ] User authentication (NextAuth / Clerk)
- [ ] Multi-user support (replace hardcoded "default" userId)
- [ ] PDF slide text extraction on server (currently relies on Gemini reading the PDF)
- [ ] Batch slide indexing during `/api/analyze` (auto-index for RAG)
- [ ] Export analysis reports as PDF
- [ ] Comparison mode (compare two attempts side-by-side)

### Upgrade Recommendations

- [ ] Consider Gemini 2.0 Flash (non-lite) for better analysis quality
- [ ] Add Zod validation on API request bodies
- [ ] Add rate limiting middleware (e.g., `@upstash/ratelimit`)
- [ ] Consider separating the monolithic page into Next.js route groups

---

## Appendix

### Key External APIs

| Service | Purpose | Docs |
|---------|---------|------|
| Google Gemini | AI analysis + embeddings | https://ai.google.dev/ |
| AssemblyAI | Speech-to-text | https://www.assemblyai.com/docs |
| ElevenLabs | Text-to-speech | https://elevenlabs.io/docs |
| MongoDB Atlas | Database + Vector Search | https://www.mongodb.com/docs/atlas/ |

### Configuration Notes

- `next.config.ts`: Server actions body size limit set to 50MB (for PDF uploads)
- `tsconfig.json`: Path alias `@/*` → `./src/*`, strict mode, ES2017 target
- Tailwind CSS v4 with `@tailwindcss/postcss` (no tailwind.config.ts needed)

### Repository

- GitHub: https://github.com/ducphan17/TidalHack2026
- Branch: `main`
- Hackathon: TIDALHACK:26

---

*Generated by Vibecode Kit v4.0 — XRAY Protocol*
