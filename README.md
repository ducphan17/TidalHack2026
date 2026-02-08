 #TidalHack2026

> A project developed for TidalHack 2026

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Overview

Describes Presently.ai as an AI-powered presentation practice tool for students, explaining how it helps with rehearsing presentations and building confidence.

## Features

- Upload the presentation/script as a PDF file
- Present using voice recording with allowed retries
- AI evaluates presentation using clear rubric
- Detailed and actionable feedback
- AI audience asks relevant questions in live Q&A session
- Feedback on Q&A session for improvement

## Tech Stack

| Category         | Technology                        |
|------------------|-----------------------------------|
| Framework        | Next.js 16.1.6 (App Router)      |
| Language         | TypeScript 5 (strict mode)        |
| UI Library       | React 19.2.3                      |
| Styling          | Tailwind CSS 4                    |
| Animations       | Framer Motion 12                  |
| Charts           | Recharts 3                        |
| AI Analysis      | Google Gemini 2.5 Flash (REST API)|
| Embeddings       | Gemini Embedding 001 (768-dim)    |
| Speech-to-Text   | AssemblyAI (server + real-time WS)|
| Text-to-Speech   | ElevenLabs (v2 multilingual)      |
| Database         | MongoDB Atlas (mongodb 7.1)       |
| PDF Processing   | pdf-lib 1.17                      |
| Deployment       | Vercel (recommended)              |


## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- MongoDB Atlas cluster (free tier works)
- API keys: Gemini (required), AssemblyAI (required), ElevenLabs (optional)

### Installation

```bash
git clone https://github.com/ducphan17/TidalHack2026.git
cd TidalHack2026/frontend

npm install

cp .env.example .env.local
# Edit .env.local with your API keys (see Section 7)

npm run dev
# Open http://localhost:3000
```

### First-time Setup

