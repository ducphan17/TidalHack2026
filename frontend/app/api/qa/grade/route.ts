import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/services/stt";
import { judgeQAAnswer } from "@/services/gemini";
import { getSession } from "@/services/sessionStore";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const sessionId = formData.get("sessionId") as string | null;
    const questionId = formData.get("questionId") as string | null;
    const answerAudio = formData.get("answer_audio") as File | null;

    if (!sessionId || !questionId || !answerAudio) {
      return NextResponse.json(
        { error: "Missing sessionId, questionId, or answer_audio" },
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

    const question = session.qaQuestions.find((q) => q.id === questionId);
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // 1. Transcribe answer audio
    const audioBuffer = Buffer.from(await answerAudio.arrayBuffer());
    const { transcript } = await transcribeAudio(audioBuffer);

    // 2. Judge answer
    const qaFeedback = await judgeQAAnswer(
      question.question,
      question.slide_ref,
      transcript || "(No speech detected)",
      session.pdfBase64
    );

    // 3. Build coach text for TTS
    const coachText = `Your score is ${qaFeedback.score} out of 10. ${qaFeedback.feedback}`;

    return NextResponse.json({
      qa_feedback: qaFeedback,
      coach_text: coachText,
    });
  } catch (err) {
    console.error("QA grade error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grading failed" },
      { status: 500 }
    );
  }
}
