"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TranscriptItem = {
  id: string;
  role: "coach" | "user";
  text: string;
  createdAt?: Date | null;
};

type Props = {
  items: TranscriptItem[];
  loading?: boolean;
  defaultExpandedAll?: boolean;
};

export function TranscriptList({
  items,
  loading,
  defaultExpandedAll = false,
}: Props) {
  const [expandedAll, setExpandedAll] = React.useState(defaultExpandedAll);
  const [openMap, setOpenMap] = React.useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        Loading transcript…
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        No messages in this conversation yet.
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">
          Turns ({items.length})
        </div>
        <button
          className="rounded border px-2 py-1 text-xs hover:bg-accent/50"
          onClick={() => setExpandedAll((v) => !v)}
        >
          {expandedAll ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <ul className="divide-y divide-border">
        {items.map((m) => {
          const isOpen = expandedAll || !!openMap[m.id];
          const at = m.createdAt
            ? m.createdAt.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          return (
            <li
              key={m.id}
              className={cn(
                "grid grid-cols-[84px_1fr_64px] items-center gap-3 px-2 py-2 hover:bg-accent/30",
                "transition-colors",
              )}
              onClick={() => toggleRow(m.id)}
              role="button"
            >
              {/* Role chip */}
              <div className="flex items-center">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                    m.role === "user"
                      ? "border border-sky-500/40 text-sky-400"
                      : "border border-emerald-500/40 text-emerald-400",
                  )}
                >
                  {m.role === "user" ? "You" : "Coach"}
                </span>
              </div>

              {/* Text preview or full */}
              <div className={cn("text-xs text-foreground")}>
                <p
                  className={cn(
                    isOpen
                      ? "line-clamp-none whitespace-pre-wrap"
                      : "line-clamp-1",
                  )}
                >
                  {m.text}
                </p>
              </div>

              {/* Timestamp */}
              <div className="text-right font-mono text-[10px] text-muted-foreground">
                {at}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
