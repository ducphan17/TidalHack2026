┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: BLUEPRINT                                                  │
│  Owner: Both (AI drafts, Human approves)                            │
│  Goal: Produce a detailed, agreed-upon plan for Live Q&A upgrades    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SCOPE (only Live Q&A improvements)                                 │
│   ✅ Fix transcript accumulation + stale callback + caption stability │
│   ✅ Add AI-asks-first realistic Q&A loop                            │
│   ✅ Enforce: maxQuestions=5, maxAnswerTime=5 min, silence=1.5s      │
│   ✅ “don’t know / don’t remember” → skip to next question           │
│   ✅ Barge-in: pause audio ONLY, keep current AI text visible        │
│   ✅ Attempt 2 produces all-new questions (no repeats)               │
│                                                                     │
│  OUT OF SCOPE (for this step)                                       │
│   ❌ Full rubric/scoring system (you’ll define later)                │
│   ❌ Replacing Gemini / ElevenLabs / Mongo                           │
│   ❌ Advanced STT pipeline (MediaRecorder) unless you choose later    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  A) FINAL STATE MACHINE (Live Q&A feels like real Q&A)               │
│                                                                     │
│  States:                                                            │
│   IDLE                                                              │
│   AI_THINKING     (Gemini generating next question / feedback)       │
│   AI_SPEAKING     (ElevenLabs audio playing)                         │
│   USER_ANSWERING  (Web Speech listening for one turn)                │
│   DONE                                                              │
│                                                                     │
│  Primary Loop:                                                      │
│   1) Start Session                                                   │
│      → AI_THINKING: fetch FIRST_QUESTION (Gemini)                    │
│      → AI_SPEAKING: speak question (ElevenLabs)                      │
│      → USER_ANSWERING: listen                                       │
│                                                                     │
│   2) User answers (one “turn”)                                       │
│      → silence 1.5s OR maxAnswerTime 5 min → submit answer           │
│      → AI_THINKING: generate (feedback + nextQuestion)               │
│      → AI_SPEAKING: speak feedback (optional short)                  │
│      → AI_SPEAKING: speak nextQuestion                               │
│      → USER_ANSWERING                                                │
│                                                                     │
│   3) Stop condition                                                   │
│      → after 5 questions asked → DONE → onEnd(history)               │
│                                                                     │
│  Barge-in rule (your requirement):                                  │
│   - If user starts speaking while AI_SPEAKING:                        │
│       pause audio immediately                                         │
│       keep AI text as-is (even if cut mid-sentence)                   │
│       transition → USER_ANSWERING                                     │
│       (do NOT delete current AI text; do NOT require AI to finish)    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  B) SPEECH CAPTURE FIX (stable captions + no accumulation)           │
│                                                                     │
│  1) Change the speech model from “one growing string” → “turn-based” │
│     - Keep two buffers per turn:                                     │
│        finalText (committed) + interimText (live partial)            │
│     - UI rule: finalText never changes once committed;               │
│              interimText can rewrite freely                           │
│                                                                     │
│  2) Fix stale onResult closure                                       │
│     - Store onResult in a ref (onResultRef)                           │
│     - recognition.onresult always calls onResultRef.current(...)     │
│                                                                     │
│  3) Turn isolation (no transcript accumulation across questions)     │
│     Choose ONE approach (default = Soft Reset):                      │
│                                                                     │
│     Option A — Soft Reset (keep recognition running) ✅ recommended  │
│       - Track engine result length: resultsLenRef                    │
│       - On new turn: turnBaseIndexRef = resultsLenRef                 │
│       - In onresult: process only i >= turnBaseIndexRef              │
│       - Clears buffers for UI + submission each turn                 │
│                                                                     │
│     Option B — Hard Reset (abort + start each turn)                   │
│       - resetTurn(): clear buffers + recognition.abort() + start()   │
│       - More brute-force; sometimes glitchy but simplest to reason   │
│                                                                     │
│  4) Fix isFinal logic                                                │
│     - Current: isFinal = (interimTranscript === "") is incorrect     │
│     - New: onResult receives {finalText, interimText, hasFinalChunk} │
│                                                                     │
│  5) Silence timer should submit “this turn only”                      │
│     - On ANY speech result: reset silence timer                       │
│     - On timeout: submit turnFinalText (or combined if needed)        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  C) QUESTION UNIQUENESS (Attempt 2 must be all-new)                  │
│                                                                     │
│  In-session uniqueness (must):                                       │
│   - Maintain askedQuestions[] in client state                         │
│   - Send askedQuestions to Gemini each time                           │
│   - Prompt: “Do NOT repeat questions already asked.”                  │
│                                                                     │
│  Cross-attempt uniqueness (for retry / attempt 2):                   │
│   - Store run history in Mongo: { sessionId, pdfHash, askedQuestions }│
│   - On new run for same pdfHash (attempt 2):                          │
│       load previous askedQuestions (last run) and pass as avoid list  │
│                                                                     │
│  (If you don’t want pdfHash yet, MVP fallback: generate a new seed     │
│   each run and strongly instruct “new questions only” — less reliable)│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  D) “I DON’T KNOW” SKIP RULES                                        │
│                                                                     │
│  If user answer contains (case-insensitive):                          │
│    - “don’t know”, “dont know”, “not sure”,                           │
│    - “don’t remember”, “dont remember”                                │
│  Then:                                                               │
│    - do NOT coach; do NOT critique                                   │
│    - immediately generate nextQuestion (AI_THINKING)                 │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  E) SERVER CONTRACT (minimal change, supports AI-asks-first)          │
│                                                                     │
│  Replace “answer-only” with a “turn response” JSON:                  │
│                                                                     │
│  POST /api/qa/live                                                   │
│  Request:                                                           │
│   {                                                                 │
│     sessionId: string,                                               │
│     mode: "FIRST_QUESTION" | "NEXT_TURN",                             │
│     askedQuestions: string[],                                        │
│     lastQuestion?: string,                                           │
│     presenterAnswer?: string,                                        │
│     history?: { role, text }[]                                       │
│   }                                                                 │
│                                                                     │
│  Response:                                                          │
│   {                                                                 │
│     question: string,                                                │
│     feedback?: string                                                │
│   }                                                                 │
│                                                                     │
│  Notes:                                                             │
│   - FIRST_QUESTION ignores presenterAnswer                            │
│   - NEXT_TURN returns feedback + next question                        │
│   - You keep Gemini + PDF grounding exactly as today                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  F) PROMPT BLUEPRINT (Gemini)                                        │
│                                                                     │
│  System intent: “You are a curious audience member.”                 │
│                                                                     │
│  Rules:                                                             │
│   - Ask broad questions, then drill down based on answer             │
│   - Questions must be grounded in the PDF topics                      │
│   - NEVER repeat askedQuestions (hard constraint)                     │
│   - Keep spoken text short: 1–2 sentences                             │
│   - For NEXT_TURN: return short feedback first (1 sentence),          │
│     then provide next question                                       │
│   - If transcript seems unclear: ask a confirmation question instead │
│     of continuing (e.g., “Did you mean X?”)                          │
│                                                                     │
│  Return strict JSON:                                                 │
│   { "feedback": "...", "question": "..." }                            │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  G) CLIENT FILE CHANGES (exactly what we will edit)                  │
│                                                                     │
│  1) src/hooks/useSpeech.ts                                           │
│     - Add onResultRef (fix stale closure)                            │
│     - Switch to per-turn buffers: finalText + interimText            │
│     - Implement turn isolation (Soft Reset by base index)            │
│     - Expose: beginTurn(), getTurnFinalText()                         │
│     - onResult payload: { finalText, interimText, combinedText }      │
│                                                                     │
│  2) src/hooks/useLiveQA.ts                                           │
│     - Replace states: IDLE / AI_THINKING / AI_SPEAKING / USER_ANSWERING / DONE │
│     - On start(): fetch FIRST_QUESTION → speak → beginTurn() → listen │
│     - On silence/maxTime: submit presenterAnswer via NEXT_TURN        │
│     - Enforce maxQuestions=5 (count questions asked)                  │
│     - Implement skip rule (“don’t know”)                              │
│     - Barge-in: pause audio only; keep current AI text; then listen   │
│                                                                     │
│  3) src/components/qa/LiveQAPanel.tsx                                │
│     - Show “Question # / 5”                                          │
│     - Show AI Question text (always visible)                          │
│     - Show Captions: Final (stable) + Interim (live)                  │
│     - Add timer indicator: elapsed / remaining for 5 min              │
│                                                                     │
│  4) app/api/qa/live/route.ts + services/gemini.ts                     │
│     - Support mode FIRST_QUESTION / NEXT_TURN                          │
│     - Return {question, feedback} JSON                                │
│     - Include askedQuestions in prompt                                │
│                                                                     │
│  5) app/api/voice/route.ts (no major change)                          │
│     - But client will call it twice per turn (feedback, question)     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  ✅ CHECKPOINT (confirm Blueprint)                                   │
│                                                                     │
│  Please confirm:                                                     │
│   [ ] Use Soft Reset (turnBaseIndex) instead of abort/start per turn │
│   [ ] AI asks first (FIRST_QUESTION on start)                         │
│   [ ] Each turn: (feedback) then next question (both spoken)          │
│   [ ] Barge-in pauses audio only, keeps AI text visible               │
│   [ ] maxQuestions=5 enforced by “questions asked” count              │
│   [ ] Attempt 2: use Mongo (pdfHash) to avoid last run’s questions    │
│                                                                     │
│  After confirmation, I’ll produce STEP 4: CONTRACT (scope lock) and  │
│  then the exact code edits (CODER PACK) for your files.              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
