import { useEffect, useRef } from "react";

export function useAudioDrivenLipsync(
  audioElRef: React.MutableRefObject<HTMLAudioElement | null>
) {
  const weightsRef = useRef<Record<string, number>>({
    jawOpen: 0,
    mouthClose: 1,
  });

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();

    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    const buffer = new Float32Array(analyser.fftSize);
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);

      if (audio.paused || audio.ended) {
        weightsRef.current.jawOpen *= 0.85;
        weightsRef.current.mouthClose = 1 - weightsRef.current.jawOpen;
        return;
      }

      analyser.getFloatTimeDomainData(buffer);

      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }

      const rms = Math.sqrt(sum / buffer.length);

      // 🎯 Tune this
      const targetJaw = Math.min(1, rms * 3.2);

      // Smooth motion
      weightsRef.current.jawOpen =
        weightsRef.current.jawOpen * 0.75 + targetJaw * 0.25;

      weightsRef.current.mouthClose =
        1 - weightsRef.current.jawOpen;
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      ctx.close();
    };
  }, [audioElRef]);

  return weightsRef;
}
