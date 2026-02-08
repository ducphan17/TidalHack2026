import { getCollections } from "./collections";
import { embedTexts } from "./geminiEmbeddings";

export async function indexPdfSlides(
  pdfHash: string,
  slides: { slide: number; text: string }[]
): Promise<void> {
  const { pdfChunks } = await getCollections();

  // Skip if already indexed
  const existing = await pdfChunks.countDocuments({ pdfHash });
  if (existing > 0) return;

  const texts = slides.map((s) => s.text);
  const embeddings = await embedTexts(texts);

  const docs = slides.map((s, i) => ({
    pdfHash,
    slide: s.slide,
    text: s.text,
    embedding: embeddings[i],
    createdAt: new Date(),
  }));

  if (docs.length > 0) {
    await pdfChunks.insertMany(docs);
  }
}

export async function searchChunks(
  pdfHash: string,
  query: string,
  limit = 5
): Promise<{ slide: number; text: string; score: number }[]> {
  const { pdfChunks } = await getCollections();

  const [queryVec] = await embedTexts([query]);

  const results = await pdfChunks
    .aggregate<{ slide: number; text: string; score: number }>([
      {
        $vectorSearch: {
          index: "pdf_chunks_vec",
          path: "embedding",
          queryVector: queryVec,
          numCandidates: limit * 10,
          limit,
          filter: { pdfHash },
        },
      },
      {
        $project: {
          _id: 0,
          slide: 1,
          text: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ])
    .toArray();

  return results;
}
