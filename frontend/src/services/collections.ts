import { type Collection } from "mongodb";
import { getDb } from "./db";
import type { PresentationReport, QAQuestion } from "./gemini";

/* ---------- Document types ---------- */

export interface SessionDoc {
  sessionId: string;
  pdfBase64: string;
  qaQuestions: QAQuestion[];
  report: PresentationReport;
  createdAt: Date;
  expiresAt: Date;
}

export interface HistoryDoc {
  userId: string;
  score: number;
  attempt: number;
  timestamp: Date;
  [key: string]: unknown;
}

export interface QaTurnDoc {
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  questionNumber: number;
  createdAt: Date;
}

export interface PdfChunkDoc {
  pdfHash: string;
  slide: number;
  text: string;
  embedding: number[];
  createdAt: Date;
}

export interface SlideImageDoc {
  sessionId: string;
  slideNumber: number;
  imageBase64: string; // PNG base64
  mimeType: string;
  createdAt: Date;
}

/* ---------- Collection accessors ---------- */

export async function getCollections() {
  const db = await getDb();
  return {
    sessions: db.collection<SessionDoc>("sessions"),
    history: db.collection<HistoryDoc>("history"),
    qaTurns: db.collection<QaTurnDoc>("qa_turns"),
    pdfChunks: db.collection<PdfChunkDoc>("pdf_chunks"),
    slideImages: db.collection<SlideImageDoc>("slide_images"),
  };
}

/* ---------- Ensure indexes (called once on first connection) ---------- */

const indexesCreated = globalThis as unknown as { __indexesReady?: boolean };

export async function ensureIndexes() {
  if (indexesCreated.__indexesReady) return;

  const { sessions, history, qaTurns, pdfChunks, slideImages } = await getCollections();

  await Promise.all([
    sessions.createIndex({ sessionId: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    history.createIndex({ userId: 1, timestamp: -1 }),
    qaTurns.createIndex({ sessionId: 1, createdAt: 1 }),
    pdfChunks.createIndex({ pdfHash: 1, slide: 1 }),
    slideImages.createIndex({ sessionId: 1, slideNumber: 1 }, { unique: true }),
  ]);

  indexesCreated.__indexesReady = true;
}
