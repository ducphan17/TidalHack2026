# PROJECT X-RAY: Present AI

Generated: 2026-02-07
Purpose: Upgrade Planning

---

## PROJECT OVERVIEW

| Category | Value |
|----------|-------|
| Type | AI-powered Presentation Coach (Full-stack SPA) |
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS 4.x |
| State Management | React useState (no external library) |
| Database | In-memory Map + optional MongoDB Atlas (incomplete) |
| Authentication | None |
| Deployment | Vercel-ready |

---

## CODEBASE METRICS

| Metric | Count |
|--------|-------|
| Source Files | 34 |
| Lines of Code | ~2,600 |
| React Components | 11 |
| Custom Hooks | 3 |
| Services | 5 |
| API Routes | 5 |
| Tests | 0 |
| TODOs | 2 |
| console.log (debug) | ~10 |
| `any` type usage | 8 (all eslint-disabled) |

---

## ARCHITECTURE

```
frontend/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (metadata, global CSS)
│   ├── page.tsx                 # Main SPA (~496 lines, all app state lives here)
│   ├── globals.css              # Tailwind imports
│   └── api/
│       ├── analyze/route.ts     # POST: Transcribe audio + Gemini analysis
│       ├── history/route.ts     # GET/POST: Progress history (in-memory)
│       ├── qa/grade/route.ts    # POST: Grade Q&A answer via Gemini
│       ├── slides/upload/route.ts # POST: PDF upload → base64 + slide count
│       └── voice/route.ts       # POST: ElevenLabs text-to-speech
│
├── src/
│   ├── components/
│   │   ├── charts/
│   │   │   └── ProgressChart.tsx  # Recharts line chart (attempt-based x-axis)
│   │   ├── feedback/
│   │   │   ├── ScoreCard.tsx      # Score display (0-10)
│   │   │   ├── FeedbackList.tsx   # Critique + evidence + improvements
│   │   │   └── VoicePlayer.tsx    # Audio playback for coach recap
│   │   ├── qa/
│   │   │   └── QAPanel.tsx        # Interactive Q&A session (record + grade)
│   │   ├── recorder/
│   │   │   ├── SlideUpload.tsx    # PDF file picker + upload
│   │   │   ├── RecordingControls.tsx # Start/Stop buttons
│   │   │   ├── AudioLevelMeter.tsx   # Live audio level visualization
│   │   │   ├── WebcamPreview.tsx     # Video preview (currently unused in flow)
│   │   │   └── useMediaRecorder.ts   # MediaRecorder hook
│   │   └── shared/
│   │       ├── Button.tsx         # Styled button (primary/secondary/ghost)
│   │       └── Card.tsx           # Container card with variants
│   │
│   ├── hooks/
│   │   ├── useMedia.ts           # getUserMedia wrapper (mic access)
│   │   └── useSpeech.ts          # Web Speech API hook (used in QAPanel)
│   │
│   └── services/
│       ├── gemini.ts             # Gemini API: judgePresentation + judgeQAAnswer
│       ├── stt.ts                # AssemblyAI: transcribeAudio + computeMetrics
│       ├── elevenlabs.ts         # ElevenLabs: text-to-speech generation
│       ├── sessionStore.ts       # In-memory Map for Q&A sessions
│       └── db.ts                 # MongoDB helper (mostly stubbed)
│
├── .env.example                  # Environment variable template
├── package.json
├── next.config.ts                # Turbopack config
├── tsconfig.json
├── tailwind.config.ts
└── eslint.config.mjs
```

---

## DATA FLOW

```
  User uploads PDF              User records audio
        │                              │
        v                              v
  /api/slides/upload            Browser MediaRecorder
  (base64 + slide count)        (audio/webm blob)
        │                              │
        └──────────┬───────────────────┘
                   v
            /api/analyze
          ┌────────┴────────┐
          v                 v
   AssemblyAI STT      Gemini 2.0 Flash
   (transcript +       (score, critique,
    word timing +       evidence, Q&A pack)
    confidence)              │
          │                  v
          │           /api/voice (ElevenLabs)
          │           (coach recap audio)
          │                  │
          └──────┬───────────┘
                 v
          Feedback UI (ScoreCard + FeedbackList + VoicePlayer)
                 │
                 v (if Q&A opted in)
          QAPanel → /api/qa/grade → Gemini → feedback per question
```

---

