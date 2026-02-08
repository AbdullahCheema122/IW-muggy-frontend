"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { seedSalesDiscovery } from "@/lib/roleplay/seed";
import { saveTemplate } from "@/lib/roleplay/db";
import type { RoleplayPersona, RoleplayVariable } from "@/lib/roleplay/types";
import { useRouter } from "next/navigation";

export default function BuilderPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("Untitled roleplay");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "org" | "public">("private");
  const [personas, setPersonas] = useState<RoleplayPersona[]>([
    {
      id: crypto.randomUUID(), // ✅ no uuid package
      name: "",
      role: "",
      personality: "",
      goals: "",
      objections: [],
      tone: "professional",
      enabled: true,
    },
  ]);
  const [variables, setVariables] = useState<RoleplayVariable[]>([
    { key: "company_name", label: "Company name", type: "text", required: true },
  ]);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!user?.uid) return;
    setSaving(true);
    const id = await saveTemplate({
      ownerId: user.uid,
      visibility,
      title,
      description,
      instructions: "Describe the scenario and what the user should try to achieve.",
      personas,
      variables,
      timeLimits: { rounds: 2, perTurnSec: 60 },
      rubric: { dimensions: ["data", "logic", "organization", "refutation", "style"], scale: 10 },
      tags: [],
    });
    setSaving(false);
    router.push(`/templates?created=${id}`);
  }

  async function onSeed() {
    if (!user?.uid) return;
    const id = await seedSalesDiscovery(user.uid);
    router.push(`/templates?seeded=${id}`);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roleplay Builder</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSeed}>Seed Sales Discovery</Button>
          <Button onClick={onSave} disabled={!user || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="rounded-xl border p-4">
          <h2 className="font-semibold mb-3">Basics</h2>
          <label className="block text-sm mb-1">Title</label>
          <input className="w-full rounded-md border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="block text-sm mt-4 mb-1">Description</label>
          <textarea className="w-full rounded-md border px-3 py-2" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="block text-sm mt-4 mb-1">Visibility</label>
          <select className="rounded-md border px-3 py-2" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
            <option value="private">Private</option>
            <option value="org">Organization</option>
            <option value="public">Public</option>
          </select>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="font-semibold mb-3">Personas</h2>
          <div className="space-y-4">
            {personas.map((p, i) => (
              <div key={p.id} className="rounded-lg border p-3 grid gap-2">
                <div className="flex gap-2">
                  <input className="flex-1 rounded-md border px-3 py-2" placeholder="Name" value={p.name} onChange={(e) => update(i, { ...p, name: e.target.value })} />
                  <input className="flex-1 rounded-md border px-3 py-2" placeholder="Role" value={p.role} onChange={(e) => update(i, { ...p, role: e.target.value })} />
                </div>
                <input className="rounded-md border px-3 py-2" placeholder="Personality" value={p.personality} onChange={(e) => update(i, { ...p, personality: e.target.value })} />
                <input className="rounded-md border px-3 py-2" placeholder="Goals" value={p.goals} onChange={(e) => update(i, { ...p, goals: e.target.value })} />
                <input
                  className="rounded-md border px-3 py-2"
                  placeholder="Objections (comma-separated)"
                  value={p.objections.join(", ")}
                  onChange={(e) => update(i, { ...p, objections: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.enabled !== false} onChange={(e) => update(i, { ...p, enabled: e.target.checked })} />
                  Enabled by default
                </label>
              </div>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() =>
              setPersonas((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  role: "",
                  personality: "",
                  goals: "",
                  objections: [],
                  tone: "professional",
                  enabled: true,
                },
              ])
            }
          >
            Add persona
          </Button>
        </section>

        <section className="rounded-xl border p-4">
          <h2 className="font-semibold mb-3">Variables</h2>
          {variables.map((v, i) => (
            <div key={v.key} className="mb-3 grid gap-2 md:grid-cols-3">
              <input
                className="rounded-md border px-3 py-2"
                placeholder="key (company_name)"
                value={v.key}
                onChange={(e) => setVariables(edit(variables, i, { ...v, key: e.target.value }))}
              />
              <input
                className="rounded-md border px-3 py-2"
                placeholder="Label"
                value={v.label}
                onChange={(e) => setVariables(edit(variables, i, { ...v, label: e.target.value }))}
              />
              <select
                className="rounded-md border px-3 py-2"
                value={v.type}
                onChange={(e) => setVariables(edit(variables, i, { ...v, type: e.target.value as any }))}
              >
                <option value="text">text</option>
                <option value="textarea">textarea</option>
                <option value="select">select</option>
              </select>
            </div>
          ))}
          <Button variant="outline" onClick={() => setVariables((prev) => [...prev, { key: "new_field", label: "New Field", type: "text" }])}>
            Add variable
          </Button>
        </section>
      </div>
    </main>
  );

  function update(index: number, next: RoleplayPersona) {
    setPersonas((arr) => arr.map((p, i) => (i === index ? next : p)));
  }
  function edit<T>(arr: T[], index: number, next: T) {
    return arr.map((it, i) => (i === index ? next : (it as any)));
  }
}