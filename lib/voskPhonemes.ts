// lib/voskPhonemes.ts
// Vosk loader + word-timestamp → “phones” stream from an <audio> element.
// - Uses HTMLMediaElement.captureStream()
// - Feeds AudioBuffer directly into Vosk (vosk-browser style)
// - Tries hard to avoid TS fights and “Recognizer not ready, ignoring”.

export type Phone = { phone: string; startSec: number; endSec: number };

export type Opts = {
  assetsUrl: string; // e.g. "/vosk" (expects /vosk/vosk.js)
  modelUrl: string;  // e.g. "/models/vosk-model-small-en-us-0.15.tar.gz"
  onPhones: (phones: Phone[]) => void;
  debug?: boolean;
};

declare global {
  interface Window {
    Vosk?: any; // vosk-browser globals
    webkitAudioContext?: typeof AudioContext;
  }
}

/** Word timestamps → coarse “phones” (map to visemes in your app). */
function wordsToPhones(wordResult: {
  result?: Array<{ start: number; end: number; word: string }>;
  text?: string;
}): Phone[] {
  const phones: Phone[] = [];
  const parts = wordResult?.result ?? [];
  for (const w of parts) {
    phones.push({
      phone: (w.word || "").toUpperCase(),
      startSec: w.start ?? 0,
      endSec: w.end ?? Math.max(0, (w.start ?? 0) + 0.08),
    });
  }
  return phones;
}

/** Load Vosk from /vosk/vosk.js (or reuse if already injected). */
async function loadVosk(assetsUrl: string): Promise<any> {
  if (typeof window !== "undefined" && window.Vosk) return window.Vosk;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${assetsUrl.replace(/\/$/, "")}/vosk.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${s.src}`));
    document.head.appendChild(s);
  });

  const g = window.Vosk;
  if (!g || typeof g.createModel !== "function") {
    throw new Error(
      "Vosk recognizer API not found after loading /vosk/vosk.js. " +
        "Use a vosk-browser build that exposes window.Vosk.createModel and model.KaldiRecognizer."
    );
  }
  return g;
}

/** Optional tiny overlay for live debug of phones. */
function ensureDebugOverlay(): HTMLDivElement {
  let el = document.getElementById("vosk-phones-overlay") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "vosk-phones-overlay";
    Object.assign(el.style, {
      position: "fixed",
      right: "8px",
      bottom: "8px",
      zIndex: "999999",
      maxWidth: "38vw",
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "12px",
      background: "rgba(0,0,0,0.65)",
      color: "#D6F6FF",
      padding: "8px 10px",
      borderRadius: "10px",
      backdropFilter: "blur(6px)",
      whiteSpace: "pre-wrap",
      pointerEvents: "none",
    } as CSSStyleDeclaration);
    el.textContent = "phones (latest batch):\n(no phones yet)";
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Create a Vosk recognizer and stream audio from <audio> via captureStream().
 * Returns a stop() that tears everything down cleanly.
 */
export async function makeVoskPhonemeStream(
  audioEl: HTMLAudioElement,
  opts: Opts
): Promise<{ stop(): Promise<void> }> {
  const { assetsUrl, modelUrl, onPhones, debug = false } = opts;

  // ---- 1) Load Vosk
  const Vosk = await loadVosk(assetsUrl);

  // ---- 2) Create model and wait until ready
  const model: any = await Vosk.createModel(modelUrl);

  await new Promise<void>((resolve, reject) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    try {
      // Some builds emit "load" event with { result: true }
      model.on?.("load", (m: any) => {
        if (m?.result === true) done();
      });
    } catch {}

    const t0 = Date.now();
    const iv = setInterval(() => {
      if (model.ready) {
        clearInterval(iv);
        done();
      } else if (Date.now() - t0 > 20000) {
        clearInterval(iv);
        reject(new Error("Timed out waiting for Vosk model to be ready"));
      }
    }, 150);
  });

  if (typeof model.KaldiRecognizer !== "function") {
    throw new Error("model.KaldiRecognizer missing — incompatible vosk build.");
  }

  // ---- 3) Recognizer
  // ⚠️ Some builds require a sampleRate here: 16000.
  // If your vosk.js complains about undefined sampleRate, this is the fix.
  let recognizer: any;
  try {
    recognizer = new model.KaldiRecognizer(16000); // try with sampleRate
  } catch {
    // Fallback to no-arg constructor if your build expects that instead
    recognizer = new model.KaldiRecognizer();
  }

  recognizer.setWords?.(true);

  // Wait for recognizer to be ready if the build exposes that
  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    if (recognizer.ready) {
      finish();
      return;
    }

    // Some builds emit "ready" from the worker
    recognizer.on?.("ready", () => finish());

    // Safety timeout: if no explicit ready event exists, just go after 2s
    setTimeout(() => finish(), 2000);
  });

  const overlay = debug ? ensureDebugOverlay() : null;

  recognizer.on("result", (msg: any) => {
    const ph = wordsToPhones(msg?.result || {});
    if (ph.length) {
      if (debug && overlay) {
        overlay.textContent =
          "phones (latest batch):\n" +
          ph
            .map(
              (p) =>
                `${p.phone}  [${p.startSec.toFixed(2)} → ${p.endSec.toFixed(2)}]`
            )
            .join("\n");
      }
      onPhones(ph);
      if (debug) console.log("[vosk] phones:", ph);
    }
  });

  recognizer.on("partialresult", (_msg: any) => {
    // if (debug) console.log("[vosk] partial:", _msg?.partial);
  });

  // ---- 4) Audio pipeline: captureStream() → MediaStreamSource → ScriptProcessorNode
  const stream: MediaStream | undefined =
    (audioEl as any).captureStream?.() || (audioEl as any).mozCaptureStream?.();
  if (!stream) {
    throw new Error(
      "audioEl.captureStream() not supported in this browser. " +
        "Use a shared AudioContext/MediaElementSource if needed."
    );
  }

  const AC = window.AudioContext || window.webkitAudioContext!;
  const ctx = new AC();

  const src = ctx.createMediaStreamSource(stream);
  const channels = Math.min(2, src.channelCount || 2);

  const blockSize = 4096;
  const node = ctx.createScriptProcessor(blockSize, channels, channels);

  node.onaudioprocess = (ev: AudioProcessingEvent) => {
    try {
      const inBuf = ev.inputBuffer; // AudioBuffer
      if (debug) {
        console.log(
          `[vosk] input: ${inBuf.length} frames @ ${inBuf.sampleRate} Hz, ${inBuf.numberOfChannels}ch`
        );
      }

      // Feed the raw AudioBuffer to vosk-browser (like the official examples)
      recognizer.acceptWaveform(inBuf);
    } catch (e) {
      if (debug) console.warn("[vosk] acceptWaveform error:", e);
    }
  };

  src.connect(node);
  node.connect(ctx.destination); // keep node alive; no audible change

  async function stop() {
    try {
      node.disconnect();
    } catch {}
    try {
      src.disconnect();
    } catch {}
    try {
      recognizer.remove?.();
    } catch {}
    try {
      model.terminate?.();
    } catch {}
    try {
      await ctx.close();
    } catch {}
    if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
  }

  return { stop };
}
