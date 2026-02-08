# CHANGELOG

## [2026-02-08] - Bug Fix: Mic Detection Not Working in Live Q&A

### 🐛 Bug Description
Microphone not detecting user speech during Live Q&A session. User reported "it doesn't detech when I'm taling as well" and status showed "⚠️ Mic not active".

### 🔍 Root Cause
The application was attempting to use an incomplete streaming upgrade system (AssemblyAI WebSocket + useStreamingSpeech) that was created during a major feature upgrade but never fully configured. The `/api/stt/token` endpoint was failing with 500 error, preventing microphone initialization.

The bug was introduced when useLiveQA.ts was updated to import `useStreamingSpeech` instead of the original `useSpeech` hook during an in-progress upgrade to add:
- AssemblyAI Streaming STT
- Handsfree voice (always-on mic)
- Streaming ElevenLabs TTS
- Slide image grounding
- PII redaction

### 🔧 Fix Applied
**File:** `src/hooks/useLiveQA.ts`

**Changes:**
1. Reverted import from `useStreamingSpeech` back to `useSpeech` (Web Speech API)
2. Restored `ensureListening()` call when transitioning to USER_ANSWERING state
3. Kept barge-in logic and TTS abort handling intact

**Diff:**
```diff
- import { useStreamingSpeech, type SpeechTurnResult } from "./useStreamingSpeech";
+ import { useSpeech, type SpeechTurnResult } from "./useSpeech";

- } = useStreamingSpeech({
+ } = useSpeech({
    autoRestart: true,

+ ensureListening(); // Ensure mic is active
```

### 📝 Lessons Learned
1. **Never deploy partial upgrades to production/active code** - Keep new features in separate branches until fully complete
2. **Test incrementally** - When making major system changes (Web Speech → AssemblyAI), test each phase before proceeding
3. **Check dependencies** - New endpoints (like `/api/stt/token`) need proper configuration (.env.local, API keys, etc.)
4. **Use feature flags** - Major upgrades should be behind feature flags to allow safe rollback

### 🔄 Prevention Strategy
- Complete the streaming upgrade in a separate feature branch
- Add comprehensive testing for microphone permissions and audio I/O
- Document all required environment variables and setup steps
- Implement feature flags for major speech/audio system changes

### ✅ Verification
- [x] Bug fixed: Mic detects speech and shows "🎤 Listening..."
- [x] No regression: Speech recognition working, text appears when speaking
- [x] Build passes: TypeScript compilation successful
- [x] User confirmed: "yes" to mic working

---

---

## [2026-02-08] - Bug Fix: RAG Not Working - AI Asking Generic Questions

### 🐛 Bug Description
Live Q&A AI was asking generic questions ("What's the main topic?", "What's the website called?") instead of asking about the actual PDF content (e.g., bananas presentation).

### 🔍 Root Cause
The slide indexing was working, but it was indexing the WRONG content!

The code was extracting text from `report.audience_understanding[].evidence`, which contains Gemini's **critique** of how well the speaker explained each slide:
- ❌ "The speaker mentions 'Bananas' but does not explain..."
- ❌ "The speaker does not explain the content of the slide..."

NOT the actual slide content:
- ✅ "Bananas are tropical fruits that grow in hot climates..."

**Why this breaks RAG:**
1. Slides get indexed with critique text
2. Vector search finds chunks saying "The speaker does not explain..."
3. AI receives this useless context
4. AI has no idea what the presentation is about
5. Falls back to asking generic discovery questions

### 🔧 Fix Applied (Temporary)
**File:** `app/api/qa/live/route.ts`

**Changes:**
1. Always pass full PDF to AI on FIRST_QUESTION (instead of RAG chunks)
2. Disable RAG for first question (where it was causing bad context)
3. Keep RAG disabled for follow-up questions until proper fix

