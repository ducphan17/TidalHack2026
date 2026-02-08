import { NextRequest, NextResponse } from "next/server";
import { conversationalQA } from "@/services/gemini";
import { getSession } from "@/services/sessionStore";

export async function POST(request: NextRequest) {
  try {
    const {
      sessionId,
      mode,
      askedQuestions,
      lastQuestion,
      presenterAnswer,
      history,
    } = await request.json();

    if (!sessionId || !mode) {
      return NextResponse.json(
        { error: "Missing sessionId or mode" },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Use RAG context instead of full PDF for speed
    let ragContext: string | undefined;
    const questionText =
      mode === "FIRST_QUESTION"
        ? "presentation overview"
        : presenterAnswer ?? lastQuestion ?? "";
    try {
      console.log(`[Live QA] Searching chunks for session: ${sessionId}`);
      const { searchChunks } = await import("@/services/pdfChunks");
      // Use sessionId as pdfHash key (indexed at analyze time)
      const chunks = await searchChunks(sessionId, questionText, 5);
      console.log(`[Live QA] Found ${chunks.length} relevant chunks`);
      if (chunks.length > 0) {
        ragContext = chunks
          .map((c) => `[Slide ${c.slide}] ${c.text}`)
          .join("\n\n");
        console.log(`[Live QA] Using RAG context (${ragContext.length} chars)`);
      } else {
        console.log(`[Live QA] No chunks found, will use full PDF`);
      }
    } catch (err) {
      console.error(`[Live QA] Vector search failed:`, err);
      // Vector search not available — fall back to full PDF on first question
    }

    const result = await conversationalQA({
      mode,
      askedQuestions: askedQuestions ?? [],
      lastQuestion,
      presenterAnswer,
      history: history ?? [],
      // Always use full PDF on first question for now (RAG chunks contain critiques, not content)
      pdfBase64: mode === "FIRST_QUESTION" ? session.pdfBase64 : undefined,
      // Only use RAG for follow-up questions (disabled for now due to bad chunk quality)
      ragContext: mode === "FIRST_QUESTION" ? undefined : ragContext,
    });

    // Store Q&A turns in MongoDB
    const { getCollections } = await import("@/services/collections");
    const { qaTurns } = await getCollections();
    const questionNumber = (askedQuestions?.length ?? 0) + 1;
    const turns = [];
    if (presenterAnswer) {
      turns.push({
        sessionId,
        role: "user" as const,
        text: presenterAnswer,
        questionNumber: questionNumber - 1,
        createdAt: new Date(),
      });
    }
    turns.push({
      sessionId,
      role: "assistant" as const,
      text: result.question ?? result.feedback ?? "",
      questionNumber,
      createdAt: new Date(),
    });
    if (turns.length > 0) {
      await qaTurns.insertMany(turns);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Live QA error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Live QA failed" },
      { status: 500 }
    );
  }
}
