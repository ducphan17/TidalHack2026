# STEP 5: BUILD (AI codes)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: BUILD                                                                           │
│  Owner: Builder (AI)                                                                     │
│  Goal: Implement exactly according to the Blueprint                                      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  BUILD ORDER (recommended):                                                             │
│                                                                                        │
│  1) Slides pipeline (text + image)                                                      │
│     ✅ PDF upload route                                                                  │
│     ✅ Extract slide text                                                                │
│     ✅ Render slide images (png/jpg)                                                     │
│     ✅ Store deck in Mongo (deckId, slides[])                                            │
│                                                                                        │
│  2) Handsfree Streaming STT                                                             │
│     ✅ /api/stt/token route                                                              │
│     ✅ Client WS to AssemblyAI streaming                                                 │
│     ✅ AudioWorklet: mic → PCM16@16kHz chunks                                            │
│     ✅ Live captions UI (partial transcript)                                             │
│                                                                                        │
│  3) Turn manager + barge-in                                                             │
│     ✅ Always listening                                                                  │
│     ✅ When AI is speaking and user starts talking:                                      │
│        - stop audio immediately                                                         │
│        - cancel TTS fetch (AbortController)                                              │
│        - continue capturing new user utterance                                           │
│                                                                                        │
│  4) Gemini live Q&A (multimodal grounding)                                               │
│     ✅ /api/qa/live SSE proxy                                                            │
│     ✅ Slide selector: current slide / “slide #” parse / top-K retrieval                 │
│     ✅ Attach slide text + slide image(s) to Gemini per turn                             │
│                                                                                        │
│  5) Human voice layer                                                                    │
│     ✅ Spoken-script formatter before TTS                                                │
│     ✅ ElevenLabs streaming TTS route                                                    │
│     ✅ Non-default voice selection + tuned settings                                      │
│                                                                                        │
│  6) PII redaction + persistence                                                          │
│     ✅ /api/pii/redact                                                                   │
│     ✅ Redact transcript + recap BEFORE Mongo save                                       │
│     ✅ /api/session/save stores deckId + turns + recap                                   │
│                                                                                        │
│  7) End recap                                                                            │
│     ✅ Session summary: score, highlights, next steps                                    │
│                                                                                        │
│  DONE: Run and test acceptance criteria (Contract).                                     │
│                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Definition of done checklist
- [ ] Handsfree works without push-to-talk
- [ ] Barge-in stops AI speech quickly
- [ ] Slide “explain A” works with slide image + text grounding
- [ ] Mongo stores decks and sessions
- [ ] Transcript is PII-redacted before saving
- [ ] Voice output sounds like spoken coaching (not report narration)
