// types/vosk-browser.d.ts
export {};

declare global {
  interface VoskGlobal {
    createModel?: (url: string) => Promise<VoskModel>;
  }

  interface VoskModel {
    ready?: boolean;
    on?: (ev: string, fn: (m: any) => void) => void;
    KaldiRecognizer?: new () => VoskRecognizer;
    setLogLevel?: (lvl: number) => void;
    terminate?: () => void;
  }

  /**
   * Relax upstream typing: the browser build accepts a plain Float32Array
   * of mono 16k PCM samples. We DO NOT use generics like Float32Array<ArrayBuffer>.
   */
  interface VoskRecognizer {
    on: (ev: "result" | "partialresult", fn: (m: any) => void) => void;
    acceptWaveform?: (buffer: AudioBuffer) => void;            // legacy path
    acceptWaveformFloat?: (pcmMono16k: Float32Array) => void;   // browser path
    setWords?: (on: boolean) => void;
    remove?: () => void;
  }

  interface Window {
    Vosk?: VoskGlobal;
    webkitAudioContext?: typeof AudioContext;
  }
}
