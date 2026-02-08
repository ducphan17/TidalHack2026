import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBase64 = Buffer.from(arrayBuffer).toString("base64");

    // Simple page count heuristic: count occurrences of /Type /Page in PDF
    const pdfText = Buffer.from(arrayBuffer).toString("latin1");
    const pageMatches = pdfText.match(/\/Type\s*\/Page(?!s)/g);
    const slideCount = pageMatches ? pageMatches.length : 1;

    return NextResponse.json({ slideCount, pdfBase64 });
  } catch (err) {
    console.error("Slide upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
