"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

export type AzureVisemeMessage = {
  type: "azure-viseme";
  frames: number[][];
  fps: number;
  audioOffset?: number; // ms (relative to audio start)
  utteranceId: string;
  seq?: number;
};

type QueuedFrame = {
  t: number;         // absolute time (performance.now) when this frame should apply
  frame: number[];   // raw ARKit-52 frame
  u: string;         // utteranceId
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function useAzureArkitLipSync(audioEl: HTMLAudioElement | null) {
  const audioStartRef = useRef<number | null>(null);

  // Frames can arrive before audio starts — buffer them.
  const pendingMsgsRef = useRef<AzureVisemeMessage[]>([]);

  // Main frame queue (time-scheduled)
  const qRef = useRef<QueuedFrame[]>([]);
  const rafRef = useRef<number>(0);

  // Smoothed weights for output
  const weightsRef = useRef<Record<string, number>>({});
  const smoothRef = useRef<Record<string, number>>({});

  // TUNING (good defaults)
  const CFG = useMemo(() => {
    return {
      // Timing calibration: negative = slightly earlier mouth (often needed)
      TIME_CAL_MS: -55,

      // How many ms of frames to keep (drop too-old)
      MAX_BACKLOG_MS: 2500,

      // Response: lower = faster mouth reaction, higher = smoother
      RESPONSE: 0.18, // 0.14–0.25

      // Gains
      GLOBAL_GAIN: 1.25,
      JAW_GAIN: 2.25,
      MOUTH_GAIN: 1.55,

      // When jaw is open, suppress mouthClose to avoid fighting
      MOUTH_CLOSE_SUPPRESS_THRESHOLD: 0.12,

      // If no visemes but audio is playing, keep a tiny "talk alive" bias
      IDLE_TALK_BIAS: 0.0,
    };
  }, []);

  /* ------------------------------------------------------------
     Track when audio ACTUALLY starts playing
  ------------------------------------------------------------ */
  useEffect(() => {
    if (!audioEl) return;

    const markStart = () => {
      // Only set once per playback start
      audioStartRef.current = performance.now();

      // Flush pending msgs that arrived before audio
      const pending = pendingMsgsRef.current;
      if (pending.length) {
        pendingMsgsRef.current = [];
        pending.forEach((m) => handleAzureVisemeMessage(m));
      }
    };

    const onPlaying = () => markStart();
    const onPlay = () => markStart();

    const onEnded = () => {
      audioStartRef.current = null;
      qRef.current.length = 0;
      // softly reset
      smoothRef.current = {};
      weightsRef.current = {};
    };

    audioEl.addEventListener("playing", onPlaying);
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("ended", onEnded);

    return () => {
      audioEl.removeEventListener("playing", onPlaying);
      audioEl.removeEventListener("play", onPlay);
      audioEl.removeEventListener("ended", onEnded);
    };
  }, [audioEl]);

  /* ------------------------------------------------------------
     Main RAF loop — apply frames at scheduled time
  ------------------------------------------------------------ */
  useEffect(() => {
    const loop = () => {
      const now = performance.now();

      // Drop frames that are too old (prevents backlog lag)
      const maxOld = now - CFG.MAX_BACKLOG_MS;
      while (qRef.current.length && qRef.current[0].t < maxOld) {
        qRef.current.shift();
      }

      // Apply all due frames (catch up)
      let applied = false;
      while (qRef.current.length && qRef.current[0].t <= now) {
        const next = qRef.current.shift()!;
        applyFrame(next.frame);
        applied = true;
      }

      // If nothing applied, keep last weights (do nothing).
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [CFG]);

  /* ------------------------------------------------------------
     Convert raw ARKit-52 frame -> smoothed weights map
  ------------------------------------------------------------ */
  const applyFrame = useCallback(
    (frame: number[]) => {
      // Azure ARKit-52 indices (must match your AZURE_ARKIT_52 list)
      const jawOpen = clamp01((frame[17] ?? 0) * CFG.JAW_GAIN * CFG.GLOBAL_GAIN);

      const out: Record<string, number> = {};
      const prev = smoothRef.current;

      // Helper: smooth
      const sm = (k: string, target: number) => {
        const p = prev[k] ?? 0;
        const y = p * CFG.RESPONSE + target * (1 - CFG.RESPONSE);
        prev[k] = y;
        out[k] = y;
      };

      // Start by mapping everything 1:1
      // (Your AvatarBubble can remap names via morphMap)
      for (let i = 0; i < 52; i++) {
        const v0 = clamp01(frame[i] ?? 0);

        // Basic boost for mouth-only shapes
        let v = v0 * CFG.GLOBAL_GAIN;
        if (i >= 18 && i <= 39) v *= CFG.MOUTH_GAIN; // mouth* range in ARKit list

        // Special handling: jawOpen
        if (i === 17) v = jawOpen;

        sm(String(i), clamp01(v));
      }

      // mouthClose is index 18 in ARKit list you pasted? (In your array it is index 18)
      // But your AZURE_ARKIT_52 list: jawOpen (index 17), mouthClose (index 18)
      const mouthCloseIdxKey = "18";
      if (jawOpen > CFG.MOUTH_CLOSE_SUPPRESS_THRESHOLD) {
        const v = (out[mouthCloseIdxKey] ?? 0) * 0.15;
        prev[mouthCloseIdxKey] = v;
        out[mouthCloseIdxKey] = v;
      }

      weightsRef.current = out;
    },
    [CFG]
  );

  /* ------------------------------------------------------------
     Public handler — call this on LiveKit data packet
  ------------------------------------------------------------ */
  const handleAzureVisemeMessage = useCallback(
    (msg: AzureVisemeMessage) => {
      if (!msg?.frames?.length) return;

      // If audio hasn't started yet, buffer this message.
      if (!audioStartRef.current) {
        pendingMsgsRef.current.push(msg);
        // Keep buffer bounded
        if (pendingMsgsRef.current.length > 120) pendingMsgsRef.current.shift();
        return;
      }

      const base = audioStartRef.current;
      const fps = msg.fps || 60;
      const frameDur = 1000 / fps;
      const audioOffset = (msg.audioOffset ?? 0) + CFG.TIME_CAL_MS;

      // Schedule frames
      const startT = base + audioOffset;

      for (let i = 0; i < msg.frames.length; i++) {
        qRef.current.push({
          t: startT + i * frameDur,
          frame: msg.frames[i],
          u: msg.utteranceId || "utt",
        });
      }

      // Sort by time occasionally (handles out-of-order packets)
      if (qRef.current.length > 32) {
        qRef.current.sort((a, b) => a.t - b.t);
      }

      // Keep queue bounded (prevents huge lag)
      const now = performance.now();
      const maxT = now + CFG.MAX_BACKLOG_MS;
      qRef.current = qRef.current.filter((f) => f.t <= maxT);
    },
    [CFG]
  );

  return { weightsRef, handleAzureVisemeMessage };
}
