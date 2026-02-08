┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: CONTRACT                                                   │
│  Owner: Architect (AI)                                              │
│  Goal: Lock scope + commitments for Live Q&A improvements            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PROJECT: Live Q&A Improvements (Speech + Flow + Uniqueness)         │
│                                                                     │
│  ✅ DELIVERABLES (what will be implemented)                          │
│                                                                     │
│  1) Live Q&A State Machine Upgrade                                   │
│     - States: IDLE, AI_THINKING, AI_SPEAKING, USER_ANSWERING, DONE   │
│     - AI asks FIRST question at session start                        │
│     - Each round: user answers → AI gives brief feedback → next Q     │
│     - User can say “don’t know / don’t remember” → skip to next Q     │
│                                                                     │
│  2) Speech Reliability Fixes (Web Speech API)                         │
│     - Turn isolation: each answer is a clean “turn” (no accumulation)│
│     - Captions stability: Final text never rewrites; Interim is live │
│     - Fix stale onResult closure using ref-based callback wiring     │
│     - Silence threshold stays 1.5s (submits at end-of-turn)          │
│                                                                     │
│  3) Barge-in Behavior (your chosen rule)                             │
│     - If user speaks while AI audio is playing:                      │
│        • pause audio immediately                                     │
│        • keep current AI text visible (even if cut mid-sentence)     │
│        • switch to USER_ANSWERING                                    │
│        • do NOT force AI to finish sentence                          │
│                                                                     │
│  4) Session Rules Enforcement                                        │
│     - maxQuestions = 5 enforced (count questions asked)              │
│     - maxAnswerTime = 5 minutes enforced (auto-submit/auto-skip)     │
│     - End state = DONE; stop speech + audio; call onEnd(history)     │
│                                                                     │
│  5) Question Uniqueness                                              │
│     - In-session: never repeat a question within the same run        │
│     - Cross-attempt (Attempt 2): all-new questions by avoiding last  │
│       run’s askedQuestions for the same slide deck                   │
│       (requires storing askedQuestions keyed by pdfHash in Mongo)    │
│                                                                     │
│  6) Server Contract + Prompt Update (Gemini)                         │
│     - /api/qa/live supports:                                         │
│        mode = FIRST_QUESTION or NEXT_TURN                            │
│     - Returns strict JSON: { question, feedback? }                   │
│     - Prompt rules include:                                         │
│        • broad → deep follow-ups                                     │
│        • confirm when transcript is unclear                           │
│        • never repeat askedQuestions                                  │
│        • spoken style: 1–2 concise sentences                          │
│                                                                     │
│  📁 FILES TO CHANGE (exact scope)                                    │
│   - src/hooks/useSpeech.ts                                           │
│   - src/hooks/useLiveQA.ts                                           │
│   - src/components/qa/LiveQAPanel.tsx (and LiveQASession UI)         │
│   - app/api/qa/live/route.ts                                         │
│   - src/services/gemini.ts                                           │
│   - (Optional for attempt-2 uniqueness) sessionStore/Mongo helper    │
│                                                                     │
│  🧪 ACCEPTANCE CRITERIA (definition of done)                         │
│                                                                     │
│  A) No transcript accumulation                                       │
│     - Round 2+ submits ONLY the newest user answer (this turn)       │
│                                                                     │
│  B) Captions look stable                                             │
│     - Final text does not change after it becomes final              │
│     - Interim text can rewrite without corrupting final text         │
│                                                                     │
│  C) AI asks first + realistic variety                                │
│     - Session starts with AI question (no user must speak first)     │
│     - Questions vary across attempts (Attempt 2 not similar)         │
│                                                                     │
│  D) Barge-in works every time                                        │
│     - Speaking during AI audio pauses immediately, then listens      │
│                                                                     │
│  E) Limits enforced                                                  │
│     - Stops cleanly at 5 questions                                    │
│     - Stops/auto-submits at 5 minutes if user keeps talking          │
│                                                                     │
│  ⚙️ TECH STACK (locked)                                              │
│   - Frontend: Next.js (App Router) + React + Tailwind                │
│   - Speech: Web Speech API (Chrome)                                  │
│   - LLM: Gemini (PDF grounding stays)                                │
│   - TTS: ElevenLabs                                                  │
│   - Storage: MongoDB (sessions + attempt-2 question avoidance)       │
│                                                                     │
│  ⚠️ OUT OF SCOPE (explicitly excluded)                               │
│   - Replacing Web Speech with a different realtime STT engine        │
│   - Building full scoring/rubric UI (you’ll provide rubric later)    │
│   - Advanced diarization / speaker separation                        │
│   - Payment/auth/user accounts                                       │
│   - Full analytics dashboard                                         │
│                                                                     │
│  CHANGE CONTROL (to prevent scope creep)                             │
│   - Structural changes to the flow after build starts are out-of-scope│
│   - Only small copy/prompt tweaks are allowed during build           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
