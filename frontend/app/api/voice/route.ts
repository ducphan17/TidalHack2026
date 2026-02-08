import { NextRequest, NextResponse } from "next/server";
import { generateVoiceFeedback } from "@/services/elevenlabs";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      );
    }

    const blob = await generateVoiceFeedback(text);

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err) {
    console.error("Voice error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Voice generation failed" },
      { status: 500 }
    );
  }
}
