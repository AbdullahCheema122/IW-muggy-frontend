"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AnalysisClient, { AnalysisDoc } from "./AnalysisClient";
import { Button } from "@/components/ui/button";

export default function AnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AnalysisDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const id = useMemo(
    () => (Array.isArray(params?.id) ? params.id[0] : params?.id),
    [params],
  );

  useEffect(() => {
    let abort = false;
    async function run() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "analyses", id));
        if (abort) return;
        if (snap.exists()) {
          const raw = snap.data() as any;
          const analysisText =
            raw.analysisText ?? raw.feedbackRaw ?? raw.feedback ?? "";
          const judge = raw.judge || "Judge Diane";
          const hydrated: AnalysisDoc = {
            id: snap.id,
            ...raw,
            judge,
            analysisText,
          };
          setData(hydrated);
        } else {
          setData(null);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    run();
    return () => {
      abort = true;
    };
  }, [id]);

  return (
    <main className="w-full max-w-none px-3 sm:px-4 lg:px-6 py-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-base font-semibold">Your Analysis</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            BACK TO DASHBOARD
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            BACK
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card/70 p-6">Loading…</div>
      ) : !data ? (
        <div className="rounded-2xl border bg-card/70 p-6">
          Couldn’t find that analysis.
        </div>
      ) : (
        <AnalysisClient data={data} />
      )}
    </main>
  );
}
