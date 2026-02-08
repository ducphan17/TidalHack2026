import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

function extractTextFromSlideXml(xml: string): string[] {
  const texts: string[] = [];
  const matchAll = xml.matchAll(/<a:t>([^<]*)<\/a:t>/g);
  for (const m of matchAll) {
    if (m[1]) texts.push(m[1]);
  }
  return texts;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name.toLowerCase().endsWith(".pptx")) {
      return NextResponse.json(
        { error: "Please upload a PPTX file" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
        const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
        return numA - numB;
      });

    const slidesText: string[] = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = zip.files[slideFiles[i]];
      const xml = await slideFile.async("string");
      const texts = extractTextFromSlideXml(xml);
      slidesText.push(`Slide ${i + 1}:\n${texts.join(" ")}`);
    }

    const fullText = slidesText.join("\n\n");

    return NextResponse.json({
      slides: fullText,
      slideCount: slideFiles.length,
    });
  } catch (err) {
    console.error("Parse slides error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse slides" },
      { status: 500 }
    );
  }
}
