# STEP 1: VISION (AI proposes)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: VISION                                                                       │
│  Owner: Architect (AI)                                                                │
│  Goal: Define a “human-like” live voice Q&A + slide-aware coach                        │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  Homeowner:                                                                            │
│  "I want natural, handsfree Q&A with barge-in (like a real conversation).              │
│   The AI should reference my slide text + slide images (“as you mention on slide A…”). │
│   Save decks + Q&A sessions to Mongo. Redact PII in transcripts."                      │
│                                                                                        │
│  Architect:                                                                            │
│  "I propose a LIVE VOICE COACH that runs as a voice agent loop:                         │
│                                                                                        │
│   🧠 LIVE EXPERIENCE                                                                    │
│   - Always-listening mic                                                               │
│   - Live captions (partial transcript)                                                 │
│   - End-of-turn detection (AI waits until you finish, but feels natural)               │
│   - AI answers immediately (streamed text + streamed voice)                            │
│   - Barge-in: if user starts speaking, AI stops speaking instantly                     │
│                                                                                        │
│   🖼️ SLIDE-AWARE EXPLANATIONS                                                          │
│   - The AI can “point to” the deck: explain a chart, a bullet, or a diagram            │
│   - Supports: “Explain slide 7”, “What does this chart mean?”, “Go back to slide A”    │
│                                                                                        │
│   🔒 PRIVACY & STORAGE                                                                  │
│   - Redact PII (emails/phones) before saving transcript/recap                          │
│   - Save deck assets + sessions to Mongo for replay and progress tracking              │
│                                                                                        │
│   🎙️ SOUND HUMAN (without imitating any real person)                                  │
│   - Use a unique coach voice (non-default voice)                                       │
│   - Convert feedback into spoken script (short lines + pauses + contractions)          │
│   - Stream TTS so it feels responsive                                                   │
│                                                                                        │
│   ✅ MVP DELIVERY                                                                       │
│   - Handsfree + barge-in                                                                │
│   - Slide text + slide image grounding                                                  │
│   - Session saved to Mongo + PII redaction                                               │
│                                                                                        │
│   Then we add: stronger slide retrieval, better recap scoring, and richer analytics."  │
│                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Outcomes
- **Feels like a real voice conversation** (handsfree, barge-in)
- **Grounded answers** (“as you mention on slide …” with text + image context)
- **Session memory** (Mongo) + **privacy** (PII redaction before storage)
- **Human-sounding coach** through script formatting + streaming TTS (no celebrity imitation)
