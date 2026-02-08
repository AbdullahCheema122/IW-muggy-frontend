import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

/**
 * Body:
 * {
 *   userId: string,
 *   topic: string,
 *   side: "pro" | "con",
 *   round1Score?: number,
 *   round2Score?: number,
 *   rubric?: { dataEvidence: number, logic: number, org: number, refutation: number, style: number },
 *   quotes?: string[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.userId || !body?.topic || !body?.side) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    await addDoc(collection(db, "debates"), {
      ...body,
      createdAt: serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
