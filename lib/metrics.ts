import type { ExtractedMetric, Metric, MetricKind } from "./types";

const NUM_RE = /([$£€₹])?\s?(\d+(?:[.,]\d+)?)\s?(k|m|bn|b|million|billion|thousand)?\b\s?(%|x\b|×)?/gi;

const MULT: Record<string, number> = {
  k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9,
};

interface Num {
  value: number;
  percent: boolean;
  currency: boolean;
}

export function numbersIn(raw: string): Num[] {
  const out: Num[] = [];
  for (const m of raw.matchAll(NUM_RE)) {
    // "1,400" is a thousands separator; "6,1" is a decimal comma.
    const digits = /,\d{3}$/.test(m[2]) ? m[2].replace(",", "") : m[2].replace(",", ".");
    const base = parseFloat(digits);
    if (Number.isNaN(base)) continue;
    const mult = m[3] ? MULT[m[3].toLowerCase()] ?? 1 : 1;
    out.push({ value: base * mult, percent: m[4] === "%", currency: Boolean(m[1]) });
  }
  return out;
}

export function hasDigit(s: string): boolean {
  return /\d/.test(s);
}

/** Turns the LLM's verbatim number phrase into numbers. Code does the maths, not the model. */
export function parseMetric(m: ExtractedMetric): Metric | null {
  if (!hasDigit(m.raw)) return null;
  const nums = numbersIn(m.raw);
  if (nums.length === 0) return null;
  const isPercent = /%/.test(m.raw);
  const base: Metric = { ...m, before: null, after: null, value: null, isPercent };

  switch (m.kind) {
    case "before_after": {
      if (nums.length < 2) return { ...base, kind: isPercent ? "percent_change" : "count", value: nums[0].value };
      return { ...base, before: nums[0].value, after: nums[nums.length - 1].value };
    }
    case "rating": {
      const slash = m.raw.match(/(\d+(?:\.\d+)?)\s?\/\s?(\d+(?:\.\d+)?)/);
      if (slash) return { ...base, value: parseFloat(slash[1]) / parseFloat(slash[2]) };
      return { ...base, value: nums[0].value };
    }
    default:
      return { ...base, value: nums[0].value };
  }
}

const TIER: Record<MetricKind, number> = {
  before_after: 6,
  percent_change: 5,
  money: 4,
  rating: 3,
  count: 2,
  time: 1,
};

/** Percentage-point gain for % before→after, so small bases don't inflate the ranking. */
export function magnitude(m: Metric): number {
  if (m.kind === "before_after" && m.before !== null && m.after !== null) {
    if (m.isPercent) return Math.abs(m.after - m.before);
    const lo = Math.min(m.before, m.after) || 1;
    return Math.max(m.before, m.after) / lo;
  }
  return m.value ?? 0;
}

export function compareMetrics(a: Metric, b: Metric): number {
  const t = TIER[b.kind] - TIER[a.kind];
  if (t !== 0) return t;
  if (a.kind === "before_after" && a.isPercent !== b.isPercent) return a.isPercent ? -1 : 1;
  return magnitude(b) - magnitude(a);
}

/** Copy for a ratio, only ever shown next to the CV's own wording. */
export function jumpCopy(m: Metric): string | null {
  if (m.kind !== "before_after" || m.before === null || m.after === null) return null;
  if (m.isPercent) {
    const pp = Math.round(m.after - m.before);
    if (pp <= 0) return null;
    const ratio = m.before > 0 ? m.after / m.before : null;
    const ratioPart = ratio && ratio >= 2 ? `A ${Math.round(ratio)}× jump` : null;
    const ppPart = `+${pp} percentage points`;
    return ratioPart ? `${ratioPart} (${ppPart})` : ppPart;
  }
  return null;
}
