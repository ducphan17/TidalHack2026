import { NextRequest, NextResponse } from "next/server";
import { gradeLiveAnswers } from "@/services/gemini";
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
    const { sessionId, qaPairs } = JSON.parse(body);

    if (!sessionId || !qaPairs || !Array.isArray(qaPairs)) {
      return NextResponse.json(
        { error: "Missing sessionId or qaPairs" },
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

    const grades = await gradeLiveAnswers(qaPairs, session.pdfBase64);

    return NextResponse.json({ grades });
  } catch (err) {
    console.error("Grade live answers error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to grade answers" },
      { status: 500 }
    );
  }
}
