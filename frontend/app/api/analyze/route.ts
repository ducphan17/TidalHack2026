import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio, computeMetrics } from "@/services/stt";
import { judgePresentation } from "@/services/gemini";
import { saveSession } from "@/services/sessionStore";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const audioFile = formData.get("audio_file") as File | null;
    const pdfBase64 = (formData.get("slides_pdf_base64") as string) ?? "";
    const qaOptIn = formData.get("qa_opt_in") === "true";
    const qaCount = parseInt(formData.get("qa_count") as string) || 3;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Missing audio_file" },
        { status: 400 }
      );
    }

    // 1. Transcribe audio via AssemblyAI
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const { transcript, words } = await transcribeAudio(audioBuffer);

    if (!transcript) {
      return NextResponse.json(
        { error: "No speech detected in audio" },
        { status: 400 }
      );
    }

    // 2. Compute metrics
    const durationMs =
      words.length > 0 ? words[words.length - 1].end - words[0].start : 0;
    const { metrics, unclear_terms } = computeMetrics(words, durationMs);

    // 3. Judge presentation via Gemini
    const result = await judgePresentation(
      transcript,
      metrics,
      unclear_terms,
      pdfBase64,
      qaOptIn,
      qaCount
    );

    // 4. Store session
    const sessionId = randomUUID();
    saveSession(sessionId, {
      pdfBase64,
      qaQuestions: result.qa_pack?.questions ?? [],
      report: result.presentation_report,
    });

    // 5. Return result
    return NextResponse.json({
      sessionId,
      transcript,
      presentation_report: result.presentation_report,
      qa_pack: result.qa_pack ?? null,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
