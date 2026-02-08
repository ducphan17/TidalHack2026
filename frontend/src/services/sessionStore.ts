import type { PresentationReport, QAQuestion } from "./gemini";

export interface Session {
  pdfBase64: string;
  qaQuestions: QAQuestion[];
  report: PresentationReport;
}

const sessions = new Map<string, Session>();

export function saveSession(
  sessionId: string,
  data: Session
): void {
  sessions.set(sessionId, data);
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}
