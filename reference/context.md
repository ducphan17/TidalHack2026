# STEP 2: CONTEXT (Human provides)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: CONTEXT                                                                       │
│  Owner: Homeowner (Human)                                                              │
│  Goal: Provide constraints so AI can lock the right design                              │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  LATENCY TARGET:                                                                       │
│  - Natural (1–2s is okay if it feels human and conversational)                          │
│                                                                                        │
│  TURN STYLE:                                                                           │
│  - Handsfree + barge-in (user can interrupt AI like a real Q&A)                         │
│                                                                                        │
│  SLIDE CONTEXT:                                                                        │
│  - Slide text + slide image                                                            │
│  - User can say: “As you mention in your presentation, explain A”                       │
│                                                                                        │
│  STORAGE:                                                                              │
│  - Save presentations (deck assets) and Q&A sessions to Mongo (keys already available)  │
│                                                                                        │
│  PRIVACY:                                                                              │
│  - PII redaction in transcript before saving                                            │
│                                                                                        │
│  TONE / HUMANNESS:                                                                     │
│  - “Sound human” (spoken coach, not a report narrator)                                  │
│  - No imitation of real celebrities                                                     │
│                                                                                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Design implications (locked in)
- **Handsfree** requires **echo control** + **barge-in** cancellation (stop AI audio instantly on user speech).
- Slide grounding requires **rendering slide images** + extracting slide text, then **selecting relevant slides** per turn.
- PII redaction must run **before any DB write** (transcript + recap).
- “Sound human” requires a **spoken-script formatter** before calling TTS + a **non-default voice**.
