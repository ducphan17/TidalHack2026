import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.STT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "STT_API_KEY not configured" },
        { status: 500 }
      );
    }

    // Generate temporary token for browser WebSocket connection
    const response = await fetch(
      "https://api.assemblyai.com/v2/realtime/token",
      {
        method: "POST",
        headers: {
          authorization: apiKey,
        },
        body: JSON.stringify({ expires_in: 3600 }), // 1 hour
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get temporary token from AssemblyAI");
    }

    const data = await response.json();
    return NextResponse.json({
      token: data.token,
      expiresIn: data.expires_in,
    });
  } catch (err) {
    console.error("Token generation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate token",
      },
      { status: 500 }
    );
  }
}