1. Create a MongoDB Atlas cluster and get the connection string
2. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
3. Get an AssemblyAI API key from [assemblyai.com](https://www.assemblyai.com/)
4. (Optional) Get an ElevenLabs API key for voice coaching
5. (Optional) Create the Atlas Vector Search index `pdf_chunks_vec` on the `pdf_chunks` collection for RAG-powered Live Q&A (see Section 6)

## Project Structure

### Directory Structure

```
frontend/
├── app/                           # Next.js App Router (top-level, NOT in src/)
│   ├── layout.tsx                 # Root layout (dark theme, Starfield bg)
│   ├── page.tsx                   # Main SPA — all UI states live here
│   ├── globals.css                # CSS variables, custom animations
│   ├── favicon.ico
│   └── api/
│       ├── analyze/route.ts       # POST — full pipeline: STT → metrics → Gemini judge
│       ├── history/route.ts       # GET/POST — score history CRUD
│       ├── voice/route.ts         # POST — ElevenLabs TTS (batch)
│       ├── voice/stream/route.ts  # POST — ElevenLabs TTS (streaming)
│       ├── stt/token/route.ts     # GET — AssemblyAI real-time WS token
│       ├── slides/upload/route.ts # POST — PDF upload + page count
│       ├── pdf/index/route.ts     # POST — index PDF chunks for RAG
│       ├── pdf/search/route.ts    # POST — vector search PDF chunks
│       ├── qa/grade/route.ts      # POST — grade a single Q&A answer
│       ├── qa/stream/route.ts     # GET — SSE stream of Q&A turns (MongoDB change stream)
│       └── qa/live/
│           ├── route.ts           # POST — conversational Q&A (AI asks, user answers)
│           ├── generate/route.ts  # POST — batch generate Q&A questions
│           └── grade-all/route.ts # POST — grade all Live Q&A answers at once
├── src/
│   ├── components/
│   │   ├── landing/               # LandingPage splash screen
│   │   ├── recorder/              # SlideUpload, RecordingCircle, audio visualizers
│   │   ├── feedback/              # ScoreCard, ScoreBreakdownPanel, FeedbackList, VoicePlayer
│   │   ├── qa/                    # QAPanel (static Q&A), LiveQAPanel (conversational)
│   │   ├── charts/                # ProgressChart (Recharts line chart)
│   │   ├── shared/                # Card, Button, BokehBackground, SnowflakesBackground
│   │   ├── ui/                    # GlassCard, CardBlock, card
│   │   └── Starfield.tsx          # Canvas-based starfield background
│   ├── hooks/
│   │   ├── useMedia.ts            # Microphone access (getUserMedia)
│   │   ├── useSpeech.ts           # Web Speech API wrapper (turn-based)
│   │   ├── useStreamingSpeech.ts  # AssemblyAI real-time WebSocket STT
│   │   └── useLiveQA.ts           # Full Live Q&A orchestrator (state machine)
│   └── services/
│       ├── gemini.ts              # All Gemini API calls (judge, Q&A, grading)
│       ├── elevenlabs.ts          # ElevenLabs TTS with coach voice presets
│       ├── stt.ts                 # AssemblyAI batch transcription + metrics
│       ├── mongoClient.ts         # Cached MongoClient singleton
│       ├── db.ts                  # getDb() → "tidalhack" database
│       ├── collections.ts         # Typed collection accessors + index creation
│       ├── sessionStore.ts        # Session save/get (24h TTL)
│       ├── geminiEmbeddings.ts    # Gemini embedding API wrapper
│       └── pdfChunks.ts           # PDF slide indexing + vector search (RAG)
└── public/
    ├── header-logo.png            # App header logo
    ├── landing-left.png           # Landing page assets
    ├── landing-right.png
    ├── audio-processor.js         # AudioWorklet for real-time PCM streaming
    └── *.svg                      # Default Next.js SVGs
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Single Page App)                       │
│                                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐  │
│  │ Landing   │──▶│  Upload +    │──▶│  Recording   │──▶│  Feedback  │  │
│  │ Page      │   │  Setup       │   │  (mic only)  │   │  Dashboard │  │
│  └──────────┘   └──────────────┘   └──────────────┘   └─────┬──────┘  │
│                                                              │         │
│                                                    ┌─────────┴───────┐ │
│                                                    │  Live Q&A Mode  │ │
│                                                    │  (chat + voice) │ │
│                                                    └─────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ API calls
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTES (Server)                        │
│                                                                         │
│  /api/slides/upload ─── PDF upload, base64 encode, page count           │
│  /api/analyze ───────── SSE stream: STT → Metrics → Gemini → Score     │
│  /api/history ───────── CRUD score history                              │
│  /api/voice ─────────── ElevenLabs TTS (batch + stream)                │
│  /api/stt/token ─────── AssemblyAI real-time WebSocket token            │
│  /api/pdf/index ─────── Embed + store PDF chunks (RAG)                  │
│  /api/pdf/search ────── Vector search slide content                     │
│  /api/qa/grade ──────── Grade single Q&A answer                         │
│  /api/qa/live ───────── Conversational Q&A (AI ↔ User)                  │
│  /api/qa/stream ─────── SSE: MongoDB change stream for Q&A turns        │
└──────────┬───────────────────────┬──────────────────────┬───────────────┘
           │                       │                      │
           ▼                       ▼                      ▼
┌────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
│  Google Gemini │   │  AssemblyAI      │   │  ElevenLabs             │
│  - Analysis    │   │  - Batch STT     │   │  - TTS Voice Coaching   │
│  - Q&A Gen     │   │  - Real-time WS  │   │  - Multiple voices      │
│  - Grading     │   │                  │   │  - Streaming playback   │
│  - Embeddings  │   └──────────────────┘   └──────────────────────────┘
└────────┬───────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    MONGODB ATLAS (db: "tidalhack")                       │
│                                                                          │
│  sessions ──── sessionId, pdfBase64, qaQuestions, report (TTL 24h)       │
│  history ───── userId, score, attempt, timestamp                         │
│  qa_turns ──── sessionId, role, text, questionNumber (change streams)    │
│  pdf_chunks ── pdfHash, slide, text, embedding[768] (vector search)     │
│  slide_images  sessionId, slideNumber, imageBase64 (currently unused)    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
