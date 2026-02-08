import { NextRequest, NextResponse } from "next/server";
import { getCollections, ensureIndexes } from "@/services/collections";

export async function GET(request: NextRequest) {
  try {
    await ensureIndexes();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? "default";

    const { history } = await getCollections();
    const records = await history
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(records);
  } catch (err) {
    console.error("History GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureIndexes();
    const body = await request.json();
    const userId = (body.userId as string) ?? "default";

    const { history } = await getCollections();

    const attemptCount = await history.countDocuments({ userId });

    const record = {
      userId,
      score: body.score ?? 0,
      attempt: attemptCount + 1,
      timestamp: new Date(),
      ...body,
    };

    await history.insertOne(record);
    return NextResponse.json(record);
  } catch (err) {
    console.error("History POST error:", err);
    return NextResponse.json(
      { error: "Failed to save record" },
      { status: 500 }
    );
  }
}
