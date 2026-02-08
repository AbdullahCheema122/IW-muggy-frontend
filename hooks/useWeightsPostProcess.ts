// hooks/useWeightsPostProcess.ts
"use client";

import { useEffect, useRef } from "react";

type Weights = Record<string, number>;

type Opts = {
  sourceRef: React.MutableRefObject<Weights>;
  latencyMs?: number;          // positive = delay visemes; negative = lead
  gateOpen?: number;           // energy threshold to open mouth
  gateClose?: number;          // lower threshold to close mouth
  holdMs?: number;             // keep mouth open briefly after speech
  jawScale?: number;           // extra jaw gain
  jawGamma?: number;           // >1 reduces extremes
  vowelScale?: number;
  consonantScale?: number;
  fastMs?: number;             // plosive/sibilant EMA
  slowMs?: number;             // vowel EMA
};

const VOWELS = ["viseme_aa","viseme_E","viseme_I","viseme_O","viseme_U"];
const CONSONANTS = ["viseme_PP","viseme_FF","viseme_TH","viseme_DD","viseme_kk","viseme_CH","viseme_SS","viseme_nn","viseme_RR"];
const FAST = ["viseme_PP","viseme_DD","viseme_kk","viseme_CH","viseme_TH","viseme_SS"]; // snap faster

export default function useWeightsPostProcess(opts: Opts) {
  const {
    sourceRef,
    latencyMs = 30,
    gateOpen = 0.06,
    gateClose = 0.03,
    holdMs = 90,
    jawScale = 0.55,
    jawGamma = 1.35,
    vowelScale = 0.9,
    consonantScale = 1.0,
    fastMs = 25,
    slowMs = 70,
  } = opts;

  const outRef = useRef<Weights>({});
  const bufRef = useRef<{ t: number; w: Weights }[]>([]);
  const lastActiveRef = useRef(0);
  const gatedOpenRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();

      // 1) push latest raw snapshot
      bufRef.current.push({ t: now, w: { ...(sourceRef.current || {}) } });
      // keep ~1s
      const cutoff = now - 1200;
      while (bufRef.current.length && bufRef.current[0].t < cutoff) bufRef.current.shift();

      // 2) pick delayed/advanced snapshot
      const targetT = now - latencyMs;
      const arr = bufRef.current;
      let pick = arr[arr.length - 1];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].t <= targetT) { pick = arr[i]; break; }
      }
      const raw = pick?.w || {};

      // 3) compute overall loudness proxy
      const energy =
        (raw.jawOpen ?? 0) * 0.5 +
        VOWELS.reduce((a, k) => a + (raw[k] ?? 0), 0) / (VOWELS.length * 2) +
        CONSONANTS.reduce((a, k) => a + (raw[k] ?? 0), 0) / (CONSONANTS.length * 5);

      // 4) gate with hysteresis + hold
      const wasOpen = gatedOpenRef.current;
      if (!wasOpen && energy >= gateOpen) {
        gatedOpenRef.current = true;
        lastActiveRef.current = now;
      } else if (wasOpen) {
        if (energy >= gateClose) {
          lastActiveRef.current = now;
        } else if (now - lastActiveRef.current > holdMs) {
          gatedOpenRef.current = false;
        }
      }

      // 5) per-phoneme EMA (fast for plosives/sibilants, slow for vowels)
      const out = outRef.current;
      const ema = (key: string, target: number, ms: number) => {
        const cur = out[key] ?? 0;
        const alpha = 1 - Math.exp(-(16 /* ~frame ms */) / Math.max(1, ms));
        out[key] = cur + (target - cur) * alpha;
      };

      // jaw first (scale + gamma + clamp)
      const rj = Math.max(0, Math.min(1, raw.jawOpen ?? 0));
      const jawPow = Math.pow(rj, Math.max(0.1, jawGamma));
      const jawTarget = Math.min(1, jawPow * jawScale);
      ema("jawOpen", gatedOpenRef.current ? jawTarget : 0, 80);

      for (const k of VOWELS) {
        const t = (raw[k] ?? 0) * vowelScale;
        ema(k, gatedOpenRef.current ? t : 0, slowMs);
      }
      for (const k of CONSONANTS) {
        const t = (raw[k] ?? 0) * consonantScale;
        ema(k, gatedOpenRef.current ? t : 0, FAST.includes(k) ? fastMs : slowMs);
      }

      // 6) couple 'aa' a bit to jaw
      out["viseme_aa"] = Math.max(out["viseme_aa"] ?? 0, (out.jawOpen ?? 0) * 0.5);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sourceRef, latencyMs, gateOpen, gateClose, holdMs, jawScale, jawGamma, vowelScale, consonantScale, fastMs, slowMs]);

  return { weightsRef: outRef };
}