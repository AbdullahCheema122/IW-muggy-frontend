// components/session/insights-panel.tsx
"use client";

import * as React from "react";
import { useVoiceAssistant } from "@livekit/components-react";
import { cn } from "@/lib/utils";

type InsightProps = {
  /** Seconds since call started */
  elapsedSec: number;
  /** Optional labels you can pass in (topic/side/user) */
  topic?: string;
  side?: "pro" | "con" | string;
  userName?: string;
  className?: string;
};

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function InsightsPanel({
  elapsedSec,
  topic,
  side,
  userName,
  className,
}: InsightProps) {
  const { state: agentState } = useVoiceAssistant();

  const status = React.useMemo(() => {
    switch (agentState) {
      case "connecting":
        return { label: "Connecting…", dot: "bg-amber-500" };
      case "listening":
        return { label: "Listening", dot: "bg-emerald-500" };
      case "thinking":
        return { label: "Thinking…", dot: "bg-blue-500" };
      case "speaking":
        return { label: "Speaking", dot: "bg-violet-500" };
      default:
        return { label: "Idle", dot: "bg-muted-foreground" };
    }
  }, [agentState]);

  return (
    <aside
      className={cn(
        "hidden lg:block",
        "sticky top-16 h-[calc(100svh-6rem)]",
        "rounded-2xl border bg-card/70 backdrop-blur p-4",
        "overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs">
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </div>
        <div className="tabular-nums text-xs text-muted-foreground">
          {formatElapsed(elapsedSec)}
        </div>
      </div>

      {/* Divider */}
      <div className="my-4 h-px w-full bg-border" />

      {/* Session context */}
      <div className="space-y-2 text-sm">
        {userName && (
          <p className="text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">{userName}</span>
          </p>
        )}
        {topic && (
          <p className="text-muted-foreground">
            Topic:&nbsp;
            <span className="font-medium text-foreground">{topic}</span>
          </p>
        )}
        {side && (
          <p className="text-muted-foreground">
            Your side:&nbsp;
            <span className="font-medium uppercase">{side}</span>
          </p>
        )}
      </div>

      {/* Tips / Next actions */}
      <div className="mt-5 space-y-3">
        <h4 className="text-sm font-semibold">What to do next</h4>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="rounded-lg border p-2">
            Keep turns crisp (≈ 60s). Make 2–3 clear points.
          </li>
          <li className="rounded-lg border p-2">
            Use signposting:{" "}
            <span className="font-mono">“Point one… point two…”</span>
          </li>
          <li className="rounded-lg border p-2">
            For rebuttal: quote, clash, and weigh the impact.
          </li>
        </ul>
      </div>

      {/* Mini legend */}
      <div className="mt-6 rounded-xl border p-3">
        <h5 className="text-xs font-semibold mb-1">Legend</h5>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="rounded border p-2">Listening → You speak</div>
          <div className="rounded border p-2">
            Speaking → Coach/ Judge talks
          </div>
          <div className="rounded border p-2">Thinking → Brief pause</div>
          <div className="rounded border p-2">Timer → Session runtime</div>
        </div>
      </div>
    </aside>
  );
}
