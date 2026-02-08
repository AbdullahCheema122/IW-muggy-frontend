// lib/phoneToViseme.ts
import type { Phone } from "./voskPhonemes";

const VOWELS = new Set(["AA","AE","AH","AO","AW","AY","EH","ER","EY","IH","IY","OW","OY","UH","UW"]);

const MAP: Record<string, Partial<Record<string, number>>> = {
  AA:{viseme_aa:1}, AE:{viseme_aa:1}, AH:{viseme_aa:0.9}, AO:{viseme_O:0.9},
  EH:{viseme_E:1}, ER:{viseme_RR:0.5, viseme_aa:0.4}, EY:{viseme_E:0.8, viseme_I:0.6},
  IH:{viseme_I:1}, IY:{viseme_I:1}, OW:{viseme_O:1}, OY:{viseme_O:0.9, viseme_I:0.5},
  UH:{viseme_U:0.9}, UW:{viseme_U:1}, AW:{viseme_aa:0.7, viseme_U:0.5}, AY:{viseme_aa:0.8, viseme_I:0.5},
  P:{viseme_PP:1}, B:{viseme_PP:1}, M:{viseme_PP:0.9},
  F:{viseme_FF:1}, V:{viseme_FF:1},
  TH:{viseme_TH:1}, DH:{viseme_TH:0.7},
  T:{viseme_DD:1}, D:{viseme_DD:1},
  K:{viseme_kk:1}, G:{viseme_kk:0.9},
  CH:{viseme_CH:1}, JH:{viseme_CH:0.9}, SH:{viseme_SS:1}, ZH:{viseme_SS:0.8},
  S:{viseme_SS:1}, Z:{viseme_SS:0.9},
  N:{viseme_nn:1}, NG:{viseme_nn:0.8},
  R:{viseme_RR:1}, L:{viseme_RR:0.7},
};

export function phonesToVisemes(phones: Phone[], gain = 1.0) {
  const frames: Array<{ t: number; weights: Record<string, number> }> = [];
  for (const p of phones) {
    const base = MAP[p.phone] || (VOWELS.has(p.phone) ? { viseme_aa: 0.7 } : {});
    const startMs = Math.round(p.startSec * 1000);
    const durMs = Math.max(0, (p.endSec - p.startSec) * 1000);

    const jaw =
      (base.viseme_aa ?? 0) * 0.7 +
      (base.viseme_E ?? 0) * 0.5 +
      (base.viseme_I ?? 0) * 0.4 +
      (base.viseme_O ?? 0) * 0.7 +
      (base.viseme_U ?? 0) * 0.7;

    const weights: Record<string, number> = {
      jawOpen: Math.min(0.6, jaw * 0.8 * gain),
    };
    for (const [k, v] of Object.entries(base)) weights[k] = Math.min(1, (v ?? 0) * gain);

    frames.push({ t: startMs, weights });

    // optional trailing decay point for longer phones
    if (durMs > 80) {
      frames.push({
        t: startMs + Math.max(40, durMs - 40),
        weights: { ...weights, jawOpen: weights.jawOpen * 0.5 },
      });
    }
  }
  return frames;
}
