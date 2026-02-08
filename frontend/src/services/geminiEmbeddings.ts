import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function embedTexts(
  texts: string[],
  dims = 768
): Promise<number[][]> {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts.map((t) => ({ role: "user", parts: [{ text: t }] })),
    config: { outputDimensionality: dims },
  });

  return (result.embeddings ?? []).map((e) => e.values ?? []);
}
