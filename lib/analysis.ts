// lib/analysis.ts
export type RubricKey =
  | "data"
  | "logic"
  | "organization"
  | "refutation"
  | "style";
export type RubricScores = Partial<Record<RubricKey, number>>;
export type RubricText = Partial<Record<RubricKey, string>> & {
  overallText?: string;
};

export type ParsedRubric = {
  scores: RubricScores; // 0–10
  scoresExplicit: boolean; // true if numbers were found in text
  overall: number | null; // average of available scores (0–10)
  rubric: RubricText; // narrative per section
  quotes: string[]; // 1–3 short bullets
};

// Accept many heading variants
const ALIASES: Record<RubricKey, RegExp[]> = {
  data: [
    /data\s*&\s*evidence/i,
    /data\s+and\s+evidence/i,
    /\bdata\b.*\bevidence\b/i,
    /\bevidence\b/i,
  ],
  logic: [/\blogic\b/i, /\breasoning\b/i],
  organization: [
    /\borganization\b/i,
    /\borganisation\b/i,
    /\bstructure\b/i,
    /\borg\b/i,
  ],
  refutation: [/\brefutation\b/i, /\brebuttal\b/i],
  style: [/\bstyle\b/i, /\brhetorical\b.*\bstyle\b/i, /\bdelivery\b/i],
};

const OVERALL_RX = /(overall\s+(feedback|evaluation|score))/i;
const SCORE_NEARBY_RX =
  /(?:(score|rating)?\s*[:\-]?\s*)?(\d{1,2}(?:\.\d+)?)(?:\s*\/\s*10)?\b/;

function clamp01(x: number, lo = 0, hi = 10) {
  return Math.max(lo, Math.min(hi, x));
}

function norm1d(v: number) {
  return Math.round(v * 10) / 10;
}

function sectionStartIdx(text: string, rxList: RegExp[]): number {
  for (const rx of rxList) {
    const m = rx.exec(text);
    if (m) return m.index;
  }
  return -1;
}

function sliceSection(
  text: string,
  start: number,
  nextStarts: number[],
): string {
  const ends = nextStarts.filter((n) => n > start);
  const end = ends.length ? Math.min(...ends) : text.length;
  return text.slice(start, end).trim();
}

function pickNearbyScore(snippet: string): number | null {
  // Look around the heading for 9, 8.6, 9/10, etc.
  const m = snippet.match(SCORE_NEARBY_RX);
  if (!m) return null;
  const v = parseFloat(m[2]);
  if (!isFinite(v)) return null;
  return clamp01(v);
}

const POS_WORDS = [
  "strong",
  "excellent",
  "clear",
  "effective",
  "compelling",
  "well",
  "good",
  "coherent",
  "organized",
  "insightful",
  "persuasive",
  "logical",
  "evidence",
  "data",
  "refute",
  "rebut",
];
const NEG_WORDS = [
  "weak",
  "unclear",
  "confusing",
  "poor",
  "lacking",
  "insufficient",
  "missing",
  "improve",
  "improvement",
  "disorganized",
  "rambling",
  "fallacy",
  "unsupported",
];

function estimateScoreFromText(s: string): number {
  const lower = s.toLowerCase();
  let pos = 0,
    neg = 0;
  for (const w of POS_WORDS) if (lower.includes(w)) pos++;
  for (const w of NEG_WORDS) if (lower.includes(w)) neg++;
  // Baseline 7.0, push up/down by simple signal; clamp 0–10
  const raw = 7 + (pos - neg) * 0.6 + (pos ? 0.3 : 0) - (neg ? 0.3 : 0);
  return clamp01(norm1d(raw));
}

function extractQuotes(t: string): string[] {
  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const good = lines.filter((l) => l.length > 40 && l.length < 140).slice(0, 3);
  return good;
}

export function computeRubric(feedback: string): ParsedRubric {
  const text = feedback || "";
  const starts: Partial<Record<RubricKey, number>> = {};
  (Object.keys(ALIASES) as RubricKey[]).forEach((k) => {
    starts[k] = sectionStartIdx(text, ALIASES[k]);
  });

  // Gather sections
  const indices = (
    Object.values(starts).filter(
      (n) => typeof n === "number" && n! >= 0,
    ) as number[]
  ).sort((a, b) => a - b);
  const rubric: RubricText = {};
  (Object.keys(ALIASES) as RubricKey[]).forEach((k) => {
    const s = starts[k];
    if (s == null || s < 0) return;
    rubric[k] = sliceSection(text, s, indices);
  });

  // Overall text if present
  const overallIdx = text.search(OVERALL_RX);
  if (overallIdx >= 0) {
    const after = text.slice(overallIdx);
    const next = indices.find((i) => i > overallIdx) ?? text.length;
    rubric.overallText = text.slice(overallIdx, next).trim();
  }

  // Try explicit numeric scores near headings
  const scores: RubricScores = {};
  let explicitCount = 0;
  (Object.keys(ALIASES) as RubricKey[]).forEach((k) => {
    const s = starts[k];
    if (s == null || s < 0) return;
    const window = text.slice(Math.max(0, s - 140), s + 260);
    const val = pickNearbyScore(window);
    if (val != null) {
      scores[k] = norm1d(val);
      explicitCount++;
    }
  });

  // If no explicit numbers, estimate from section text (so you still show numbers)
  if (explicitCount === 0) {
    (Object.keys(ALIASES) as RubricKey[]).forEach((k) => {
      const body = rubric[k];
      if (body) scores[k] = estimateScoreFromText(body);
    });
  }

  const present = Object.values(scores).filter(
    (v) => typeof v === "number",
  ) as number[];
  const overall = present.length
    ? norm1d(present.reduce((a, b) => a + b, 0) / present.length)
    : null;

  // Quotes for Highlights
  const quotes = extractQuotes(text);

  return {
    scores,
    scoresExplicit: explicitCount > 0,
    overall,
    rubric,
    quotes,
  };
}
