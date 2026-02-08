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

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Only send PDF on first question to avoid slow re-uploads every turn
    const result = await conversationalQA({
      mode,
      askedQuestions: askedQuestions ?? [],
      lastQuestion,
      presenterAnswer,
      history: history ?? [],
      pdfBase64: mode === "FIRST_QUESTION" ? session.pdfBase64 : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Live QA error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Live QA failed" },
      { status: 500 }
    );
  }
}
