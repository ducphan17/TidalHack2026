# STEP 3: BLUEPRINT (Agreement)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: BLUEPRINT                                                                      │
│  Owner: Both (AI drafts, Human approves)                                               │
│  Goal: Detailed technical plan + modules + data contracts                               │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  A) ROUTES (Next.js App Router)                                                         │
│                                                                                        │
│  1) POST /api/slides/upload                                                             │
│     - Input: PDF                                                                        │
│     - Output: { deckId, slideCount }                                                     │
│     - Internal:                                                                          │
│         • Extract slide TEXT per slide                                                   │
│         • Render slide IMAGE per slide (png/jpg)                                         │
│         • Store in Mongo: Deck + Slide assets                                            │
│                                                                                        │
│  2) GET /api/stt/token                                                                   │
│     - Output: { token, expiresInSeconds }                                                │
│     - Purpose: browser can connect to AssemblyAI streaming WS without exposing API key  │
│                                                                                        │
│  3) WS: AssemblyAI Streaming STT (browser)                                               │
│     - Send: PCM16 mono @ 16kHz chunks                                                    │
│     - Receive: partial transcript + end_of_turn boolean + confidence                     │
│                                                                                        │
│  4) POST /api/qa/live  (Gemini SSE proxy)                                                │
│     - Input: { sessionId, deckId, utterance, slideHints, history }                       │
│     - Output: SSE stream of { deltaText } and { done }                                   │
│     - Gemini prompt includes selected slide TEXT + selected slide IMAGE(s)               │
│                                                                                        │
│  5) POST /api/voice/stream (ElevenLabs streaming TTS)                                    │
│     - Input: { text, mode }                                                              │
│     - Output: audio/mpeg stream                                                          │
│     - IMPORTANT: format text as SPOKEN COACH SCRIPT (not bullet report)                  │
│                                                                                        │
│  6) POST /api/pii/redact                                                                 │
│     - Input: { text }                                                                    │
│     - Output: { redactedText, piiFound, piiTags[] }                                      │
│     - Runs before DB writes                                                              │
│                                                                                        │
│  7) POST /api/session/save                                                               │
│     - Input: { session } (already redacted)                                              │
│     - Output: { ok, sessionId }                                                          │
│                                                                                        │
│                                                                                        │
│  B) CLIENT: HANDSFREE + BARGE-IN STATE MACHINE                                           │
│                                                                                        │
│  STATES:                                                                                │
│    LISTENING  →  THINKING  →  SPEAKING                                                   │
│       ▲           │           │                                                          │
│       └───────────┴───────────┘                                                          │
│             barge-in (user speech during SPEAKING)                                       │
│                                                                                        │
│  BARGE-IN RULE (must feel instant):                                                     │
│  - If any new user speech is detected while AI is speaking:                              │
│      1) stop audio playback immediately                                                   │
│      2) cancel in-flight TTS request (AbortController)                                    │
│      3) stay in LISTENING and treat new speech as the next user turn                      │
│                                                                                        │
│  ECHO CONTROL (practical approach):                                                      │
│  - getUserMedia: echoCancellation + noiseSuppression                                      │
│  - optional: “duck” AI volume while listening                                             │
│  - keep microphone always on, but allow barge-in to cut AI speech                          │
│                                                                                        │
│                                                                                        │
│  C) SLIDE SELECTION (“explain slide A”)                                                   │
│                                                                                        │
│  Slide selection priority:                                                               │
│   1) Explicit: “slide 7”, “slide A” → select that slide                                   │
│   2) Current slide index (if UI tracks it) → attach current slide                         │
│   3) Retrieval: keyword match / embedding match → top-K slides                             │
│                                                                                        │
│  Gemini context per turn:                                                                │
│   - System: presentation coach persona (concise, friendly, actionable)                    │
│   - Attach: selected slide TEXT + selected slide IMAGE(s)                                 │
│   - User: utterance                                                                      │
│                                                                                        │
│                                                                                        │
│  D) “SOUND HUMAN” TEXT POLICY BEFORE TTS                                                  │
│                                                                                        │
│  - Convert analysis into spoken script:                                                   │
│     • short sentences                                                                     │
│     • contractions (“you’re”, “that’s”)                                                   │
│     • no long bullet lists                                                                 │
│     • avoid exact timestamps (say “around halfway”)                                        │
│     • line breaks for pacing                                                              │
│  - Use a non-default voice (avoid the overly-familiar demo voice)                         │
│                                                                                        │
│                                                                                        │
│  E) MONGO DATA MODEL                                                                      │
│                                                                                        │
│  Deck:                                                                                   │
│    { deckId, createdAt, slideCount,                                                       │
│      slides: [{ index, text, imageUrl, thumbUrl? }] }                                     │
│                                                                                        │
│  Session:                                                                                │
│    { sessionId, deckId, createdAt, endedAt?,                                               │
│      turns: [{ role, text, ts, slideRefs: [index], confidence? }],                        │
│      transcriptRedacted: true, piiTags: [],                                                │
│      recap: { score, highlights[], nextSteps[] } }                                         │
│                                                                                        │
│                                                                                        │
│  ✅ CHECKPOINT                                                                            │
│  [ ] Handsfree barge-in works (AI stops speaking instantly)                               │
│  [ ] Slide text + slide image grounding works                                              │
│  [ ] Mongo saves deck + sessions                                                           │
│  [ ] PII redaction runs before DB write                                                    │
│  [ ] Coach voice sounds conversational (spoken script)                                     │
│                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Acceptance criteria (core)
- While AI is speaking, user says “wait” → **AI stops quickly** and listens.
- User says “explain slide 4” → AI references that slide content (text/image grounding).
- Transcript stored in Mongo has emails/phones **redacted**.
