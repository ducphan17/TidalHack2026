# STEP 4: CONTRACT (Scope lock)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: CONTRACT                                                                       │
│  Owner: Architect (AI)                                                                  │
│  Goal: Lock scope + quality constraints before coding                                    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  📋 DELIVERABLES (MVP+):                                                                 │
│  - Handsfree live voice Q&A (always listening)                                           │
│  - Live captions (partial + final transcript)                                           │
│  - AI answers with streamed text + streamed voice                                        │
│  - Barge-in: user interruption stops AI speech immediately                               │
│  - Slide-aware explanations: slide TEXT + slide IMAGE grounding                          │
│  - Save decks + sessions to Mongo                                                        │
│  - PII redaction on transcript + recap BEFORE saving                                     │
│                                                                                        │
│  🛠️ TECH STACK:                                                                         │
│  - Next.js 14 (App Router)                                                              │
│  - AssemblyAI Streaming STT (browser WS + server token route)                            │
│  - Gemini streaming response (SSE) with multimodal slide context                         │
│  - ElevenLabs streaming TTS                                                              │
│  - MongoDB for persistence                                                               │
│                                                                                        │
│  ⚙️ QUALITY RULES:                                                                      │
│  - No secret keys in the browser (use temporary STT token route)                         │
│  - Spoken-script formatting before TTS (no report narration)                             │
│  - Barge-in must stop audio quickly (use AbortController + audio.pause())               │
│  - PII redaction occurs BEFORE any DB write                                              │
│                                                                                        │
│  ✅ ACCEPTANCE TESTS:                                                                    │
│  1) AI speaking → user says “hold on” → AI stops and listens                              │
│  2) “Explain slide 7 chart” → AI answers using slide 7 image + text                      │
│  3) Transcript saved contains no raw emails/phones (redacted)                            │
│  4) Session replay shows turns + slide refs                                              │
│                                                                                        │
│  ⚠️ OUT OF SCOPE (for now):                                                             │
│  - Perfect echo removal across all devices/environments                                  │
│  - Multi-human diarization / speaker identification                                      │
│  - Mobile native apps                                                                    │
│  - Payments / admin panel                                                                │
│                                                                                        │
│  NOTE: We will create a unique coach voice persona.                                      │
│  (No imitation of a specific real person.)                                               │
│                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
