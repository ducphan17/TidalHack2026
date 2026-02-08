import { NextRequest } from "next/server";
import { transcribeAudio, computeMetrics } from "@/services/stt";
import { judgePresentation } from "@/services/gemini";
import { saveSession } from "@/services/sessionStore";
import { randomUUID } from "crypto";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  function sendEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify(data)}\n\n`;
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();

        const audioFile = formData.get("audio_file") as File | null;
        const pdfBase64 = (formData.get("slides_pdf_base64") as string) ?? "";
        const slideCount =
          parseInt(formData.get("slide_count") as string) || 0;
        const qaOptIn = formData.get("qa_opt_in") === "true";
        const qaCount = parseInt(formData.get("qa_count") as string) || 3;

        if (!audioFile) {
          controller.enqueue(
            encoder.encode(
              sendEvent({ step: "error", message: "Missing audio_file" })
            )
          );
          controller.close();
          return;
        }

        // 1. Transcribe audio via AssemblyAI
        controller.enqueue(
          encoder.encode(
            sendEvent({ step: "transcribing", message: "Transcribing audio..." })
          )
        );

        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        const { transcript, words } = await transcribeAudio(audioBuffer);

        if (!transcript) {
          controller.enqueue(
            encoder.encode(
              sendEvent({
                step: "error",
                message:
                  "No speech detected in audio. Make sure your microphone is working and try speaking clearly.",
              })
            )
          );
          controller.close();
          return;
        }

        // 2. Compute metrics
        controller.enqueue(
          encoder.encode(
            sendEvent({
              step: "computing",
              message: "Computing speech metrics...",
            })
          )
        );

        const durationMs =
          words.length > 0 ? words[words.length - 1].end - words[0].start : 0;
        const { metrics, unclear_terms } = computeMetrics(words, durationMs);

        // 3. Judge presentation via Gemini
        controller.enqueue(
          encoder.encode(
            sendEvent({
              step: "analyzing",
              message: "Analyzing presentation with AI...",
            })
          )
        );

        console.log(
          "Calling Gemini with qaOptIn:",
          qaOptIn,
          "qaCount:",
          qaCount
        );
        const result = await judgePresentation(
          transcript,
          metrics,
          unclear_terms,
          pdfBase64,
          slideCount,
          qaOptIn,
          qaCount
        );

        console.log("Gemini result keys:", Object.keys(result));
        console.log("qa_pack:", JSON.stringify(result.qa_pack));

        // Enforce: content=0 or relevance failed → overall=0; otherwise use weighted score
        const report = result.presentation_report;
        const b = report.score_breakdown;
        const contentFails =
          b && (b.document_coverage === 0 || b.content_quality === 0);
        if (report.relevance_gate?.passed === false || contentFails) {
          report.score = 0;
        } else if (b) {
          report.score =
            b.document_coverage * 0.25 +
            b.content_quality * 0.3 +
            b.audience_understanding * 0.2 +
            b.speech_alignment * 0.15 +
            b.vocal_delivery * 0.1;
        }

        // 4. Store session
        const sessionId = randomUUID();
        saveSession(sessionId, {
          pdfBase64,
          qaQuestions: result.qa_pack?.questions ?? [],
          report,
        });

        // 5. Send final result
        controller.enqueue(
          encoder.encode(
            sendEvent({
              step: "done",
              data: {
                sessionId,
                transcript,
                presentation_report: report,
                qa_pack: result.qa_pack ?? null,
              },
            })
          )
        );
      } catch (err) {
        console.error("Analyze error:", err);
        controller.enqueue(
          encoder.encode(
            sendEvent({
              step: "error",
              message:
                err instanceof Error ? err.message : "Analysis failed",
            })
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
