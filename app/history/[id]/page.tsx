// app/history/[id]/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Conversation, ConversationMessage } from "@/lib/types";

function groupBursts(items: ConversationMessage[], windowMs = 2000) {
  // Assumes items are sorted by time ascending
  const out: ConversationMessage[] = [];
  for (const m of items) {
    const text = (m.text ?? "").trim();
    if (!text) continue;

    const last = out[out.length - 1];
    const sameRole = last && last.role === m.role;
    const closeInTime = last
      ? Math.abs(new Date(m.at).getTime() - new Date(last.at).getTime()) <=
        windowMs
      : false;

    if (last && sameRole && closeInTime) {
      last.text = `${last.text} ${text}`.replace(/\s+/g, " ").trim();
      last.at = m.at; // extend the end time to the latest fragment
    } else {
      out.push({ ...m });
    }
  }
  return out;
}

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conv, setConv] = React.useState<Conversation | null>(null);
  const [msgs, setMsgs] = React.useState<ConversationMessage[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const c = await getDoc(doc(db, "conversations", id));
        if (!c.exists()) {
          router.replace("/");
          return;
        }
        setConv({ id: c.id, ...(c.data() as any) });

        const q = query(
          collection(db, "conversations", id, "messages"),
          orderBy("at", "asc"),
        );
        const snap = await getDocs(q);
        const raw: ConversationMessage[] = [];
        snap.forEach((d) => raw.push({ id: d.id, ...(d.data() as any) }));

        // Important: collapse token/fragment bursts into one natural bubble
        const grouped = groupBursts(raw, 2000);
        setMsgs(grouped);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading)
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          className="text-xs underline"
          onClick={() => router.back()}
        >
          &larr; Back
        </button>
        <div className="text-xs text-muted-foreground">
          {new Date(conv!.updatedAt).toLocaleString()}
        </div>
      </div>

      <h1 className="mb-6 text-xl font-semibold">{conv!.title}</h1>

      <div className="space-y-2">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl border p-3 ${m.role === "user" ? "ml-auto bg-muted" : "bg-card/70"}`}
          >
            <div className="mb-1 text-[10px] font-mono text-muted-foreground">
              {m.role === "user" ? "You" : "Coach"} •{" "}
              {new Date(m.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-6">
              {m.text}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
