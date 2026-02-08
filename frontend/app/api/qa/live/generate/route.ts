import { NextRequest, NextResponse } from "next/server";
import { generateLiveQuestions } from "@/services/gemini";
import { getSession } from "@/services/sessionStore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    if (!body) {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }
    const { sessionId, count } = JSON.parse(body);

    if (!sessionId || !count) {
      return NextResponse.json(
        { error: "Missing sessionId or count" },
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

    const questions = await generateLiveQuestions(session.pdfBase64, count);

    return NextResponse.json({ questions });
  } catch (err) {
    console.error("Generate live questions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate questions" },
      { status: 500 }
    );
  }
}
