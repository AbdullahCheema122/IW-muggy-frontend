// lib/debates.ts
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export type DebateScores = {
  dataEvidence: number; // 0-5
  logic: number;        // 0-5
  organization: number; // 0-5
  refutation: number;   // 0-5
  style: number;        // 0-5
};

export type DebateResultInput = {
  uid: string;                 // current user uid
  displayName?: string | null;
  topic: string;               // the resolved topic you want shown
  userSide: "pro" | "con";     // <-- USER’S CHOICE (required)
  scores: DebateScores;
  total?: number;
  judgeNotes?: string;
  quotes?: string[];

  // optional cross-links
  conversationId?: string | null;
  analysisId?: string | null;
};

function clamp05(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(5, Math.round(x * 10) / 10));
}
function normalizeScores(s: DebateScores): DebateScores {
  return {
    dataEvidence: clamp05(s.dataEvidence),
    logic: clamp05(s.logic),
    organization: clamp05(s.organization),
    refutation: clamp05(s.refutation),
    style: clamp05(s.style),
  };
}
function computeTotal(scores: DebateScores, total?: number) {
  if (typeof total === "number" && Number.isFinite(total) && total >= 0) {
    return Math.round(total * 10) / 10;
  }
  const sum =
    scores.dataEvidence +
    scores.logic +
    scores.organization +
    scores.refutation +
    scores.style;
  return Math.round(sum * 10) / 10; // 0–25
}
function totalToPercent(total25: number) {
  const pct = Math.max(0, Math.min(100, (total25 / 25) * 100));
  return Math.round(pct * 10) / 10;
}

/** Write to root `debates` (your hook reads this) and to `users/{uid}/debates` */
export async function saveDebateResult(input: DebateResultInput) {
  const {
    uid,
    displayName,
    topic,
    userSide,             // <-- TRUST ONLY THIS
    scores: rawScores,
    total: totalIn,
    judgeNotes,
    quotes,
    conversationId = null,
    analysisId = null,
  } = input;

  const scores = normalizeScores(rawScores);
  const total = computeTotal(scores, totalIn);
  const percent = totalToPercent(total);

  const payload = {
    userId: uid,
    userDisplayName: displayName ?? null,

    // canonical topic (already resolved string you pass in)
    topic,
    resolvedTopic: topic,
    resolution: topic,
    resolutionText: `Resolved: ${topic}.`,

    // SAVE USER’S SIDE ONLY
    side: userSide,
    userSide,

    scores,
    total,
    percent,

    judgeNotes: judgeNotes ?? "",
    quotes: Array.isArray(quotes) ? quotes : [],

    conversationId,
    analysisId,

    createdAt: serverTimestamp(),
  };

  // 1) root collection (your dashboard queries this one)
  const debatesRef = collection(db, "debates");
  const rootDoc = await addDoc(debatesRef, payload);

  // 2) mirror to per-user collection (optional)
  const userCol = collection(db, `users/${uid}/debates`);
  await addDoc(userCol, { ...payload, rootId: rootDoc.id });

  // 3) optionally mirror onto conversation doc
  if (conversationId) {
    const convRef = doc(db, "conversations", conversationId);
    await setDoc(
      convRef,
      {
        topic,
        resolvedTopic: topic,
        resolution: topic,
        resolutionText: `Resolved: ${topic}.`,
        userSide,   // <-- write user's side here too
        side: userSide,
        lastDebateRef: rootDoc.path,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return { id: rootDoc.id, ...payload };
}
