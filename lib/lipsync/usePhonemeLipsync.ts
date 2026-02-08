// src/lib/lipsync/usePhonemeLipsync.ts
// Minimal phoneme->viseme scheduler (MFA-IPA → ARKit/Oculus-like visemes)

import { useCallback, useEffect, useRef } from "react";

export type PhonemeEvt = { phone: string; startMs: number; endMs: number };

const PHONEME_TO_VISEME: Record<string, string> = {
  // vowels
  "ɑ":"viseme_aa","a":"viseme_aa","ɐ":"viseme_aa","ɒ":"viseme_aa","ʌ":"viseme_aa",
  "e":"viseme_E","ɛ":"viseme_E","ej":"viseme_E",
  "i":"viseme_I","ɪ":"viseme_I",
  "o":"viseme_O","ɔ":"viseme_O","ow":"viseme_O",
  "u":"viseme_U","ʊ":"viseme_U","ʉ":"viseme_U",
  // bilabials (closed lips)
  "p":"viseme_PP","b":"viseme_PP","m":"viseme_PP","pʰ":"viseme_PP","bʲ":"viseme_PP",
  // labiodentals
  "f":"viseme_FF","v":"viseme_FF",
  // sibilant/fricatives (SS group – includes t/d/affricates for visual effect)
  "s":"viseme_SS","z":"viseme_SS","ʃ":"viseme_SS","ʒ":"viseme_SS","t":"viseme_SS","d":"viseme_SS","tʃ":"viseme_SS","dʒ":"viseme_SS"
};

function mapPhoneToViseme(p: string): string | null {
  const key = p.toLowerCase().trim();
  if (PHONEME_TO_VISEME[key]) return PHONEME_TO_VISEME[key];
  if (key.startsWith("k") || key.startsWith("g")) return "viseme_SS";
  if (key === "w") return "viseme_U";
  if (key === "j") return "viseme_I"; // 'y' sound
  return null;
}

export function usePhonemeLipsync(
  audioEl: HTMLAudioElement | null,
  latencyMs: number = 110
) {
  // what AvatarBubble consumes
  const weightsRef = useRef<Record<string, number>>({});

  // event queue + book-keeping
  const evtsRef = useRef<PhonemeEvt[]>([]);
  const hasPhonemesRef = useRef<boolean>(false);

  const pushPhoneme = useCallback((e: PhonemeEvt) => {
    hasPhonemesRef.current = true;
    evtsRef.current.push(e);
  }, []);

  useEffect(() => {
    let raf: number | null = null;

    const loop = () => {
      const el = audioEl;
      if (el) {
        const tMs = el.currentTime * 1000 + latencyMs;

        // garbage collect old events
        while (evtsRef.current.length && evtsRef.current[0].endMs < tMs - 250) {
          evtsRef.current.shift();
        }

        // active events at tMs
        const active = evtsRef.current.filter(e => e.startMs <= tMs && e.endMs >= tMs);
        const next: Record<string, number> = { jawOpen: 0 };

        for (const e of active) {
          const vis = mapPhoneToViseme(e.phone);
          if (!vis) continue;

          const span = Math.max(1, e.endMs - e.startMs);
          const x = (tMs - e.startMs) / span; // 0..1
          // short attack/release envelope
          const env = x < 0.2 ? x/0.2 : x > 0.8 ? (1-x)/0.2 : 1;
          const val = Math.max(0, Math.min(1, env));
          next[vis] = Math.max(next[vis] || 0, val);
          next.jawOpen = Math.max(next.jawOpen, val * 0.6);
        }

        // light smoothing
        const prev = weightsRef.current;
        const out: Record<string, number> = {};
        const ATT = 0.5, REL = 0.25;
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) {
          const a = next[k] || 0;
          const b = prev[k] || 0;
          const coef = a > b ? ATT : REL;
          out[k] = b + (a - b) * coef;
        }
        weightsRef.current = out;
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [audioEl, latencyMs]);

  return { weightsRef, pushPhoneme, hasPhonemesRef };
}
