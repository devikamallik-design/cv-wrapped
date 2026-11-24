// The engine. Takes sanitised bullets and decides every card. No LLM in here.
import { ARCHETYPES, type Archetype } from "./archetypes";
import {
  COLLABORATOR_WORDS,
  SCOPE_WORDS,
  VAGUE_VERBS,
  type VerbFamily,
  capitalise,
  containsWord,
  firstWord,
  verbsIn,
} from "./lexicon";
import { compareMetrics, jumpCopy } from "./metrics";
import { normalise } from "./sanitise";
import type { Bullet, Discipline, Domain, Extraction, Metric } from "./types";

export class EngineError extends Error {
  constructor(public code: "TOO_SHORT", message: string) {
    super(message);
  }
}

export const MIN_BULLETS = 5;

export const DOMAIN_LABEL: Record<Domain, string> = {
  fintech: "Fintech & banking",
  healthtech: "HealthTech",
  public_sector: "Government & public sector",
  culture_immersive: "Museums, culture & immersive",
  ecommerce_retail: "E-commerce & retail",
  b2b_saas: "B2B SaaS",
  consumer_apps: "Consumer apps",
  education: "Education",
  food_cpg: "Food & consumer goods",
  other: "General",
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  product_design: "product design",
  ux_research: "research",
  service_design: "service design",
  strategy: "strategy",
  delivery: "delivery and programme management",
  engineering: "engineering",
  marketing: "marketing",
  other: "other work",
};

const DISCIPLINE_TITLE: Record<Discipline, string | null> = {
  product_design: "Product Designer",
  ux_research: "UX Researcher",
  service_design: "Service Designer",
  strategy: "Product Strategist",
  delivery: "Programme Manager",
  engineering: "Engineer",
  marketing: "Marketer",
  other: null,
};

// ---------- output types ----------

export interface Axis {
  value: number; // 0 = left pole, 1 = right pole
  left: string;
  right: string;
  winner: string;
  nearMiddle: boolean;
  caption: string;
  evidence: string;
}

export interface FlexItem {
  raw: string;
  subject: string | null;
  org: string;
  jump: string | null;
  bullet: string;
}

export interface Receipt {
  text: string;
  org: string;
}

export interface RoleFit {
  title: string;
  domain: string;
  seniority: string;
  evidence: number;
}

export interface PlotTwist {
  rule: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  fixLabel: string;
  target: { text: string; org: string } | null;
}

export interface Wrapped {
  read: {
    headline: string | null;
    bullets: number;
    orgs: string[];
    droppedBullets: number;
    droppedFacts: number;
  };
  numbers: {
    bullets: number;
    withNumbers: number;
    withArtefacts: number;
    withPeople: number;
  };
  axes: { making: Axis; wide: Axis; crowd: Axis };
  archetype: Archetype;
  receipts: Receipt[];
  topVerbs: { verb: string; count: number; family: VerbFamily }[];
  flex: { hero: FlexItem | null; runnersUp: FlexItem[] };
  level: {
    stage: string;
    seniority: string;
    years: number | null;
    yearsSource: "stated" | "dates" | "unknown";
    datedYears: number | null;
    bumped: boolean;
    scopeSignals: string[];
  };
  roles: RoleFit[];
  plotTwist: PlotTwist;
}

// ---------- helpers ----------

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

function hasPeople(b: Bullet): boolean {
  if (b.peopleSignals.length > 0) return true;
  if (verbsIn(b.text).some((v) => v.family === "people")) return true;
  return COLLABORATOR_WORDS.some((w) => containsWord(b.text, w));
}

function makeAxis(value: number, left: string, right: string, evidence: string): Axis {
  const v = round2(clamp(value));
  const nearMiddle = Math.abs(v - 0.5) <= 0.05;
  const winner = v >= 0.5 ? right : left;
  const loser = v >= 0.5 ? left : right;
  return {
    value: v,
    left,
    right,
    winner,
    nearMiddle,
    caption: nearMiddle
      ? "Right in the middle."
      : winner === "Wide"
        ? "Wider than deep."
        : winner === "Deep"
          ? "Deeper than wide."
          : `More ${winner.toLowerCase()} than ${loser.toLowerCase()}.`,
    evidence,
  };
}

