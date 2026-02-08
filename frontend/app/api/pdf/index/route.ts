import { NextRequest, NextResponse } from "next/server";
import { indexPdfSlides } from "@/services/pdfChunks";

export async function POST(request: NextRequest) {
  try {
    const { pdfHash, slides } = await request.json();

    if (!pdfHash || !Array.isArray(slides)) {
      return NextResponse.json(
        { error: "Missing pdfHash or slides array" },
        { status: 400 }
      );
    }

    await indexPdfSlides(pdfHash, slides);
    return NextResponse.json({ ok: true, indexed: slides.length });
  } catch (err) {
    console.error("PDF index error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Indexing failed" },
      { status: 500 }
    );
  }
}
