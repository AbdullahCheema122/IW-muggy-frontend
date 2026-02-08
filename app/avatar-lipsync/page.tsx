"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Upload, Undo2 } from "lucide-react";
import AvatarBubble from "@/components/AvatarBubble";
import { VisemeAnalyzer } from "@abdullahcheema122/iw-lipsync";
import { makeVoskPhonemeStream, type Phone } from "@/lib/voskPhonemes";

/* --------------------------- config & helpers --------------------------- */

const DEFAULT_RPM =
  "https://models.readyplayer.me/6908a3e5c9c3ee8b22008efe.glb?morphTargets=ARKit,Oculus%20Visemes";

// public/vosk/vosk.js and public/models/...
const VOSK_ASSETS_URL = "/vosk";
const VOSK_MODEL_URL = "/models/vosk-model-small-en-us-0.15.tar.gz";

type VoskState = "idle" | "loading" | "ready" | "error";

// Simple CMU-ish mapping (you can refine later)
const VOWELS = new Set([
  "AA","AE","AH","AO","AW","AY","EH","ER","EY","IH","IY","OW","OY","UH","UW",
]);
const P2V: Record<string, Partial<Record<string, number>>> = {
  AA: { viseme_aa: 1 }, AE: { viseme_aa: 1 }, AH: { viseme_aa: 0.9 }, AO: { viseme_O: 0.9 },
  EH: { viseme_E: 1 }, ER: { viseme_RR: 0.5, viseme_aa: 0.4 }, EY: { viseme_E: 0.8, viseme_I: 0.6 },
  IH: { viseme_I: 1 }, IY: { viseme_I: 1 }, OW: { viseme_O: 1 }, OY: { viseme_O: 0.9, viseme_I: 0.5 },
  UH: { viseme_U: 0.9 }, UW: { viseme_U: 1 }, AW: { viseme_aa: 0.7, viseme_U: 0.5 }, AY: { viseme_aa: 0.8, viseme_I: 0.5 },
  P: { viseme_PP: 1 }, B: { viseme_PP: 1 }, M: { viseme_PP: 0.9 },
  F: { viseme_FF: 1 }, V: { viseme_FF: 1 },
  TH: { viseme_TH: 1 }, DH: { viseme_TH: 0.7 },
  T: { viseme_DD: 1 }, D: { viseme_DD: 1 },
  K: { viseme_kk: 1 }, G: { viseme_kk: 0.9 },
  CH: { viseme_CH: 1 }, JH: { viseme_CH: 0.9 },
  SH: { viseme_SS: 1 }, ZH: { viseme_SS: 0.8 }, S: { viseme_SS: 1 }, Z: { viseme_SS: 0.9 },
  N: { viseme_nn: 1 }, NG: { viseme_nn: 0.8 },
  R: { viseme_RR: 1 }, L: { viseme_RR: 0.7 },
};

// phones (word stamps) → sparse viseme frames, with small lookahead compensation
function phonesToVisemeFrames(
  phones: Phone[],
  leadMs = 60,     // push a little earlier so mouth opens before audio peak
  gain = 1.0
) {
  const frames: Array<{ t: number; weights: Record<string, number> }> = [];
  for (const p of phones) {
    const base =
      P2V[p.phone] || (VOWELS.has(p.phone) ? { viseme_aa: 0.7 } : {});

    // rough jaw from vowel energy
    const jaw =
      (base.viseme_aa ?? 0) * 0.7 +
      (base.viseme_E ?? 0) * 0.5 +
      (base.viseme_I ?? 0) * 0.4 +
      (base.viseme_O ?? 0) * 0.7 +
      (base.viseme_U ?? 0) * 0.7;

    const weights: Record<string, number> = {
      jawOpen: Math.min(0.55, jaw * 0.8 * gain),
    };
    for (const [k, v] of Object.entries(base)) {
      weights[k] = Math.min(1, (v ?? 0) * gain);
    }

    // schedule slightly earlier than the word start (leadMs)
    const t = Math.max(0, Math.round(p.startSec * 1000) - leadMs);
    frames.push({ t, weights });
  }
  return frames;
}

function mixVisemes(
  a: Record<string, number>, // phoneme track
  b: Record<string, number>, // fft track
  aWeight = 0.7
) {
  const out: Record<string, number> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    out[k] = av * aWeight + bv * (1 - aWeight);
  }
  if (out.jawOpen != null) {
    out.viseme_aa = Math.max(out.viseme_aa ?? 0, out.jawOpen * 0.55);
  }
  return out;
}