function counts<T extends string>(items: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

function headlineDiscipline(headline: string | null): Discipline | null {
  if (!headline) return null;
  const h = headline.toLowerCase();
  if (/service design/.test(h)) return "service_design";
  if (/research/.test(h)) return "ux_research";
  if (/strateg/.test(h)) return "strategy";
  if (/product|ux|ui|interaction|designer|design/.test(h)) return "product_design";
  if (/engineer|developer/.test(h)) return "engineering";
  if (/programme|program|delivery|project manager/.test(h)) return "delivery";
  if (/market/.test(h)) return "marketing";
  return null;
}

/** Years covered by dated, non-education roles, merging overlaps. */
export function datedYears(extraction: Extraction, thisYear: number): number | null {
  const spans = extraction.roles
    .filter((r) => !r.isEducation && r.startYear)
    .map((r) => [r.startYear as number, r.current ? thisYear : (r.endYear ?? (r.startYear as number))] as const)
    .filter(([s, e]) => e >= s && s > 1950)
    .sort((a, b) => a[0] - b[0]);
  if (spans.length === 0) return null;
  let total = 0;
  let [cs, ce] = spans[0];
  for (const [s, e] of spans.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else {
      total += ce - cs;
      [cs, ce] = [s, e];
    }
  }
  total += ce - cs;
  return Math.max(total, 0);
}

const STAGES = ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"] as const;
const THRESHOLDS = [1, 2, 4, 8];
const SENIORITY: Record<(typeof STAGES)[number], string> = {
  Novice: "entry-level",
  "Advanced Beginner": "junior",
  Competent: "mid-level",
  Proficient: "mid–senior",
  Expert: "senior",
};

function scopeSignalsOf(bullets: Bullet[]): string[] {
  const set = new Set<string>();
  for (const b of bullets) {
    for (const s of b.scopeSignals) set.add(normalise(s));
    for (const w of SCOPE_WORDS) if (containsWord(b.text, w)) set.add(w);
  }
  return Array.from(set);
}

function trimWords(text: string, max: number): string {
  const w = text.split(/\s+/);
  return w.length <= max ? text : `${w.slice(0, max).join(" ").replace(/[,;:]$/, "")}…`;
}

function flexItem(m: Metric, b: Bullet): FlexItem {
  return { raw: m.raw, subject: m.subject, org: b.org, jump: jumpCopy(m), bullet: b.text };
}

// ---------- the engine ----------

export function computeWrapped(
  extraction: Extraction,
  bullets: Bullet[],
  report: { droppedBullets: number; droppedFacts: number },
  thisYear = new Date().getFullYear(),
): Wrapped {
  if (bullets.length < MIN_BULLETS && report.droppedBullets >= MIN_BULLETS) {
    throw new EngineError(
      "TOO_SHORT",
      "The reading didn't match the text in your file, so we stopped instead of showing you wrong results. Try again.",
    );
  }
  if (bullets.length < MIN_BULLETS) {
    throw new EngineError(
      "TOO_SHORT",
      `We could only read ${bullets.length} bullet point${bullets.length === 1 ? "" : "s"} from this file. Upload a CV with at least ${MIN_BULLETS}.`,
    );
  }
  const n = bullets.length;

  // Framing ↔ Making, from the fixed lexicon. Lead verb weighs 1, others 0.5.
  let framing = 0;
  let making = 0;
  const verbTally = new Map<string, { count: number; leads: number; family: VerbFamily }>();
  for (const b of bullets) {
    for (const v of verbsIn(b.text)) {
      const w = v.lead ? 1 : 0.5;
      if (v.family === "framing") framing += w;
      if (v.family === "making") making += w;
      const t = verbTally.get(v.verb) ?? { count: 0, leads: 0, family: v.family };
      t.count += 1;
      if (v.lead) t.leads += 1;
      verbTally.set(v.verb, t);
    }
  }
  const makingAxis = makeAxis(
    framing + making === 0 ? 0.5 : making / (framing + making),
    "Framing",
    "Making",
    `Making verbs like designed and shipped score ${making}. Framing verbs like scoped and diagnosed score ${framing}.`,
  );

  // Deep ↔ Wide: domains and disciplines with at least 2 bullets each.
  const domainCounts = counts<Domain>(bullets.map((b) => b.domain).filter((d) => d !== "other"));
  const discCounts = counts<Discipline>(bullets.map((b) => b.discipline).filter((d) => d !== "other"));
  const strongDomains = [...domainCounts].filter(([, c]) => c >= 2).map(([d]) => d);
  const strongDiscs = [...discCounts].filter(([, c]) => c >= 2).map(([d]) => d);
  const dN = Math.max(strongDomains.length, 1);
  const pN = Math.max(strongDiscs.length, 1);
  const wideAxis = makeAxis(
    0.5 * ((dN - 1) / 3) + 0.5 * ((pN - 1) / 3),
    "Deep",
    "Wide",
    `${strongDomains.length} domain${strongDomains.length === 1 ? "" : "s"} (${strongDomains.map((d) => DOMAIN_LABEL[d]).join(", ") || "none"}) and ${strongDiscs.length} discipline${strongDiscs.length === 1 ? "" : "s"} (${strongDiscs.map((d) => DISCIPLINE_LABEL[d]).join(", ") || "none"}) with 2+ bullets each.`,
  );

  // Solo ↔ Crowd: share of bullets with other people in them. 10% -> 0, 70% -> 1.
  const withPeople = bullets.filter(hasPeople).length;
  const crowdAxis = makeAxis(
    (withPeople / n - 0.1) / 0.6,
    "Solo",
    "Crowd",
    `${withPeople} of your ${n} bullets involve other people.`,
  );

  const key = `${makingAxis.value >= 0.5 ? 1 : 0}${wideAxis.value >= 0.5 ? 1 : 0}${crowdAxis.value >= 0.5 ? 1 : 0}`;
  const archetype = ARCHETYPES[key];

  // Receipts: bullets that most clearly show the winning poles, from different orgs.
  const scored = bullets
    .map((b) => {
      const vs = verbsIn(b.text);
      const pole = key[0] === "1" ? "making" : "framing";
      let s = vs.filter((v) => v.family === pole).length * 2;
      s += key[2] === "1" ? (hasPeople(b) ? 2 : 0) : hasPeople(b) ? 0 : 2;
      s += b.artefacts.length > 0 ? 1 : 0;
      s += b.metrics.length > 0 ? 1 : 0;
      return { b, s };
    })
    .sort((a, b) => b.s - a.s || a.b.id - b.b.id);
  const receipts: Receipt[] = [];
  const usedOrgs = new Set<string>();
  for (const { b } of scored) {
    if (receipts.length === 3) break;
    if (usedOrgs.has(b.org)) continue;
    usedOrgs.add(b.org);
    receipts.push({ text: trimWords(b.text, 18), org: b.org });
  }
  for (const { b } of scored) {
    if (receipts.length === 3) break;
    if (!receipts.some((r) => r.text === trimWords(b.text, 18))) receipts.push({ text: trimWords(b.text, 18), org: b.org });
  }

  const topVerbs = [...verbTally]
    .map(([verb, t]) => ({ verb: capitalise(verb), count: t.count, leads: t.leads, family: t.family }))
    // Ties go to the verb that opens more bullets: that's the one a skimmer reads.
    .sort((a, b) => b.count - a.count || b.leads - a.leads || a.verb.localeCompare(b.verb))
    .map(({ verb, count, family }) => ({ verb, count, family }))
    .slice(0, 5);

  // Biggest flex.
  const allMetrics = bullets.flatMap((b) => b.metrics.map((m) => ({ m, b })));
  allMetrics.sort((a, b) => compareMetrics(a.m, b.m) || a.b.id - b.b.id);
  const flex = {
    hero: allMetrics[0] ? flexItem(allMetrics[0].m, allMetrics[0].b) : null,
    runnersUp: allMetrics.slice(1, 3).map(({ m, b }) => flexItem(m, b)),
  };

  // Level (Dreyfus, estimated).
  const dated = datedYears(extraction, thisYear);
  const stated = extraction.statedYears && extraction.statedYears > 0 ? extraction.statedYears : null;
  const years = stated ?? dated;
  const scope = scopeSignalsOf(bullets);
  let stageIdx = years === null ? 2 : THRESHOLDS.filter((t) => years >= t).length;
  let bumped = false;
  if (years !== null && stageIdx < 4 && THRESHOLDS[stageIdx] - years <= 1 && scope.length >= 4) {
    stageIdx += 1;
    bumped = true;
  }
  const stage = STAGES[stageIdx];
  const seniority = SENIORITY[stage];

  // Roles: discipline × domain pairs, ranked by evidence.
  const pairCounts = counts(
    bullets
      .filter((b) => b.discipline !== "other" && DISCIPLINE_TITLE[b.discipline])
      .map((b) => `${b.discipline}|${b.domain}` as const),
  );
  const roles: RoleFit[] = [...pairCounts]
    .sort((a, b) => {
      const d = b[1] - a[1];
      if (d !== 0) return d;
      const [da] = a[0].split("|") as [Discipline];
      const [db] = b[0].split("|") as [Discipline];
      return (discCounts.get(db) ?? 0) - (discCounts.get(da) ?? 0);
    })
    .slice(0, 3)
    .map(([pair, c]) => {
      const [disc, dom] = pair.split("|") as [Discipline, Domain];
      return {
        title: DISCIPLINE_TITLE[disc] as string,
        domain: DOMAIN_LABEL[dom],
        seniority,
        evidence: c,
      };
    });

  // Plot twist: first rule that fires.
  const withNumbers = bullets.filter((b) => /\d/.test(b.text)).length;
  const withArtefacts = bullets.filter((b) => b.artefacts.length > 0).length;
  const hDisc = headlineDiscipline(extraction.headline);
  const headline = extraction.headline?.trim() || null;
  const isDesignHeadline = hDisc === "product_design" || hDisc === "service_design";
  const top = topVerbs[0];
  const hCount = hDisc ? bullets.filter((b) => b.discipline === hDisc).length : 0;

  let plotTwist: PlotTwist;
  if (isDesignHeadline && top && (top.family === "people" || top.family === "framing") && withArtefacts / n < 0.35) {
    plotTwist = {
      rule: 1,
      title: `Your headline says ${headline}. Your top verb is “${top.verb}”.`,
      body: `Only ${withArtefacts} of your ${n} bullets name something you made. Recruiters scanning for design work will look for the artefact first.`,
      fixLabel: "Easy fix: say what you designed",
      target: null,
    };
  } else if (hDisc && headline && hCount / n < 0.6) {
    const others = [...discCounts]
      .filter(([d]) => d !== hDisc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([d]) => DISCIPLINE_LABEL[d]);
    plotTwist = {
      rule: 2,
      title: `Your headline says ${headline}. Only ${hCount} of your ${n} bullets are about it.`,
      body: others.length
        ? `The rest is ${others.join(" and ")}. That's not wrong, but a recruiter skimming for ${DISCIPLINE_LABEL[hDisc]} sees it less than you think.`
        : `The rest doesn't map to a clear discipline yet.`,
      fixLabel: isDesignHeadline ? "Easy fix: say what you designed" : "Easy fix: lead with what you made",
      target: null,
    };
  } else if (withNumbers / n < 0.25) {
    plotTwist = {
      rule: 3,
      title: `Only ${withNumbers} of your ${n} bullets have a number in them.`,
      body: "Numbers are what people remember after one skim. You probably know more of them than you've written down.",
      fixLabel: "Easy fix: say what you made, then what changed",
      target: null,
    };
  } else {
    plotTwist = {
      rule: 4,
      title: "No plot twist. Your headline and your bullets tell the same story.",
      body: "That's rarer than it sounds. One bullet could still work harder, though.",
      fixLabel: "Small upgrade",
      target: null,
    };
  }

  // Rewrite target: vague lead verb and no named artefact.
  const vague = (b: Bullet) => {
    const fw = firstWord(b.text);
    return VAGUE_VERBS.has(fw) || !verbsIn(b.text).some((v) => v.lead);
  };
  const target =
    bullets.find((b) => vague(b) && b.artefacts.length === 0) ?? bullets.find(vague) ?? null;
  plotTwist.target = target ? { text: target.text, org: target.org } : null;

  return {
    read: {
      headline,
      bullets: n,
      orgs: Array.from(new Set(bullets.map((b) => b.org).filter(Boolean))),
      droppedBullets: report.droppedBullets,
      droppedFacts: report.droppedFacts,
    },
    numbers: { bullets: n, withNumbers, withArtefacts, withPeople },
    axes: { making: makingAxis, wide: wideAxis, crowd: crowdAxis },
    archetype,
    receipts,
    topVerbs,
    flex,
    level: {
      stage,
      seniority,
      years,
      yearsSource: stated ? "stated" : dated !== null ? "dates" : "unknown",
      datedYears: dated,
      bumped,
      scopeSignals: scope,
    },
    roles,
    plotTwist,
  };
}

/** A rewrite may not add numbers, names or length. */
export function validateRewrite(original: string, rewrite: string): boolean {
  const r = rewrite.trim();
  if (!r) return false;
  const words = r.split(/\s+/);
  if (words.length > 24) return false;
  const origNorm = normalise(original);
  const nums = r.match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (nums.some((x) => !origNorm.includes(x))) return false;
  const proper = words.slice(1).filter((w) => /^[A-Z][a-z]/.test(w.replace(/^[^A-Za-z]+/, "")));
  if (proper.some((w) => !origNorm.includes(normalise(w.replace(/[^A-Za-z-]/g, ""))))) return false;
  return normalise(r) !== origNorm;
}
