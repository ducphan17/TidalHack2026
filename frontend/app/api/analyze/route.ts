import { NextRequest, NextResponse } from "next/server";
import { analyzePresentation } from "@/services/gemini";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const transcript = formData.get("transcript") as string | null;
    const slideContent = (formData.get("slideContent") as string | null) ?? "";

    if (!transcript) {
      return NextResponse.json(
        { error: "Missing transcript" },
        { status: 400 }
      );
    }

    const feedback = await analyzePresentation(transcript, slideContent);
    return NextResponse.json(feedback);
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
