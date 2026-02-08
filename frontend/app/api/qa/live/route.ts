import { NextRequest, NextResponse } from "next/server";
import { conversationalQA } from "@/services/gemini";
import { getSession } from "@/services/sessionStore";

export async function POST(request: NextRequest) {
  try {
    const { sessionId, utterance, history } = await request.json();

    if (!sessionId || !utterance) {
      return NextResponse.json(
        { error: "Missing sessionId or utterance" },
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

    const result = await conversationalQA(
      utterance,
      history ?? [],
      session.pdfBase64
    );

    return NextResponse.json({ answer: result.answer });
  } catch (err) {
    console.error("Live QA error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Live QA failed" },
      { status: 500 }
    );
  }
}
