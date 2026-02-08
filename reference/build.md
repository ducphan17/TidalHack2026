┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: BUILD                                                      │
│  Owner: Builder (AI)                                                │
│  Goal: Implement exactly according to the Blueprint                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Architect generates CODER PACK → Homeowner pastes into Builder      │
│                                                                     │
│  Builder: "Got the CODER PACK. Where should I apply changes?"        │
│                                                                     │
│  Homeowner: "In my existing Next.js project (same repo)."           │
│                                                                     │
│  Builder:                                                           │
│  "Building...                                                       │
│   ✅ Fix Web Speech accumulation + stale callback                     │
│   ✅ Stable captions: Final vs Interim                                │
│   ✅ New state machine: AI asks first                                 │
│   ✅ Enforce maxQuestions=5 + maxAnswerTime=5 min                      │
│   ✅ 'don't know/remember' → skip                                     │
│   ✅ Question uniqueness (in-session + attempt 2 via Mongo)           │
│                                                                     │
│   Done! Run:                                                         │
│   npm run dev                                                        │
│   Open http://localhost:3000                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
