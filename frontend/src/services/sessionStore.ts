import type { PresentationReport, QAQuestion } from "./gemini";
import { getCollections, ensureIndexes } from "./collections";

export interface Session {
  pdfBase64: string;
  qaQuestions: QAQuestion[];
  report: PresentationReport;
}

export async function saveSession(
  sessionId: string,
  data: Session
): Promise<void> {
  await ensureIndexes();
  const { sessions } = await getCollections();
  const now = new Date();
  await sessions.insertOne({
    sessionId,
    ...data,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24h TTL
  });
}

export async function getSession(
  sessionId: string
): Promise<Session | null> {
  const { sessions } = await getCollections();
  const doc = await sessions.findOne({ sessionId });
  if (!doc) return null;
  return {
    pdfBase64: doc.pdfBase64,
    qaQuestions: doc.qaQuestions,
    report: doc.report,
  };
}
