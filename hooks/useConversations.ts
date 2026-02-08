// hooks/useConversations.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Conversation } from "@/lib/types";

/**
 * Strongly guarded conversations listener:
 * - No listener unless uid is truthy AND we know auth is ready.
 * - Logs project & query once (helps spot project/rules mismatches).
 * - Falls back to a one-time getDocs when listener is denied.
 */
export function useConversations(userId?: string | null, authReady = true) {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const loggedOnce = useRef(false);

  // Only subscribe if we explicitly know auth state is ready
  const canSubscribe = useMemo(
    () => Boolean(authReady && userId),
    [authReady, userId],
  );

  useEffect(() => {
    if (!canSubscribe) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "conversations"),
      where("userId", "==", userId),
      orderBy("updatedAt", "desc"),
      limit(50),
    );

    // Helpful one-time log for debugging project/rules mismatches
    if (!loggedOnce.current) {
      loggedOnce.current = true;
      const projectId = db.app?.options?.projectId;
      console.debug(
        "[useConversations] projectId:",
        projectId,
        "userId:",
        userId,
      );
      console.debug(
        "[useConversations] query: conversations where userId == uid orderBy updatedAt desc limit 50",
      );
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Conversation, "id">),
          })),
        );
        setLoading(false);
      },
      async (err) => {
        console.error("[useConversations] onSnapshot error:", err);

        // If rules deny the live listener, try a one-time read.
        // If that also fails, it confirms a rules/data issue.
        try {
          const s = await getDocs(q);
          setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        } catch (e) {
          console.error("[useConversations] getDocs fallback also failed:", e);
        } finally {
          setLoading(false);
        }
      },
    );

    return unsub;
  }, [canSubscribe, userId]);

  const refresh = () => {}; // no-op to keep current API
  return { items, loading, refresh };
}