## ENVIRONMENT VARIABLES

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key ([aistudio.google.com](https://aistudio.google.com/)) |
| `GEMINI_MODEL` | No | Model name (default: `gemini-2.0-flash`) |
| `STT_API_KEY` | Yes | AssemblyAI API key for speech-to-text |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for voice feedback |
| `MONGODB_URI` | No | MongoDB Atlas connection string for persistent history |

---

## DEPENDENCIES

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | Framework (App Router + Turbopack) |
| react | 19.2.3 | UI library |
| react-dom | 19.2.3 | React DOM renderer |
| recharts | ^3.7.0 | Progress chart visualization |
| assemblyai | ^4.23.0 | Speech-to-text transcription SDK |

### Dev
| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | ^4 | Utility-first CSS |
| @tailwindcss/postcss | ^4 | PostCSS plugin for Tailwind |
| typescript | ^5 | Type safety |
| eslint | ^9 | Linting |
| eslint-config-next | 16.1.6 | Next.js ESLint rules |
| @types/node | ^20 | Node.js type definitions |
| @types/react | ^19 | React type definitions |
| @types/react-dom | ^19 | React DOM type definitions |

---

## TECHNICAL DEBT & CODE HEALTH

### RED - Critical Issues

| Issue | Location | Impact |
|-------|----------|--------|
| **All state in one component** | `app/page.tsx` (496 lines) | Monolithic — 15+ useState calls, hard to maintain |
| **No tests** | Entire project | Zero test coverage, no unit/integration/e2e tests |
| **No authentication** | Entire project | Anyone can access all features and API routes |
| **In-memory session store** | `src/services/sessionStore.ts` | Q&A sessions lost on server restart/redeploy |
| **In-memory history** | `app/api/history/route.ts` | Progress data lost on restart (MongoDB TODOs unfinished) |

### YELLOW - Needs Attention

| Issue | Location | Notes |
|-------|----------|-------|
| ~10 debug console.logs | API routes + services | Should be removed or replaced with proper logging |
| 8 `any` types | `gemini.ts`, `ProgressChart.tsx` | All have eslint-disable; Gemini API response is untyped |
| `db.ts` is mostly stubbed | `src/services/db.ts` | savePresentation/getPresentationHistory incomplete |
| Slide count uses regex heuristic | `api/slides/upload/route.ts` | Regex `/\/Type\s*\/Page(?!s)/g` may miscount |
| WebcamPreview unused | `src/components/recorder/WebcamPreview.tsx` | Component exists but not used in any flow |
| No rate limiting on API routes | All API routes | Gemini/AssemblyAI/ElevenLabs calls unprotected |
| No input validation/sanitization | API routes | FormData inputs not validated beyond basic checks |
| Gemini 429 retry is naive | `src/services/gemini.ts` | Waits 30s then retries once; no exponential backoff |

### GREEN - Healthy

| Aspect | Notes |
|--------|-------|
| TypeScript strict | Proper typing throughout (except noted `any`) |
| ESLint configured | Next.js ESLint config active |
| Clean component structure | Well-organized barrel exports, separation of concerns |
| `.env.example` present | All env vars documented with links |
| `.gitignore` comprehensive | Covers node_modules, .next, .env, build artifacts |
| Build passes cleanly | `next build` succeeds with 0 errors |

---

## UPGRADE RECOMMENDATIONS

### Priority 1: Persistence (High Impact)

**Problem:** All data is in-memory. Server restart = all history and sessions lost.

**Options:**
| Approach | Effort | Tradeoff |
|----------|--------|----------|
| Finish MongoDB Atlas integration | Medium | Already stubbed in code; requires MongoDB account |
| Supabase (PostgreSQL) | Medium | Free tier, real-time, auth built-in |
| SQLite via Prisma | Low | Zero-config, file-based, good for hackathon |
| localStorage on client | Low | Quick fix for history only; no cross-device sync |

### Priority 2: State Management Refactor

**Problem:** `app/page.tsx` has 15+ useState calls and is approaching 500 lines.

**Recommendation:** Extract into a custom hook or use `useReducer`:
```
usePresentation() → {step, feedback, history, attemptNumber, actions}
```
This would keep `page.tsx` under 100 lines and make the flow testable.

### Priority 3: Add Basic Tests

**Recommendation:**
- Unit tests for `computeMetrics()` in `stt.ts` (pure function, easy to test)
- Unit tests for the Gemini prompt construction
- Integration test for `/api/slides/upload` (PDF → base64 → slide count)
- E2E test with Playwright for the upload → record → feedback flow

### Priority 4: Authentication

**Options:**
| Approach | Effort | Notes |
|----------|--------|-------|
| NextAuth.js | Medium | Supports Google/GitHub OAuth |
| Clerk | Low | Drop-in auth, generous free tier |
| Simple API key middleware | Low | Enough for hackathon demo |

### Priority 5: Cleanup

- [ ] Remove ~10 debug `console.log` statements from API routes
- [ ] Remove unused `WebcamPreview.tsx` component
- [ ] Clean up legacy `analyzePresentation()` function in `gemini.ts` (lines 262-362)
- [ ] Replace `any` types in Gemini service with proper response types
- [ ] Add exponential backoff for Gemini 429 retries
- [ ] Add rate limiting middleware to API routes

---

## QUICK START

```bash
git clone <repo-url>
cd frontend
npm install
cp .env.example .env.local
# Fill in GEMINI_API_KEY and STT_API_KEY at minimum
npm run dev
# Open http://localhost:3000
```

---

## COMMON TASKS

### Add a new feedback metric
1. Update `PresentationReport` interface in `src/services/gemini.ts`
2. Update the `JUDGE_PROMPT` to request the new field
3. Display it in `src/components/feedback/FeedbackList.tsx`

### Add a new API route
1. Create `app/api/<name>/route.ts`
2. Export `GET`/`POST`/etc. async functions
3. Use `NextRequest`/`NextResponse` from `next/server`

### Change the AI model
1. Set `GEMINI_MODEL` in `.env.local` (e.g., `gemini-2.5-pro`)
2. Adjust `maxOutputTokens` in `callGemini()` if needed

### Change the TTS voice
1. Update the default voice ID in `src/services/elevenlabs.ts`
2. Browse voices at [elevenlabs.io/voices](https://elevenlabs.io/voices)

---

*Generated by X-Ray Analysis on 2026-02-07*
