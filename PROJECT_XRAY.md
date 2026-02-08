# PROJECT X-RAY: Present AI

Generated: 2026-02-07
Purpose: **Upgrade Planning**
By: Vibecode Kit v4.0 — XRAY Protocol

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Architecture](#3-architecture)
4. [Key Components](#4-key-components)
5. [API Reference](#5-api-reference)
6. [Services (External APIs)](#6-services-external-apis)
7. [Database / Storage](#7-database--storage)
8. [Environment Variables](#8-environment-variables)
9. [Deployment](#9-deployment)
10. [Common Tasks](#10-common-tasks)
11. [Code Health Report](#11-code-health-report)
12. [Upgrade Recommendations](#12-upgrade-recommendations)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

### What is this project?

**Present AI** is an AI-powered presentation coaching tool for students. Users upload their PPTX slides, record themselves presenting (voice only), and receive instant feedback on filler words, content alignment with slides, and actionable improvement suggestions — scored on a 0–10 scale.

### Tech Stack

| Category         | Technology                      | Version   |
|------------------|---------------------------------|-----------|
| Framework        | Next.js (App Router)            | 16.1.6    |
| UI Library       | React                           | 19.2.3    |
| Language         | TypeScript (strict mode)        | ^5        |
| Styling          | Tailwind CSS                    | ^4        |
| Charts           | Recharts                        | ^3.7.0    |
| File Parsing     | JSZip                           | ^3.10.1   |
| AI Analysis      | Google Gemini 2.0 Flash         | REST API  |
| Voice Feedback   | ElevenLabs                      | REST API  |
| Speech-to-Text   | Web Speech API                  | Browser   |
| Recording        | MediaRecorder API               | Browser   |
| Database         | MongoDB Atlas (planned)         | —         |

### Project History

- Created: 2026 (TidalHack 2026 hackathon project)
- Commits: 3 (initial prototype stage)
- Status: Working MVP, in-memory storage only

### Codebase Metrics

| Metric          | Value           |
|-----------------|-----------------|
| Total Files     | 32 source files |
| Components      | 9 components    |
| API Routes      | 4 routes        |
| Custom Hooks    | 3 hooks         |
| Services        | 3 services      |
| Test Coverage   | 0% (no tests)   |
| npm audit       | 0 vulnerabilities |

---

## 2. Quick Start

### Prerequisites

- Node.js (LTS recommended)
- npm
- Google Gemini API key (required)
- ElevenLabs API key (optional, for voice feedback)
- A modern browser with Web Speech API support (Chrome/Edge recommended)

### Installation

```bash
git clone <repo-url>
cd TidalHack2026/frontend

npm install

# Create env file (there is no .env.example currently — see Section 8)
# Create .env.local with:
# GEMINI_API_KEY=your_key_here
# ELEVENLABS_API_KEY=your_key_here   (optional)
# MONGODB_URI=your_uri_here          (optional)

npm run dev
# Open http://localhost:3000
```

### User Workflow

1. Upload a `.pptx` file
2. Click "Start Recording" — browser requests microphone permission
3. Present your slides (speak naturally)
4. Click "Stop" — AI analyzes your speech vs. slide content
5. View score, filler word counts, content alignment, and improvements
6. Optionally listen to AI-generated voice summary (ElevenLabs)
7. Track progress over multiple sessions

---

## 3. Architecture

### Directory Structure

```
TidalHack2026/
└── frontend/
    ├── app/                          # Next.js App Router
    │   ├── layout.tsx                # Root layout + metadata
    │   ├── page.tsx                  # Main app (MeetingRoom component)
    │   ├── globals.css               # Tailwind + CSS variables
    │   └── api/
    │       ├── analyze/route.ts      # POST → Gemini analysis
    │       ├── parse-slides/route.ts # POST → PPTX text extraction
    │       ├── voice/route.ts        # POST → ElevenLabs TTS
    │       └── history/route.ts      # GET/POST → session history
    ├── src/
    │   ├── components/
    │   │   ├── charts/               # ProgressChart (Recharts)
    │   │   ├── feedback/             # ScoreCard, FeedbackList, VoicePlayer
    │   │   ├── recorder/             # SlideUpload, RecordingControls, WebcamPreview, useMediaRecorder
    │   │   └── shared/               # Button, Card
    │   ├── hooks/
    │   │   ├── useMedia.ts           # Microphone stream management
    │   │   └── useSpeech.ts          # Web Speech API wrapper
    │   └── services/
    │       ├── gemini.ts             # Gemini API client
    │       ├── elevenlabs.ts         # ElevenLabs API client
    │       └── db.ts                 # DB operations (fetch-based)
    ├── package.json
    ├── tsconfig.json                 # Strict mode, @/ → ./src/
    └── next.config.ts                # Turbopack root config
```

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Client)                              │
│                                                                          │
│  ┌─────────────┐   ┌─────────────────┐   ┌──────────────────────┐      │
│  │ SlideUpload  │   │ RecordingControls│   │ Web Speech API       │      │
│  │ (.pptx file) │   │ + useMediaRecorder│  │ (speech-to-text)     │      │
│  └──────┬───────┘   └────────┬────────┘   └──────────┬───────────┘      │
│         │                    │                        │                   │
│         ▼                    ▼                        ▼                   │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                    MeetingRoom (page.tsx)                     │        │
│  │  State: step | slideContent | transcript | feedback | history │       │
│  └──────────────────────────┬───────────────────────────────────┘        │
│                              │                                           │
│  ┌────────────┐  ┌──────────┤──────────┐  ┌────────────────┐           │
│  │ ScoreCard  │  │FeedbackList         │  │ ProgressChart  │           │
│  └────────────┘  └─────────────────────┘  └────────────────┘           │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ fetch()
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS API ROUTES (Server)                       │
│                                                                          │
│  /api/parse-slides ──→ JSZip (extract PPTX text)                        │
│  /api/analyze ────────→ gemini.ts ──→ Google Gemini 2.0 Flash API       │
│  /api/voice ──────────→ elevenlabs.ts ──→ ElevenLabs TTS API            │
│  /api/history ────────→ In-memory store (MongoDB planned)               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Upload:   .pptx file → /api/parse-slides → JSZip → slide text → state
2. Record:   Microphone → useMediaRecorder (blob) + useSpeech (transcript)
3. Analyze:  transcript + slideContent → /api/analyze → Gemini → AnalysisFeedback
4. Voice:    feedback.summary → /api/voice → ElevenLabs → audio blob
5. Display:  ScoreCard + FeedbackList + VoicePlayer + ProgressChart
```

### App State Machine

```
  ┌────────┐    upload slides    ┌───────────┐    start mic    ┌───────────┐
  │ upload │ ──────────────────► │ recording │ ──────────────► │ analyzing │
  └────────┘                     └───────────┘   (auto on      └───────────┘
       ▲                                          blob ready)       │
       │                                                            │
       │              "Record again"              ┌──────────┐     │
       └──────────────────────────────────────────│ feedback  │◄────┘
                                                  └──────────┘
```

---

## 4. Key Components

### MeetingRoom (`app/page.tsx`)
- **Role:** Main page, orchestrates the entire user flow
- **State:** `step`, `slideContent`, `feedback`, `history`, `voiceUrl`
- **Hooks used:** `useMedia`, `useSpeech`, `useMediaRecorder`

### SlideUpload (`src/components/recorder/SlideUpload.tsx`)
- **Role:** PPTX file upload with drag-drop support
- **Calls:** `/api/parse-slides`
- **Validates:** `.pptx` extension only

### RecordingControls (`src/components/recorder/RecordingControls.tsx`)
- **Role:** Start/Stop recording buttons with animated recording indicator

### WebcamPreview (`src/components/recorder/WebcamPreview.tsx`)
- **Role:** Video preview from camera stream (currently unused in main flow — voice-only)

### useMediaRecorder (`src/components/recorder/useMediaRecorder.ts`)
- **Role:** Custom hook wrapping MediaRecorder API
- **Format:** `audio/webm;codecs=opus` (with fallback)
- **Bitrate:** 128kbps audio

### ScoreCard (`src/components/feedback/ScoreCard.tsx`)
- **Role:** Displays score with color coding (green ≥80%, amber ≥60%, red <60%)

### FeedbackList (`src/components/feedback/FeedbackList.tsx`)
- **Role:** Renders full analysis — summary, filler words, content alignment, improvements

### VoicePlayer (`src/components/feedback/VoicePlayer.tsx`)
- **Role:** Audio player for ElevenLabs voice feedback

### ProgressChart (`src/components/charts/ProgressChart.tsx`)
- **Role:** Recharts line chart showing score history over sessions

---

## 5. API Reference

### POST `/api/parse-slides`

Extracts text content from PPTX files using JSZip.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file  | File | Yes      | `.pptx` file |

**Response:**
```json
{
  "slides": "Slide 1:\nIntroduction\n\nSlide 2:\nKey Points",
  "slideCount": 2
}
```

### POST `/api/analyze`

Analyzes presentation transcript against slide content using Gemini.

| Field        | Type   | Required | Description |
|--------------|--------|----------|-------------|
| transcript   | string | Yes      | Speech transcript |
| slideContent | string | No       | Parsed slide text |

**Response:** `AnalysisFeedback` object:
```json
{
  "score": 7,
  "summary": "Good presentation with clear structure...",
  "fillerWords": {
    "items": [{ "word": "um", "count": 3 }],
    "totalCount": 3,
    "feedback": "Moderate use of filler words..."
  },
  "contentAlignment": {
    "matches": ["Covered introduction"],
    "missing": ["Skipped conclusion slide"],
    "extra": ["Added personal anecdote"],
    "feedback": "Good coverage overall..."
  },
  "improvements": ["Reduce pauses between slides", "..."]
}
```

### POST `/api/voice`

Converts text to speech via ElevenLabs.

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| text  | string | Yes      | Text to speak |

**Response:** Binary `audio/mpeg` stream.

### GET `/api/history?userId=default`

Returns presentation history array (in-memory, resets on restart).

### POST `/api/history`

Saves a presentation record (in-memory).

---

## 6. Services (External APIs)

### Google Gemini 2.0 Flash (`src/services/gemini.ts`)

- **Endpoint:** `generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- **Auth:** API key as query parameter
- **Temperature:** 0.3
- **Max tokens:** 2048
- **Retry:** Auto-retry after 11s on 429 (rate limit)
- **Prompt:** Structured analysis for filler words, content alignment, improvements

### ElevenLabs (`src/services/elevenlabs.ts`)

- **Endpoint:** `api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- **Auth:** `xi-api-key` header
- **Default voice:** `21m00Tcm4TlvDq8ikWAM` (Rachel)
- **Model:** `eleven_monolingual_v1`
- **Output:** `audio/mpeg`

### Web Speech API (Browser)

- **Used in:** `src/hooks/useSpeech.ts`
- **Language:** `en-US`
- **Mode:** Continuous with interim results
- **Compatibility:** Chrome/Edge (webkit prefix fallback)

---

## 7. Database / Storage

### Current State: In-Memory Only

- `/api/history` uses a `memoryStore` object — data lost on server restart
- `db.ts` has fetch-based client functions ready for API integration

### Planned: MongoDB Atlas

- `MONGODB_URI` env var referenced but not yet wired
- `PresentationRecord` type defined in `db.ts`:
  ```typescript
  interface PresentationRecord {
    id?: string;
    userId?: string;
    timestamp: string;
    score: number;
    feedback: AnalysisFeedback;
    transcriptLength?: number;
  }
  ```

---

## 8. Environment Variables

| Variable             | Required | Description                        | Where to get                              |
|----------------------|----------|------------------------------------|-------------------------------------------|
| `GEMINI_API_KEY`     | **Yes**  | Google Gemini API authentication   | [Google AI Studio](https://aistudio.google.com/) |
| `ELEVENLABS_API_KEY` | No       | ElevenLabs TTS (voice feedback)    | [ElevenLabs](https://elevenlabs.io/)      |
| `MONGODB_URI`        | No       | MongoDB Atlas connection string    | [MongoDB Atlas](https://cloud.mongodb.com/) |

> **Note:** No `.env.example` file exists in the repo currently. One should be created.

---

## 9. Deployment

### Vercel (Recommended)

1. Connect GitHub repo to Vercel
2. Set root directory to `frontend`
3. Set environment variables (GEMINI_API_KEY at minimum)
4. Deploy — Next.js auto-detected

### Manual

```bash
cd frontend
npm run build
npm start
```

### Browser Requirements

Users must use a browser that supports:
- Web Speech API (Chrome, Edge)
- MediaRecorder API
- getUserMedia (microphone access)

**Safari/Firefox:** Web Speech API not fully supported — speech-to-text will fail.

---

## 10. Common Tasks

### Add a new analysis criterion
1. Update the prompt in `src/services/gemini.ts`
2. Add field to `AnalysisFeedback` interface
3. Update `FeedbackList.tsx` to display the new field

### Add a new page
1. Create `app/[route]/page.tsx`
2. Add navigation if needed (currently single-page app)

### Change the AI model
1. Edit `src/services/gemini.ts` — change model name in the URL
2. Adjust temperature/maxTokens as needed

### Switch TTS voice
1. Edit `src/services/elevenlabs.ts` — change default `voiceId`
2. Or pass a different `voiceId` from the calling code

### Wire up MongoDB
1. Install `mongodb` package
2. Implement actual DB operations in `/api/history/route.ts`
3. Set `MONGODB_URI` in environment

---

## 11. Code Health Report

### Overall: YELLOW — Needs Attention

```
 HEALTHY:
  TypeScript strict mode enabled
  API keys secured server-side (not exposed to client)
  Clean component architecture with proper separation
  0 npm audit vulnerabilities
  Proper error handling in API routes
  Dark mode support throughout

 NEEDS ATTENTION:
  No tests at all (0% coverage)
  No .env.example file in repo
  No .gitignore for env files verified
  WebcamPreview component exists but unused in main flow
  In-memory storage only (data lost on restart)
  Console.error calls in production code (page.tsx:127)
  History tracked only in React state (not persisted)

 TECHNICAL DEBT:
  MongoDB integration TODO — code references it but not implemented
  useSpeech has "elevenlabs" engine option stubbed but not implemented
  PPTX parsing uses regex on XML (fragile for edge cases)
  No rate limiting on API routes (client could spam Gemini API)
  No authentication — anyone with the URL can use the app
  Single-page app — no routing for settings, history, etc.
```

---

## 12. Upgrade Recommendations

### Priority 1: Critical for Production

| Item | Current | Recommended | Effort | Impact |
|------|---------|-------------|--------|--------|
| Add tests | None | Jest + React Testing Library | Medium | High |
| Persist data | In-memory | MongoDB Atlas or Supabase | Medium | High |
| Add authentication | None | NextAuth.js or Clerk | Medium | High |
| Rate limiting | None | next-rate-limit or Vercel KV | Low | High |
| Create `.env.example` | Missing | Template with all vars | Low | Medium |

### Priority 2: Performance & UX

| Item | Current | Recommended | Effort | Impact |
|------|---------|-------------|--------|--------|
| Streaming analysis | Wait for full response | Gemini streaming API | Medium | High |
| Better STT | Web Speech API (Chrome only) | Deepgram or Whisper API | Medium | High |
| Offline slide parsing | Server-side via API route | Client-side only (already uses JSZip in browser via fetch) | Low | Low |
| Loading states | Basic spinner | Skeleton screens | Low | Medium |
| Error boundaries | None | React Error Boundary | Low | Medium |

### Priority 3: Features & Scale

| Item | Current | Recommended | Effort | Impact |
|------|---------|-------------|--------|--------|
| Video analysis | Voice only | Add webcam body language analysis via Gemini multimodal | High | High |
| Multi-language | en-US only | i18n support + language selector | Medium | Medium |
| Export reports | View only | PDF/share report generation | Medium | Medium |
| User dashboard | Single session view | History page with charts & trends | Medium | Medium |
| PWA support | None | Service worker + manifest | Low | Medium |

### Dependency Upgrades

| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| next | 16.1.6 | Check latest | Likely minor within v16 |
| react | 19.2.3 | Check latest | Stable within v19 |
| recharts | ^3.7.0 | Check latest | Likely none |
| tailwindcss | ^4 | Check latest | Likely none within v4 |

> Run `npm outdated` to check current vs. latest versions.

### Upgrade Steps (Recommended Order)

1. **Create `.env.example`** — document all required vars (5 min)
2. **Add basic tests** — at least API route tests + component smoke tests
3. **Wire up MongoDB** — replace in-memory store
4. **Add authentication** — protect API routes
5. **Improve STT** — replace Web Speech API with Deepgram/Whisper for cross-browser support
6. **Add rate limiting** — protect Gemini API from abuse
7. **Add video analysis** — leverage Gemini multimodal for body language

---

## 13. Troubleshooting

### "Speech recognition not supported"
- **Cause:** Browser doesn't support Web Speech API
- **Fix:** Use Chrome or Edge. Safari/Firefox not supported.

### Recording doesn't start
- **Cause:** Microphone permission denied
- **Fix:** Allow microphone in browser settings, then reload

### "Analysis failed" error
- **Cause:** Missing/invalid `GEMINI_API_KEY` or rate limit hit
- **Fix:** Check `.env.local` has valid key. If rate limited, wait 60s.

### No voice feedback
- **Cause:** `ELEVENLABS_API_KEY` not set or invalid
- **Fix:** Voice is optional. Set the key in `.env.local` to enable.

### Data disappears on restart
- **Cause:** In-memory storage (no database connected)
- **Fix:** Implement MongoDB integration (see Section 12)

---

## Appendix: Security Summary

| Check | Status |
|-------|--------|
| API keys in server-side only | PASS |
| No secrets in git history | PASS |
| npm audit clean | PASS (0 vulnerabilities) |
| Input validation on uploads | PASS (PPTX check) |
| CORS configuration | DEFAULT (Next.js handles) |
| Authentication | MISSING |
| Rate limiting | MISSING |
| SQL injection risk | N/A (no SQL) |

---

*Generated by Vibecode Kit v4.0 — XRAY Protocol*
