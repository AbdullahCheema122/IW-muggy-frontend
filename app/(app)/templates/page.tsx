"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicTemplates, createInstance } from "@/lib/roleplay/db";
import type { RoleplayTemplate, RoleplayVariable } from "@/lib/roleplay/types";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";

export default function TemplatesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<RoleplayTemplate[]>([]);
  const [active, setActive] = useState<RoleplayTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await getPublicTemplates(false, user?.uid ?? "");
      setTemplates(list);
      setLoading(false);
    })();
  }, [user?.uid]);

  function openStart(t: RoleplayTemplate) {
    setActive(t);
    const init: Record<string, string> = {};
    t.variables.forEach(v => (init[v.key] = ""));
    setVars(init);
  }

  async function onBegin() {
    if (!active || !user?.uid) return;
    const id = await createInstance({ template: active, userId: user.uid, variables: vars });
    router.push(`/agentstarted?instance=${id}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Roleplay Templates</h1>
        <Button asChild><a href="/builder">Create template</a></Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border p-4 bg-card/70">
              <div className="font-semibold">{t.title}</div>
              <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</div>
              <div className="mt-3 flex flex-wrap gap-1">{t.tags?.map(tag => <span key={tag} className="text-[11px] rounded-full border px-2 py-0.5">{tag}</span>)}</div>
              <div className="mt-4">
                <Button className="w-full" onClick={()=>openStart(t)}>Start</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* quick start modal (minimal) */}
      {active && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Start: {active.title}</div>
              <button className="text-sm text-muted-foreground" onClick={()=>setActive(null)}>Close</button>
            </div>
            <div className="mt-3 grid gap-3">
              {active.variables.map((v) => (
                <VarInput key={v.key} v={v} value={vars[v.key] ?? ""} onChange={(val)=>setVars(prev=>({ ...prev, [v.key]: val }))}/>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={onBegin} disabled={!user}>Begin</Button>
              {!user && <div className="text-xs text-muted-foreground self-center">Sign in required</div>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function VarInput({
  v, value, onChange,
}: { v: RoleplayVariable; value: string; onChange: (v: string) => void }) {
  if (v.type === "textarea") {
    return (
      <label className="grid gap-1 text-sm">
        {v.label}{v.required && <span className="text-red-500">*</span>}
        <textarea rows={3} className="rounded-md border px-3 py-2" value={value} placeholder={v.placeholder} onChange={(e)=>onChange(e.target.value)} />
      </label>
    );
  }
  if (v.type === "select") {
    return (
      <label className="grid gap-1 text-sm">
        {v.label}{v.required && <span className="text-red-500">*</span>}
        <select className="rounded-md border px-3 py-2" value={value} onChange={(e)=>onChange(e.target.value)}>
          <option value="">Select…</option>
          {v.options?.map((o)=> <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  return (
    <label className="grid gap-1 text-sm">
      {v.label}{v.required && <span className="text-red-500">*</span>}
      <input className="rounded-md border px-3 py-2" value={value} placeholder={v.placeholder} onChange={(e)=>onChange(e.target.value)} />
    </label>
  );
}
