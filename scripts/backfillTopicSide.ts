// backfill-sides.ts
import admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

function inferSide(text: string | undefined | null): "pro" | "con" | null {
  const t = (text || "").toLowerCase();
  if (!t) return null;
  if (/you(?:'|’)?re\s+taking\s+the\s+pro\s+side/.test(t)) return "pro";
  if (/you(?:'|’)?re\s+taking\s+the\s+con\s+side/.test(t)) return "con";
  if (/\bpro\s+opening\b/.test(t)) return "pro";
  if (/\bcon\s+opening\b/.test(t)) return "con";
  if (/\baffirm(ative)?\b/.test(t)) return "pro";
  if (/\bnegate|negative\b/.test(t)) return "con";
  return null;
}

async function run() {
  const snap = await db.collection("debates").get();
  let updated = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const existing =
      (d.side ?? d.sideId ?? d.user_side ?? d.userSide ?? d.position ?? d.stance ?? d.affNeg) as
        | string
        | undefined;

    // skip rows that already have a recognizable side
    if (typeof existing === "string" && /^(pro|con|aff|neg)/i.test(existing)) continue;

    const side =
      inferSide(d.judgeNotes || d.judge_notes || d.judgeFeedback || d.feedback || d.feedbackRaw) ||
      null;

    if (side) {
      await doc.ref.update({ side });
      updated++;
    }
  }

  console.log(`Backfill complete. Updated ${updated} debates.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
