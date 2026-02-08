"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine,
  LabelList,
} from "recharts";
import { Award, Gauge, Sparkles, Clipboard, Check } from "lucide-react";

/* ================================================
   Types
========================================================= */

export type TenScore = number; // 0–10
export type CatKey = "data" | "logic" | "organization" | "refutation" | "style";

export type AnalysisDoc = {
  id: string;
  judge?: string;
  scores?: Partial<Record<CatKey, TenScore>>;
  overall?: number | null;
  scoresExplicit?: boolean;
  rubric?: Partial<Record<CatKey, string>> & { overallText?: string };
  analysisText?: string;
  feedback?: string;
  quotes?: string[];
  createdAt?: any;
};

/* =========================================================
   Small helpers
========================================================= */

function isNum(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
function clamp10(n: number) {
  return Math.max(0, Math.min(10, n));
}
function avg10(vals: number[]): number | null {
  const good = vals.filter(isNum);
  if (good.length === 0) return null;
  const sum = good.reduce((a, b) => a + b, 0);
  return Math.round((sum / good.length) * 10) / 10;
}
function letterFrom10(n: number | null) {
  if (!isNum(n)) return "—";
  if (n >= 9.0) return "A";
  if (n >= 8.0) return "B";
  if (n >= 7.0) return "C";
  if (n >= 6.0) return "D";
  return "F";
}
function gradeColor(grade: string) {
  switch (grade) {
    case "A":
      return "bg-emerald-600/10 text-emerald-400 border-emerald-600/30";
    case "B":
      return "bg-teal-600/10 text-teal-400 border-teal-600/30";
    case "C":
      return "bg-indigo-600/10 text-indigo-400 border-indigo-600/30";
    case "D":
      return "bg-amber-600/10 text-amber-400 border-amber-600/30";
    default:
      return "bg-rose-600/10 text-rose-400 border-rose-600/30";
  }
}

/* =========================================================
   Parse explicit numbers (supports “out of 10” and “/10”)
========================================================= */

type Parsed = {
  scores: Partial<Record<CatKey, TenScore>>;
  explicitCount: number;
};

/** Accepts `### RUBRIC …` or just `RUBRIC …` on its own line */
const ANY_RUBRIC_BLOCK_RX =
  /(?:^|\n)\s*(?:#{1,6}\s*)?RUBRIC[^\n]*\n([\s\S]*?)$/i;

/** Optionally prefer a “User” sub-block, but fall back gracefully */
const USER_SUBBLOCK_RX =
  /(?:^|\n)\s*(?:User|You|CON|Proponent|Opponent)\b[^:\n]*:\s*([\s\S]*?)(?=(?:^|\n)\s*(?:Coach|Dan|PRO|Con|Assistant|Judge)\b[^:\n]*:|$)/i;

/** Lines like “Data & Evidence — 7 out of 10” OR “… 7/10” */
const RUBRIC_LINE_RX =
  /(Data\s*(?:&|and)\s*Evidence|Logic\s*(?:&|and)\s*Reasoning|Organization|Refutation|Rhetorical\s*Style|Overall)\s*[—\-–:]\s*(\d+(?:\.\d+)?)(?:\s*(?:\/\s*10|\s*out\s+of\s+10))/gi;

function parseRubricBlockPreferUser(text: string): Parsed {
  const bigBlock = ANY_RUBRIC_BLOCK_RX.exec(text)?.[1];
  if (!bigBlock) return { scores: {}, explicitCount: 0 };

  const userOnly = USER_SUBBLOCK_RX.exec(bigBlock)?.[1] ?? bigBlock;

  const map: Record<string, CatKey | "overall"> = {
    "data & evidence": "data",
    "data and evidence": "data",
    "logic & reasoning": "logic",
    "logic and reasoning": "logic",
    organization: "organization",
    refutation: "refutation",
    "rhetorical style": "style",
    overall: "overall",
  };

  const out: Parsed = { scores: {}, explicitCount: 0 };
  let m: RegExpExecArray | null;
  while ((m = RUBRIC_LINE_RX.exec(userOnly)) !== null) {
    const keyRaw = m[1].toLowerCase().replace(/\s+/g, " ").trim();
    const key = map[keyRaw];
    const val = clamp10(Number(m[2]));
    if (!key || !Number.isFinite(val)) continue;
    if (key !== "overall") {
      out.scores[key as CatKey] = val;
      out.explicitCount++;
    }
  }
  return out;
}

/** Fallback: scan near headings and pick first score-like value. Accepts `/10` or “out of 10”. */
const HEADINGS: Record<CatKey, RegExp[]> = {
  data: [/\bdata\s*(?:&|and)\s*evidence\b/i, /\bevidence\b/i],
  logic: [/\blogic\b/i, /\breasoning\b/i],
  organization: [/\borganization\b/i, /\borganisation\b/i, /\bstructure\b/i],
  refutation: [/\brefutation\b/i, /\brebuttal\b/i],
  style: [/\bstyle\b/i, /\brhetorical\b.*\bstyle\b/i, /\bdelivery\b/i],
};

const STRICT_SCORE =
  /\b(\d+(?:\.\d+)?)(?:\s*\/\s*(5|10)|\s*out\s+of\s+(5|10))\b/i;

function parseExplicitTen(feedback: string | undefined): Parsed {
  const text = (feedback || "").trim();
  if (!text) return { scores: {}, explicitCount: 0 };

  // 1) Try the rubric block first
  const fromBlock = parseRubricBlockPreferUser(text);
  if (fromBlock.explicitCount >= 3) return fromBlock;

  // 2) Nearby-headings fallback
  const out: Parsed = { scores: {}, explicitCount: 0 };

  const findFirstIdx = (rxs: RegExp[]) => {
    for (const r of rxs) {
      const m = r.exec(text);
      if (m) return m.index;
    }
    return -1;
  };

  const starts: Partial<Record<CatKey, number>> = {};
  (Object.keys(HEADINGS) as CatKey[]).forEach((k) => (starts[k] = findFirstIdx(HEADINGS[k])));

  const nextIdxs = Object.values(starts)
    .filter((n): n is number => isNum(n) && n >= 0)
    .sort((a, b) => a - b);

  const sliceBetween = (start: number) => {
    const end = nextIdxs.find((n) => n > start) ?? text.length;
    return text.slice(start, end);
  };

  (Object.keys(HEADINGS) as CatKey[]).forEach((k) => {
    const i = starts[k];
    if (!isNum(i) || i < 0) return;
    const window = sliceBetween(i).slice(0, 400);
    const m = window.match(STRICT_SCORE);
    if (!m) return;

    const raw = Number(m[1]);
    const denom = (m[2] || m[3] || "").trim();
    if (!Number.isFinite(raw)) return;

    const ten =
      denom === "5" ? raw * 2 :
      denom === "10" ? raw :
      raw <= 5 ? raw * 2 : raw;

    out.scores[k] = clamp10(ten);
    out.explicitCount += 1;
  });

  return out;
}

/* =========================================================
   GlowCard — soft pro gradient outline + emissive glow
========================================================= */

function GlowCard({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className="relative">
      {/* outer soft glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(60% 70% at 15% 10%, rgba(99,102,241,0.20), transparent 60%), radial-gradient(70% 80% at 85% 90%, rgba(34,211,238,0.16), transparent 60%)",
        }}
      />
      {/* gradient border wrapper */}
      <div className="relative rounded-2xl p-[1px] bg-[linear-gradient(135deg,rgba(99,102,241,0.45)_0%,rgba(168,85,247,0.25)_50%,rgba(34,211,238,0.45)_100%)]">
        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-card/70 backdrop-blur-md p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,0.12)]",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   UI
========================================================= */

export default function AnalysisClient({ data }: { data: AnalysisDoc }) {
  const gid = React.useId(); // unique IDs for chart gradients

  // Prefer stored numeric scores
  const storedScores = data.scores ?? {};
  const storedVals = (Object.values(storedScores) as number[]).filter(isNum);
  const storedOverall = isNum(data.overall) ? clamp10(data.overall) : null;
  const storedAvg = storedVals.length >= 3 ? avg10(storedVals) : null;

  // Else parse explicit digits from feedback text
  const rawText = data.analysisText || data.feedback || "";
  const parsed = React.useMemo(() => parseExplicitTen(rawText), [rawText]);
  const parsedVals = (Object.values(parsed.scores) as number[]).filter(isNum);
  const parsedAvg = parsedVals.length >= 3 ? avg10(parsedVals) : null;

  const useScores: Partial<Record<CatKey, TenScore>> =
    storedVals.length >= 3 ? storedScores : parsedVals.length >= 3 ? parsed.scores : {};

  const overall10 = storedOverall ?? storedAvg ?? parsedAvg ?? null;
  const grade = letterFrom10(overall10);

  const provenance =
    storedOverall != null || storedVals.length >= 3
      ? data.scoresExplicit
        ? "Explicit rubric detected"
        : "Saved scores"
      : parsedVals.length >= 3
      ? "Explicit rubric parsed"
      : "Feedback present (no numeric rubric)";

  // Palette
  const col = {
    primary: "#6366f1", // indigo
    accent: "#06b6d4", // cyan
    goodLine: "#10b981", // green
    grid: "rgba(148,163,184,0.25)",
  };

  // Data for charts
  const catOrder: { key: CatKey; label: string; icon: React.ReactNode }[] = [
    { key: "data", label: "Data & Evidence", icon: <Gauge className="h-4 w-4" /> },
    { key: "logic", label: "Logic & Reasoning", icon: <Sparkles className="h-4 w-4" /> },
    { key: "organization", label: "Organization", icon: <Award className="h-4 w-4" /> },
    { key: "refutation", label: "Refutation", icon: <Award className="h-4 w-4" /> },
    { key: "style", label: "Style/Delivery", icon: <Sparkles className="h-4 w-4" /> },
  ];

  const barsData = catOrder.map((c) => ({
    name: c.label,
    score: clamp10(Number((useScores as any)?.[c.key] ?? 0)),
    max: 10,
  }));

  const radarData = catOrder.map((c) => ({
    subject: c.label,
    A: clamp10(Number((useScores as any)?.[c.key] ?? 0)),
    fullMark: 10,
  }));

  // Timestamps
  const created =
    (data as any)?.createdAt?.toDate?.() ??
    ((data as any)?.createdAt?._seconds ? new Date((data as any).createdAt._seconds * 1000) : null);
  const createdWhen = created ? created.toLocaleString() : undefined;

  const judgeName = data.judge || "Judge Diane";

  // Copy feedback
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    if (!rawText) return;
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Meta header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {judgeName} • {provenance}
          {createdWhen ? ` • ${createdWhen}` : ""}
        </div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-accent/10"
          title="Copy full feedback"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy feedback"}
        </button>
      </div>

      {/* Hero row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {/* Donut + stats */}
        <GlowCard>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">OVERALL</div>
            <div className={cn("rounded-full border px-2 py-0.5 text-xs", gradeColor(grade))}>
              Grade {grade}
            </div>
          </div>

          <div className="mt-2 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="60%"
                outerRadius="100%"
                data={[
                  {
                    name: "Overall",
                    value: isNum(overall10) ? overall10 : 0,
                  },
                ]}
                startAngle={220}
                endAngle={-40}
              >
                <defs>
                  <linearGradient id={`${gid}-overall`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={col.primary} />
                    <stop offset="100%" stopColor={col.accent} />
                  </linearGradient>
                </defs>
                <RadialBar dataKey="value" background fill={`url(#${gid}-overall)`} cornerRadius={8} />
                <RTooltip formatter={(v: any) => `${v}/10`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>

          <div className="pointer-events-none -mt-12 mb-4 text-center">
            <div className="text-5xl font-bold tracking-tight">
              {isNum(overall10) ? overall10 : "—"}
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {catOrder.map((c) => {
              const v = clamp10(Number((useScores as any)?.[c.key] ?? 0));
              return (
                <div
                  key={c.key}
                  className="flex items-center justify-between rounded-xl border bg-card/60 px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {c.icon}
                    {c.label.split(" ")[0]}
                  </span>
                  <span className="font-semibold">{isNum(v) ? v : "—"}</span>
                </div>
              );
            })}
          </div>
        </GlowCard>

        {/* Bars */}
        <GlowCard>
          <div className="mb-3 text-sm text-muted-foreground">Category breakdown (0–10)</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barsData} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id={`${gid}-bars`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={col.accent} />
                    <stop offset="100%" stopColor={col.primary} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={col.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                <ReferenceLine y={8} stroke={col.goodLine} strokeDasharray="4 2" />
                <RTooltip formatter={(v: any, n: any) => [`${v}/10`, n]} />
                <Legend />
                <Bar dataKey="score" name="Score" radius={[8, 8, 0, 0]} fill={`url(#${gid}-bars)`}>
                  <LabelList dataKey="score" position="top" formatter={(v: any) => `${v}`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>
      </motion.div>

      {/* Radar + text blocks */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <GlowCard>
          <div className="mb-3 text-sm text-muted-foreground">Skill profile</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <defs>
                  <linearGradient id={`${gid}-radar`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={col.primary} />
                    <stop offset="100%" stopColor={col.accent} />
                  </linearGradient>
                </defs>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 10]} tickCount={6} />
                <Radar
                  name="Score"
                  dataKey="A"
                  stroke={col.primary}
                  fill={`url(#${gid}-radar)`}
                  fillOpacity={0.35}
                />
                <RTooltip formatter={(v: any) => `${v}/10`} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>

        <div className="space-y-4">
          <GlowCard>
            <div className="mb-2 text-sm font-semibold">Highlights</div>
            {Array.isArray(data.quotes) && data.quotes.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {data.quotes.map((q, i) => (
                  <li key={i}>&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">—</div>
            )}
          </GlowCard>

          <GlowCard>
            <div className="mb-2 text-sm font-semibold">What went well</div>
            <Bucket rubric={data.rubric} pick={["style", "data"]} />
            <div className="mt-4 h-px w-full bg-border" />
            <div className="mt-4 mb-2 text-sm font-semibold">What to improve next</div>
            <Bucket rubric={data.rubric} pick={["logic", "organization"]} />
          </GlowCard>
        </div>
      </motion.div>

      {/* Full feedback */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <GlowCard>
          <div className="mb-2 text-sm font-semibold">Full judge feedback</div>
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
            {rawText || "—"}
          </pre>
        </GlowCard>
      </motion.div>
    </div>
  );
}

/* =========================================================
   Small subcomponents
========================================================= */

function Bucket({
  rubric,
  pick,
}: {
  rubric?: Partial<Record<CatKey, string>> & { overallText?: string };
  pick: (CatKey | "overallText")[];
}) {
  const items = (pick || [])
    .map((k) => {
      const txt = (rubric as any)?.[k];
      if (!txt) return null;
      const header =
        k === "overallText"
          ? "Overall"
          : k === "data"
          ? "Data & Evidence"
          : k === "logic"
          ? "Logic & Reasoning"
          : k === "organization"
          ? "Organization"
          : k === "refutation"
          ? "Refutation"
          : "Style/Delivery";
      return { header, txt };
    })
    .filter(Boolean) as { header: string; txt: string }[];

  if (items.length === 0) return <div className="text-sm text-muted-foreground">—</div>;

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{it.header}</div>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">{it.txt}</div>
        </div>
      ))}
    </div>
  );
}
