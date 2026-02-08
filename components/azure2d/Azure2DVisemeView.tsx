"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";

type AzureVisemeFrame = {
  visemeId: number;  // 0..20
  timeMs: number;    // relative to utterance
};

type AzureVisemeMessage = {
  type: "azure-viseme";
  utteranceId?: string;
  frames: AzureVisemeFrame[];
};

export default function Azure2DVisemeView({
  className,
  extension = "svg",
  size = 280,
}: {
  className?: string;
  extension?: "svg" | "png";
  size?: number;
}) {
  const room = useRoomContext();
  const [currentViseme, setCurrentViseme] = useState(0);

  const queueRef = useRef<AzureVisemeFrame[]>([]);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!room) return;

    const onData = (payload: Uint8Array) => {
      let txt = "";
      try {
        txt = new TextDecoder().decode(payload);
      } catch {
        return;
      }

      try {
        const msg = JSON.parse(txt) as AzureVisemeMessage;
        if (msg?.type !== "azure-viseme" || !msg.frames?.length) return;

        queueRef.current = msg.frames
          .slice()
          .sort((a, b) => a.timeMs - b.timeMs);

        startRef.current = performance.now();
      } catch {
        // ignore other messages
      }
    };

    (room as any).on?.("dataReceived", onData);
    return () => (room as any).off?.("dataReceived", onData);
  }, [room]);

  useEffect(() => {
    const tick = () => {
      if (startRef.current != null && queueRef.current.length) {
        const t = performance.now() - startRef.current;
        while (queueRef.current.length && queueRef.current[0].timeMs <= t) {
          setCurrentViseme(queueRef.current.shift()!.visemeId);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const src = useMemo(
    () => `/azure-visemes/${currentViseme}.${extension}`,
    [currentViseme, extension],
  );

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={`viseme-${currentViseme}`}
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}
