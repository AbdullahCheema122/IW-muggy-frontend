"use client";

import * as React from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TranscriptItem } from "@/app/history/TranscriptList";

export function useMessages(conversationId: string) {
  const [messages, setMessages] = React.useState<TranscriptItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!conversationId) return;
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: TranscriptItem[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const ts: Timestamp | undefined = data?.createdAt;
          return {
            id: d.id,
            role: (data?.role === "user" ? "user" : "coach") as
              | "user"
              | "coach",
            text: String(data?.text ?? ""),
            createdAt: ts?.toDate?.() ?? null,
          };
        });
        setMessages(rows);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [conversationId]);

  return { messages, loading };
}