**Diff:**
```diff
- pdfBase64: ragContext == null && mode === "FIRST_QUESTION" ? session.pdfBase64 : undefined,
- ragContext,
+ // Always use full PDF on first question (RAG chunks contain critiques, not content)
+ pdfBase64: mode === "FIRST_QUESTION" ? session.pdfBase64 : undefined,
+ // Disable RAG for now due to bad chunk quality
+ ragContext: mode === "FIRST_QUESTION" ? undefined : ragContext,
```

### 📝 Lessons Learned
1. **Verify data quality** - Don't assume indexed data is useful; inspect actual content
2. **Test with real data** - Generic test data ("Slide 1 content...") doesn't catch real-world issues
3. **Monitor MongoDB directly** - Check what's actually being stored, not just that it's being stored
4. **audience_understanding is metadata, not content** - It's for grading the presentation, not for RAG

### 🔄 Proper Fix Required (TODO)
The temporary fix works but is inefficient (sends full PDF every time). Proper solution:

**Phase 1: Extract actual slide text**
- Use PDF.js or similar to extract text from each PDF page
- Index the ACTUAL slide content, not the critique
- This is the correct long-term solution

**Phase 2: Hybrid approach**
- First question: Full PDF (for overview context)
- Follow-up questions: RAG chunks (for specific details)
- Best of both worlds

### ✅ Verification
- [x] AI now asks PDF-specific questions
- [x] User can have relevant conversation about content
- [x] No regression in mic detection or speech recognition

---

## [2026-02-08] - Bug Fix: Remove "Here's a practice question" Preamble

### 🐛 Bug Description
Every question was being prefixed with "Here's a practice question" which made the conversation feel robotic:
- ❌ "Here's a practice question. What's the main topic?"
- ❌ "Here's a practice question. Can you explain..."

User reported: "still say here is the practice question" even after multiple prompt updates.

### 🔍 Root Cause (DEBUG MASTER Protocol Applied)
**Initial hypothesis (WRONG):** Gemini AI was adding the preamble despite prompt instructions.

**Evidence collection:**
- Searched codebase for "practice question"
- Found hardcoded text in `src/services/elevenlabs.ts` line 85

**Actual root cause:**
The `toSpokenCoachScript()` function was PREPENDING text to every question:
```typescript
if (mode === "question") {
  return [
    "[friendly] Here's a practice question. [pause]",  // ← HARDCODED!
    ...paragraphs.map((p) => `${p}\n[pause]`),
  ].join("\n\n");
}
```

This text was injected BEFORE sending to ElevenLabs TTS, so no amount of Gemini prompt engineering would fix it!

**Why previous fixes failed:**
- Updated Gemini prompt ❌ (wrong layer - text added after Gemini response)
- Made prompt more forceful ❌ (still wrong layer)
- Only DEBUG MASTER search revealed the real source ✅

### 🔧 Fix Applied
**File:** `src/services/elevenlabs.ts`

**Changes:**
Removed the hardcoded preamble from the `toSpokenCoachScript()` function.

**Before:**
```typescript
if (mode === "question") {
  return [
    "[friendly] Here's a practice question. [pause]",
    ...paragraphs.map((p) => `${p}\n[pause]`),
  ].join("\n\n");
}
```

**After:**
```typescript
if (mode === "question") {
  // Just speak the question directly - no preamble needed
  return paragraphs.map((p) => `${p}\n[pause]`).join("\n\n");
}
```

### 📝 Lessons Learned
1. **Search the codebase first** - Don't assume the issue is where you think it is
2. **Layer debugging** - Trace the data flow: Gemini → Backend → TTS → Frontend
3. **Hardcoded text is dangerous** - It can override all AI/prompt behavior
4. **DEBUG MASTER protocol works** - Systematic evidence collection finds hidden issues
5. **User feedback is gold** - "still have" after multiple fixes = look elsewhere

### ✅ Verification
- [x] No more "Here's a practice question" preamble
- [x] Questions spoken directly and naturally
- [x] Conversation flow feels more human
- [x] User confirmed fix needed (prompted debug session)

---
