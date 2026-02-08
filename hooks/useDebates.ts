// hooks/useDebates.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, query, where, orderBy, limit,
  onSnapshot, getDocs, FirestoreError
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type DebateRow = any;

export function useDebates(userId?: string | null) {
  const [items, setItems]   = useState<DebateRow[]>([]);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState<FirestoreError | null>(null);
  const loggedOnce          = useRef(false);

  // ✅ only subscribe when we really have a uid
  const canSubscribe = useMemo(() => Boolean(userId), [userId]);

  useEffect(() => {
    if (!canSubscribe) { setItems([]); setLoad(false); setError(null); return; }

    setLoad(true);
    const q = query(
      collection(db, "debates"),          // <- the collection you save to which database
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    if (!loggedOnce.current) {
      loggedOnce.current = true;
      console.debug("[useDebates] subscribe analyses for", userId);
    }

    const unsub = onSnapshot(
      q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoad(false); setError(null);
      },
      async (err) => {
        console.error("[useDebates] onSnapshot error:", err);
        setError(err);
        // Fallback once (useful if rules block listeners in dev)
        try {
          const s = await getDocs(q);
          setItems(s.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
          console.error("[useDebates] getDocs fallback failed:", e);
        } finally {
          setLoad(false);
        }
      }
    );

    return unsub;
  }, [canSubscribe, userId]);

  return { items, loading, error };
}
