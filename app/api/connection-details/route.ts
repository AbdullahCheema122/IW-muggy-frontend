// app/api/connection-details/route.ts
import { NextResponse } from "next/server";
import {
  AccessToken,
  type AccessTokenOptions,
  type VideoGrant,
} from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

export async function POST(req: Request) {
  try {
    ensureEnv();
    const { participantName } = await req.json();
    const name = (participantName && String(participantName).trim()) || "Guest";
    const payload = await buildDetails(name);
    return NextResponse.json(payload, noStore());
  } catch (err: any) {
    console.error(err);
    return new NextResponse(err?.message || "error", { status: 500 });
  }
}

export async function GET() {
  try {
    ensureEnv();
    const payload = await buildDetails("user");
    return NextResponse.json(payload, noStore());
  } catch (err: any) {
    console.error(err);
    return new NextResponse(err?.message || "error", { status: 500 });
  }
}

function ensureEnv() {
  if (!LIVEKIT_URL) throw new Error("LIVEKIT_URL is not defined");
  if (!API_KEY) throw new Error("LIVEKIT_API_KEY is not defined");
  if (!API_SECRET) throw new Error("LIVEKIT_API_SECRET is not defined");
}

async function buildDetails(
  participantName: string,
): Promise<ConnectionDetails> {
  const identity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
  const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
  const participantToken = await createParticipantToken(
    { identity, name: participantName },
    roomName,
  );
  return {
    serverUrl: LIVEKIT_URL!,
    roomName,
    participantToken,
    participantName,
  };
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
) {
  const at = new AccessToken(API_KEY!, API_SECRET!, {
    ...userInfo,
    ttl: "15m",
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}

function noStore() {
  return { headers: new Headers({ "Cache-Control": "no-store" }) };
}
