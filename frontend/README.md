# Present AI

AI-powered presentation coaching for students. Record yourself presenting and get instant feedback on filler words, pace, pauses, and body language.

## Features

- **Record** – Webcam + microphone via MediaRecorder API
- **Transcript** – Real-time speech-to-text via Web Speech API
- **Analyze** – Multimodal analysis (Gemini 2.0 Flash)
- **Feedback** – Score, filler words, pace, pauses, improvements
- **Voice coaching** – ElevenLabs (optional)
- **Progress** – Track scores over time (Recharts)

## Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your API keys:
   - **GEMINI_API_KEY** (required) – [Google AI Studio](https://aistudio.google.com/)
   - **ELEVENLABS_API_KEY** (optional) – [ElevenLabs](https://elevenlabs.io/)
   - **MONGODB_URI** (optional) – In-memory fallback when not set

3. Run the dev server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx           # Meeting Room (main UI)
│   └── api/
│       ├── analyze/       # Video + transcript → Gemini analysis
│       ├── history/       # GET/POST user scores
│       └── voice/         # ElevenLabs proxy
├── components/
│   ├── recorder/          # Webcam, MediaRecorder, controls
│   ├── feedback/          # Score, FeedbackList, VoicePlayer
│   ├── charts/            # ProgressChart (Recharts)
│   └── shared/            # Button, Card
├── hooks/
│   ├── useMedia.ts        # Camera/mic access
│   └── useSpeech.ts       # Web Speech API
└── services/
    ├── gemini.ts          # Multimodal analysis
    ├── elevenlabs.ts      # Voice generation
    └── db.ts              # MongoDB / in-memory
```

## Tech Stack

- **Frontend**: React 19, Next.js 16, Tailwind CSS
- **Recording**: MediaRecorder API
- **STT**: Web Speech API
- **Analysis**: Gemini 2.0 Flash
- **Voice**: ElevenLabs (optional)
- **Charts**: Recharts
- **Storage**: MongoDB Atlas (optional)