/* ---------------------------------- Page --------------------------------- */

export default function AvatarLipsyncPage() {
  const [modelUrl, setModelUrl] = useState<string>(DEFAULT_RPM);
  const [modelUrlInput, setModelUrlInput] = useState<string>(DEFAULT_RPM);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  // FFT analyzer → baseline visemes
  const analyzerRef = useRef<VisemeAnalyzer | null>(null);
  const weightsRef = useRef<Record<string, number>>({});

  // Vosk state
  const [useVosk, setUseVosk] = useState(true);
  const useVoskRef = useRef(true);
  const [voskState, setVoskState] = useState<VoskState>("idle");
  const voskErrRef = useRef<string | null>(null);

  // Drift/lead tuning
  const [leadMs, setLeadMs] = useState(60);       // schedule phones earlier (helps “pre-open”)
  const [mixPhoneme, setMixPhoneme] = useState(0.75); // weight of phoneme vs FFT

  // phoneme frames queue (from Vosk)
  const phonemeTimer = useRef<number | null>(null);
  const queueRef = useRef<Array<{ t: number; weights: Record<string, number> }>>([]);

  // Last phones debug (on-screen)
  const [lastPhones, setLastPhones] = useState<Phone[]>([]);

  /* ---- audio element bootstrap ---- */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onReady = () => setReady(true);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    el.addEventListener("loadeddata", onReady, { once: true });
    el.addEventListener("canplaythrough", onReady, { once: true });
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  /* ---- FFT analyzer (existing path) ---- */
  const [fftSize, setFftSize] = useState<512 | 1024 | 2048>(1024);
  const [attack, setAttack] = useState(0.28);
  const [release, setRelease] = useState(0.22);
  const [idleDecay, setIdleDecay] = useState(0.12);
  const [noiseFloor, setNoiseFloor] = useState(0.014);
  const [gain, setGain] = useState(0.95);
  const [latencyMs, setLatencyMs] = useState(30);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    try {
      analyzerRef.current?.destroy?.();
    } catch {}
    analyzerRef.current = null;

    const analyzer = new VisemeAnalyzer(el, {
      fftSize,
      attack,
      release,
      idleDecay,
      noiseFloor,
      gain,
    });

    const off = analyzer.onUpdate((fftWeights: Record<string, number>) => {
      if (useVoskRef.current) {
        const nowMs = (audioRef.current?.currentTime ?? 0) * 1000;
        const cur = nextPhonemeWeights(nowMs);
        weightsRef.current = mixVisemes(cur, fftWeights, mixPhoneme);
      } else {
        weightsRef.current = fftWeights;
      }
    });

    analyzer.start(true);
    (analyzer as any).setLatencyMs?.(latencyMs);
    analyzerRef.current = analyzer;

    return () => {
      try { off(); } catch {}
      try { analyzer.destroy?.(); } catch {}
      analyzerRef.current = null;
    };
  }, [fftSize, attack, release, idleDecay, noiseFloor, gain, latencyMs, mixPhoneme]);

  /* ---- Vosk toggle & stream ---- */
  useEffect(() => {
    useVoskRef.current = useVosk;
  }, [useVosk]);

  useEffect(() => {
    let handle: { stop(): Promise<void> } | null = null;

    if (!useVosk) {
      setVoskState("idle");
      stopPhonemeTimer();
      queueRef.current.length = 0;
      voskErrRef.current = null;
      return;
    }

    setVoskState("loading");
    voskErrRef.current = null;

    const el = audioRef.current!;
    (async () => {
      try {
        handle = await makeVoskPhonemeStream(el, {
          assetsUrl: VOSK_ASSETS_URL,
          modelUrl: VOSK_MODEL_URL,
          debug: true, // console.log phones
          onPhones: (phones) => {
            setLastPhones(phones);
            const frames = phonesToVisemeFrames(phones, leadMs, 1.0);
            queueRef.current.push(...frames);
            // keep sorted by time
            queueRef.current.sort((a, b) => a.t - b.t);
            pumpPhonemes();
          },
        });
        setVoskState("ready");
      } catch (e: unknown) {
        const msg =
          typeof e === "object" && e && "message" in e
            ? String((e as any).message)
            : String(e);
        voskErrRef.current = msg;
        setVoskState("error");
      }
    })();

    return () => {
      handle?.stop();
      stopPhonemeTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useVosk, leadMs]);

  function pumpPhonemes() {
    if (phonemeTimer.current != null) return;
    const tick = () => {
      phonemeTimer.current = window.requestAnimationFrame(tick);
    };
    phonemeTimer.current = window.requestAnimationFrame(tick);
  }

  function stopPhonemeTimer() {
    if (phonemeTimer.current != null) {
      window.cancelAnimationFrame(phonemeTimer.current);
      phonemeTimer.current = null;
    }
  }

  function nextPhonemeWeights(nowMs: number) {
    // drain frames <= now + tiny tolerance
    let last: Record<string, number> | null = null;
    const q = queueRef.current;
    let i = 0;
    while (i < q.length) {
      if (q[i].t <= nowMs + 18) {
        last = q[i].weights;
        i++;
      } else break;
    }
    if (i > 0) q.splice(0, i);
    return last ?? {};
  }

  /* ---- file pickers / controls ---- */
  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setFileUrl(url);

    const el = audioRef.current;
    if (el) {
      el.src = url;
      el.load();
      setReady(false);
      // clear any queued frames from prior audio
      queueRef.current.length = 0;
    }
  };

  const clearFile = () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    const el = audioRef.current;
    if (el) {
      el.src = "/samples/voice_demo.mp3";
      el.load();
      setReady(false);
      queueRef.current.length = 0;
    }
  };

  const unlockAndToggle = async () => {
    const el = audioRef.current;
    const analyzer = analyzerRef.current;
    if (!el || !analyzer) return;
    try {
      await (analyzer as any).resumeAudioContext?.();
      if (!el.src) el.src = fileUrl ?? "/samples/voice_demo.mp3";
      if (el.paused) await el.play();
      else el.pause();
    } catch (e) {
      console.warn("unlock/toggle failed:", e);
    }
  };

  useEffect(() => {
    const el = audioRef.current;
    const analyzer = analyzerRef.current;
    if (!el || !analyzer) return;
    const nudge = async () => {
      try {
        await (analyzer as any).resumeAudioContext?.();
      } catch {}
    };
    window.addEventListener("pointerdown", nudge, { once: true });
    window.addEventListener("keydown", nudge, { once: true });
    return () => {
      window.removeEventListener("pointerdown", nudge);
      window.removeEventListener("keydown", nudge);
    };
  }, [fileUrl]);

  const sanitizedModelUrl = useMemo(() => {
    const hasParam = /morphTargets=/.test(modelUrl);
    if (hasParam) return modelUrl;
    const sep = modelUrl.includes("?") ? "&" : "?";
    return `${modelUrl}${sep}morphTargets=ARKit,Oculus%20Visemes`;
  }, [modelUrl]);

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <h1 className="text-base font-semibold">Avatar Lipsync Playground</h1>

          <div className="ml-auto flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary"
                checked={useVosk}
                onChange={(e) => setUseVosk(e.target.checked)}
              />
              Use Vosk phonemes
            </label>

            <span className="text-xs text-muted-foreground">
              {useVosk
                ? voskState === "loading"
                  ? "loading model…"
                  : voskState === "ready"
                  ? "ready"
                  : voskState === "error"
                  ? `error: ${voskErrRef.current ?? "unknown"}`
                  : "idle"
                : "disabled"}
            </span>

            <button
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent/50"
              onClick={unlockAndToggle}
              title={ready ? "Play / Pause" : "Unlock & Play"}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playing ? "Pause" : "Unlock & Play"}
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent/50">
              <Upload className="h-4 w-4" />
              <span>Load audio</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={onPickFile}
              />
            </label>

            {fileUrl && (
              <button
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent/50"
                onClick={clearFile}
                title="Back to sample audio"
              >
                <Undo2 className="h-4 w-4" />
                Reset audio
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* left panel */}
        <aside className="space-y-4 rounded-2xl border bg-card/60 p-4 backdrop-blur">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Model URL</div>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              value={modelUrlInput}
              onChange={(e) => setModelUrlInput(e.target.value)}
              placeholder={DEFAULT_RPM}
            />
            <div className="flex gap-2">
              <button
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                onClick={() => setModelUrl(modelUrlInput)}
              >
                Load model
              </button>
              <button
                className="rounded-lg border px-3 py-1.5 text-sm"
                onClick={() => {
                  setModelUrl(DEFAULT_RPM);
                  setModelUrlInput(DEFAULT_RPM);
                }}
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              URL must include{" "}
              <code>morphTargets=ARKit,Oculus%20Visemes</code>.
            </p>
          </div>

          <hr className="my-3" />

          <div className="mt-4 space-y-2">
            <div className="text-sm font-semibold">Audio</div>
            <audio
              ref={audioRef}
              src={fileUrl ?? "/samples/voice_demo.mp3"}
              preload="auto"
              controls
              playsInline
              crossOrigin="anonymous"
              className="w-full"
            />
            <p className="text-[11px] text-muted-foreground">
              If you get silence, click <b>Unlock & Play</b> once.
            </p>
          </div>

          <hr className="my-3" />

          {/* Tuning */}
          <Slider label="fftSize" value={fftSize} onChange={(v) => setFftSize(v as 512 | 1024 | 2048)} min={512} max={2048} step={512} marks={[512,1024,2048]} />
          <Slider label="attack" value={attack} onChange={setAttack} min={0.05} max={0.6} step={0.01} />
          <Slider label="release" value={release} onChange={setRelease} min={0.05} max={0.6} step={0.01} />
          <Slider label="idleDecay" value={idleDecay} onChange={setIdleDecay} min={0.0} max={0.3} step={0.01} />
          <Slider label="noiseFloor" value={noiseFloor} onChange={setNoiseFloor} min={0.0} max={0.05} step={0.001} />
          <Slider label="gain" value={gain} onChange={setGain} min={0.5} max={1.5} step={0.01} />
          <Slider label="latencyMs" value={latencyMs} onChange={(v) => setLatencyMs(Math.round(v))} min={0} max={80} step={1} marks={[0,20,40,60,80]} />

          <hr className="my-3" />

          {/* New: alignment controls */}
          <Slider label="phoneme lead (ms)" value={leadMs} onChange={(v) => setLeadMs(Math.round(v))} min={-80} max={150} step={1} marks={[-80,0,60,120,150]} />
          <Slider label="phoneme weight" value={mixPhoneme} onChange={setMixPhoneme} min={0} max={1} step={0.05} marks={[0,0.5,0.75,1]} />

          {/* On-screen phoneme debug */}
          <div className="mt-3 rounded-lg border bg-black/70 p-2 font-mono text-[11px] text-green-400">
            <div className="mb-1 text-green-300/80">phones (latest batch):</div>
            <div className="max-h-24 overflow-auto">
              {lastPhones.length
                ? lastPhones
                    .map(
                      (p) =>
                        `${p.phone}(${p.startSec.toFixed(2)}–${p.endSec.toFixed(2)})`
                    )
                    .join(" ")
                : "(no phones yet)"}
            </div>
          </div>
        </aside>

        {/* right panel */}
        <section className="relative grid place-items-center">
          <div className="relative">
            <AvatarBubble
              modelUrl={sanitizedModelUrl}
              size={520}
              headYOffset={0.36}
              visemeWeightsRef={weightsRef}
              // tasteful motion
              jawScale={0.48}
              jawMax={0.5}
              jawGamma={1.4}
              visemeScale={0.95}
              vowelScale={0.85}
              consonantScale={0.95}
              smoothMs={55}
            />
          </div>

          <div className="mt-6 grid w-full max-w-xl grid-cols-2 gap-3 text-xs text-muted-foreground">
            <DebugRow name="playing" value={String(playing)} />
            <DebugRow name="audio" value={fileUrl ? "custom file" : "sample"} />
            <DebugRow name="model loaded" value={String(Boolean(sanitizedModelUrl))} />
            <DebugRow name="fftSize" value={String(fftSize)} />
            <DebugRow name="vosk" value={`${useVosk ? voskState : "off"}`} />
          </div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------ tiny UI bits ----------------------------- */

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  marks,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  marks?: number[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono">
          {value.toFixed(3).replace(/\.?0+$/, "")}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="w-full accent-primary"
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {marks && (
        <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
          {marks.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function DebugRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card/60 px-2 py-1">
      <span className="text-muted-foreground">{name}</span>
      <span className="font-mono text-muted-foreground">{value}</span>
    </div>
  );
}
