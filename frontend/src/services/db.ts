import type { AnalysisFeedback } from "./gemini";

export interface PresentationRecord {
  id?: string;
  userId?: string;
  timestamp: string;
  score: number;
  feedback: AnalysisFeedback;
  transcriptLength?: number;
}

const MONGODB_URI = process.env.MONGODB_URI;

export async function savePresentation(
  record: Omit<PresentationRecord, "id" | "timestamp">
): Promise<PresentationRecord> {
  if (!MONGODB_URI) {
    // Dev fallback: return in-memory style record
    return {
      ...record,
      timestamp: new Date().toISOString(),
    };
  }

  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    throw new Error(`Failed to save: ${res.status}`);
  }

  return res.json();
}

export async function getPresentationHistory(
  userId?: string
): Promise<PresentationRecord[]> {
  if (!MONGODB_URI) {
    return [];
  }

  const url = userId ? `/api/history?userId=${userId}` : "/api/history";
  const res = await fetch(url);

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
