// Shapes shared by the extractor (LLM) and the engine (code).

export const DOMAINS = [
  "fintech",
  "healthtech",
  "public_sector",
  "culture_immersive",
  "ecommerce_retail",
  "b2b_saas",
  "consumer_apps",
  "education",
  "food_cpg",
  "other",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const DISCIPLINES = [
  "product_design",
  "ux_research",
  "service_design",
  "strategy",
  "delivery",
  "engineering",
  "marketing",
  "other",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const METRIC_KINDS = [
  "before_after",
  "percent_change",
  "money",
  "rating",
  "count",
  "time",
] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

/** What the LLM returns. Every string must be copied from the CV. */
export interface ExtractedMetric {
  raw: string; // verbatim number phrase, e.g. "from under 5% to ~31%"
  kind: MetricKind;
  subject: string | null; // verbatim phrase naming what was measured
}

export interface ExtractedBullet {
  text: string;
  peopleSignals: string[];
  scopeSignals: string[];
  artefacts: string[];
  metrics: ExtractedMetric[];
  domain: Domain;
  discipline: Discipline;
}

export interface ExtractedRole {
  title: string;
  org: string;
  startYear: number | null;
  endYear: number | null;
  current: boolean;
  isEducation: boolean;
  bullets: ExtractedBullet[];
}

export interface Extraction {
  headline: string | null;
  statedYears: number | null;
  roles: ExtractedRole[];
}

/** After sanitising: one flat bullet with code-derived facts. */
export interface Metric extends ExtractedMetric {
  before: number | null;
  after: number | null;
  value: number | null;
  isPercent: boolean;
}

export interface Bullet {
  id: number;
  text: string;
  org: string;
  roleTitle: string;
  domain: Domain;
  discipline: Discipline;
  peopleSignals: string[];
  scopeSignals: string[];
  artefacts: string[];
  metrics: Metric[];
}

export interface ParsedCv {
  fileName: string;
  pages: number;
  text: string;
}
