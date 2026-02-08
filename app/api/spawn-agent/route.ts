import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.AGENT_WORKER_URL;

export async function POST(req: NextRequest) {
  try {
    if (!WORKER_URL) {
      return NextResponse.json(
        { error: "AGENT_WORKER_URL not set" },
        { status: 500 },
      );
    }

    const { roomName, data } = await req.json();
    if (!roomName) {
      return NextResponse.json({ error: "roomName required" }, { status: 400 });
    }

    // LiveKit Agents jobs endpoint (worker provided by cli.run_app)
    const res = await fetch(`${WORKER_URL}/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        room: roomName,
        // Optional: pass initial payload to your worker (topic, side, etc.)
        data: data ?? {},
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Worker error: ${res.status} ${text}`);
    }

    const jobInfo = await res.json();
    return NextResponse.json({ ok: true, job: jobInfo });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
