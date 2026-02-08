import { NextRequest } from "next/server";
import { getCollections } from "@/services/collections";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return new Response("Missing sessionId", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const { qaTurns } = await getCollections();

      const changeStream = qaTurns.watch(
        [{ $match: { "fullDocument.sessionId": sessionId } }],
        { fullDocument: "updateLookup" }
      );

      const cleanup = () => {
        changeStream.close().catch(() => {});
      };

      request.signal.addEventListener("abort", cleanup);

      try {
        for await (const change of changeStream) {
          if (change.operationType === "insert" && change.fullDocument) {
            const doc = change.fullDocument;
            const event = `data: ${JSON.stringify({
              role: doc.role,
              text: doc.text,
              questionNumber: doc.questionNumber,
              createdAt: doc.createdAt,
            })}\n\n`;
            controller.enqueue(encoder.encode(event));
          }
        }
      } catch {
        // Stream closed or aborted
      } finally {
        cleanup();
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
