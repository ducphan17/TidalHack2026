import { NextRequest, NextResponse } from "next/server";
import { searchChunks } from "@/services/pdfChunks";

export async function POST(request: NextRequest) {
  try {
    const { pdfHash, query } = await request.json();

    if (!pdfHash || !query) {
      return NextResponse.json(
        { error: "Missing pdfHash or query" },
        { status: 400 }
      );
    }

    const chunks = await searchChunks(pdfHash, query);
    return NextResponse.json({ chunks });
  } catch (err) {
    console.error("PDF search error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}
