┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: VISION                                                     │
│  Owner: Architect (AI)                                              │
│  Goal: Propose an improved Live Q&A experience using proven patterns│
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Homeowner: "I already have Live Q&A working. I want to improve it: │
│  fix transcript bugs, make captions stable, and make the flow feel  │
│  like real Q&A (AI asks first, follow-ups, barge-in)."              │
│                                                                     │
│  Architect:                                                         │
│  "For improving your existing Live Q&A, I propose this focused      │
│  vision (works for ~80% of voice-first Q&A loops):                  │
│                                                                     │
│  ✅ GOAL                                                            │
│  Turn your current loop into a reliable, realistic Q&A simulator:   │
│   • Turn-based speech capture (no accumulation)                      │
│   • Stable live captions (final text never rewrites)                 │
│   • AI-asks-first mode (moderator-driven Q&A)                         │
│   • Barge-in that always wins (user voice interrupts instantly)      │
│   • Enforced session limits (maxQuestions)                           │
│                                                                     │
│  ────────────────────────────────────────────────────────────────   │
│  📐 IMPROVED LIVE Q&A FLOW (state machine)                           │
│                                                                     │
│   IDLE                                                              │
│    → START_SESSION                                                  │
│                                                                     │
│   AI_ASKING  (AI picks a question grounded in slides + history)      │
│    → AI_SPEAKING (ElevenLabs plays the question)                     │
│    → (audio ended OR user barge-in)                                  │
│                                                                     │
│   USER_ANSWERING (listen for one “turn”)                             │
│    → live captions update                                            │
│    → silence detected (end-of-turn)                                  │
│                                                                     │
│   AI_THINKING (Gemini evaluates answer + generates next question)    │
│    → AI_SPEAKING (ElevenLabs plays feedback + next question)         │
│    → loop                                                           │
│                                                                     │
│   DONE (maxQuestions reached OR user ends)                           │
│                                                                     │
│  BARGE-IN RULE (always consistent):                                  │
│   - If user speaks during AI_SPEAKING:                               │
│       pause audio + abort in-flight fetches + USER_ANSWERING         │
│                                                                     │
│  ────────────────────────────────────────────────────────────────   │
│  🧠 QUESTIONING BEHAVIOR (feels like real life)                      │
│                                                                     │
│   AI asks first, then adapts:                                        │
│   • Broad opener (what / why / who benefits)                         │
│   • Slide-grounded follow-up (“On the latency slide…”)               │
│   • Clarifier when vague (“Can you give a concrete example?”)        │
│   • Pushback sometimes (“What if the PDF has PII?”)                  │
│                                                                     │
│  Question sources (in priority order):                               │
│   1) Slide topics + claims (PDF grounding)                            │
│   2) User’s last answer (ask what’s missing)                          │
│   3) Common audience questions (risk, cost, privacy, latency)         │
│                                                                     │
│  ────────────────────────────────────────────────────────────────   │
│  🎙️ SPEECH CAPTURE VISION (fix your current bugs)                    │
│                                                                     │
│  A) Turn isolation (fix accumulation forever)                        │
│   - Each user answer is a “turn” with its own buffers                │
│   - On new turn: reset buffers (soft reset or hard restart)          │
│   - Submit ONLY this turn’s final text                               │
│                                                                     │
│  B) No stale callbacks                                               │
│   - Store onResult in a ref; recognition always calls latest handler │
│                                                                     │
│  C) Captions that look stable                                        │
│   - Render FinalText + InterimText separately                         │
│   - Never mutate FinalText after it’s committed                       │
│                                                                     │
│  D) Accuracy path (practical upgrade)                                │
│   - Web Speech = low-latency captions (UI)                            │
│   - Optional: MediaRecorder + server STT = final answer text (AI)     │
│                                                                     │
│  ────────────────────────────────────────────────────────────────   │
│  🧾 SERVER CONTRACT (simple + robust)                                │
│                                                                     │
│  Replace “answer-only” with turn outputs:                            │
│   Request: { sessionId, question, userAnswer, history, pdfBase64 }   │
│   Response: {                                                       │
│     feedback: string,                                                │
│     score: number,                                                   │
│     nextQuestion: string,                                            │
│     updatedHistory: [...]                                            │
│   }                                                                 │
│                                                                     │
│  This enables AI-asks-first + follow-ups without extra endpoints.    │
│                                                                     │
│  ────────────────────────────────────────────────────────────────   │
│  ✅ DEFINITION OF “IMPROVED” (acceptance)                            │
│                                                                     │
│   • Each round submits ONLY the newest utterance (no accumulation)   │
│   • Captions don’t “fix” old sentences; final stays final            │
│   • Barge-in is reliable (interrupt anytime, no stuck states)        │
│   • maxQuestions is enforced (session ends cleanly)                   │
│   • AI-asks-first produces realistic Q&A sequences from the PDF      │
│                                                                     │
│  If you share your current hook files in STEP 2, I’ll tailor the     │
│  Blueprint to your exact code and lock the final state machine.      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
