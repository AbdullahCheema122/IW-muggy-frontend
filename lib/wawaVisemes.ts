// lib/wawaVisemes.ts
// Do NOT put "use client" here. Keep this safe on the server.
// We only export data + a lazy, client-only getter.

let _manager: any | null = null;

/** Lazy, client-only getter for the Lipsync manager. */
export async function getLipsyncManager() {
  if (typeof window === "undefined") return null; // SSR guard
  if (_manager) return _manager;

  const mod = await import("wawa-lipsync"); // dynamic import on client
  _manager = new mod.Lipsync();
  return _manager;
}

/** Map Wawa viseme label -> Oculus morph target weights. */
export const WAWA_TO_OCULUS: Record<
  string,
  Partial<Record<
    | "jawOpen"
    | "viseme_PP" | "viseme_FF" | "viseme_TH" | "viseme_DD" | "viseme_kk"
    | "viseme_CH" | "viseme_SS" | "viseme_nn" | "viseme_RR" | "viseme_aa"
    | "viseme_E"  | "viseme_I"  | "viseme_O"  | "viseme_U",
    number
  >>
> = {
  // basic vowel-ish
  neutral: { jawOpen: 0.1, viseme_E: 0.1 },
  A: { jawOpen: 0.9, viseme_aa: 1.0 },
  E: { jawOpen: 0.6, viseme_E: 1.0 },
  I: { jawOpen: 0.55, viseme_I: 1.0 },
  O: { jawOpen: 0.75, viseme_O: 1.0 },
  U: { jawOpen: 0.6, viseme_U: 1.0 },

  // common consonants
  P: { viseme_PP: 1.0, jawOpen: 0.1 },
  B: { viseme_PP: 1.0, jawOpen: 0.1 },
  M: { viseme_PP: 0.9, viseme_nn: 0.3 },
  F: { viseme_FF: 1.0 },
  V: { viseme_FF: 0.9 },
  TH: { viseme_TH: 1.0 },
  T: { viseme_DD: 1.0 },
  D: { viseme_DD: 0.9 },
  N: { viseme_nn: 1.0 },
  L: { viseme_nn: 0.8 },
  K: { viseme_kk: 1.0 },
  G: { viseme_kk: 0.9 },
  S: { viseme_SS: 1.0 },
  Z: { viseme_SS: 0.9 },
  SH: { viseme_CH: 1.0 },
  CH: { viseme_CH: 1.0 },
  JH: { viseme_CH: 0.9 },
  ZH: { viseme_CH: 0.9 },
  R: { viseme_RR: 1.0 },
  Y: { viseme_E: 0.5 },
  W: { viseme_U: 0.5 },
};
