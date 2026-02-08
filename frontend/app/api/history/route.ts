import { NextRequest, NextResponse } from "next/server";

// In-memory fallback when MONGODB_URI is not set
const memoryStore: Record<string, unknown[]> = {};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") ?? "default";

    if (!process.env.MONGODB_URI) {
      const records = memoryStore[userId] ?? [];
      return NextResponse.json(records);
    }

    // TODO: Connect to MongoDB Atlas and fetch user's history
    return NextResponse.json(memoryStore[userId] ?? []);
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
    const body = await request.json();
    const userId = (body.userId as string) ?? "default";

    const record = {
      id: crypto.randomUUID(),
      userId,
      timestamp: new Date().toISOString(),
      ...body,
    };

    if (!process.env.MONGODB_URI) {
      const list = (memoryStore[userId] ?? []) as unknown[];
      list.unshift(record);
      memoryStore[userId] = list;
      return NextResponse.json(record);
    }

    // TODO: Save to MongoDB Atlas
    return NextResponse.json(record);
  } catch (err) {
    console.error("History POST error:", err);
    return NextResponse.json(
      { error: "Failed to save record" },
      { status: 500 }
    );
  }
}
