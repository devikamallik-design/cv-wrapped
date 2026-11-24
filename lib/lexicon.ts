// Fixed verb lexicon. The axes are computed from these lists, never from the LLM.
// Only past-tense forms are listed, so nouns like "design" or "research" never count.

export type VerbFamily = "framing" | "making" | "people" | "impact";

const FAMILIES: Record<VerbFamily, string[]> = {
  framing: [
    "researched", "interviewed", "surveyed", "mapped", "diagnosed", "identified",
    "analysed", "analyzed", "synthesised", "synthesized", "framed", "reframed",
    "scoped", "defined", "conducted", "investigated", "audited", "assessed",
    "evaluated", "explored", "benchmarked", "discovered", "uncovered", "validated",
    "tested", "measured", "studied", "observed", "reviewed", "advised",
    "strategised", "strategized", "planned", "prioritised", "prioritized",
    "modelled", "modeled", "recommended", "proposed", "solved", "translated",
    "grounded", "examined", "specified", "documented",
  ],
  making: [
    "designed", "redesigned", "built", "rebuilt", "shipped", "delivered",
    "prototyped", "developed", "created", "launched", "implemented", "produced",
    "crafted", "wireframed", "illustrated", "coded", "engineered", "integrated",
    "structured", "established", "introduced", "automated", "deployed", "released",
    "animated", "wrote", "drafted", "made", "composed", "configured", "programmed",
    "contributed",
  ],
  people: [
    "led", "co-led", "managed", "coordinated", "facilitated", "mentored", "coached",
    "aligned", "collaborated", "presented", "negotiated", "partnered", "guided",
    "trained", "hired", "onboarded", "ran", "chaired", "owned", "supervised",
    "directed", "influenced", "worked", "supported", "helped", "taught",
  ],
  impact: [
    "increased", "reduced", "cut", "grew", "improved", "achieved", "boosted",
    "raised", "lowered", "saved", "doubled", "tripled", "accelerated", "decreased",
  ],
};

const VERB_TO_FAMILY = new Map<string, VerbFamily>();
for (const [family, verbs] of Object.entries(FAMILIES) as [VerbFamily, string[]][]) {
  for (const v of verbs) VERB_TO_FAMILY.set(v, family);
}

/** Lead verbs that say you were there, not what you did. Rewrite targets. */
export const VAGUE_VERBS = new Set([
  "solved", "worked", "helped", "supported", "contributed", "assisted",
  "handled", "participated", "ensured", "responsible", "involved", "managed",
]);

/** Words that mean other people were in the room. */
export const COLLABORATOR_WORDS = [
  "stakeholder", "stakeholders", "founder", "founders", "engineering", "engineers",
  "developers", "developer", "team", "teams", "client", "clients", "partners",
  "advisors", "students", "managers", "cross-functional", "workshop", "workshops",
  "co-developed", "co-designed", "together with", "panel", "leadership",
];

/** Phrases that signal scope, used for the level estimate. */
export const SCOPE_WORDS = [
  "sole", "end-to-end", "end to end", "led", "co-led", "owned", "from scratch",
  "cross-functional", "strategy", "roadmap", "mvp", "hiring", "budget",
  "multiple", "platforms", "programme", "program", "partnership", "regional",
  "global", "company-wide", "org-wide", "first-ever",
];

export function familyOf(word: string): VerbFamily | null {
  return VERB_TO_FAMILY.get(word.toLowerCase()) ?? null;
}

export interface VerbHit {
  verb: string; // lowercase lexicon form
  family: VerbFamily;
  lead: boolean;
}

const WORD_RE = /[A-Za-z][A-Za-z-]*/g;

// A past participle after these is an adjective ("through structured testing", "two structured workshops").
const ADJECTIVE_CONTEXT = new Set([
  "a", "an", "the", "through", "with", "via", "by", "of", "in", "for", "into", "on",
  "its", "their", "our", "my", "your", "fully", "highly", "well", "newly", "two", "three",
  "four", "five", "several", "multiple", "many",
]);

/** Finds lexicon verbs in a bullet. The lead verb is a lexicon verb within the first 3 words. */
export function verbsIn(text: string): VerbHit[] {
  const words = text.match(WORD_RE) ?? [];
  const seen = new Set<string>();
  const hits: VerbHit[] = [];
  let leadFound = false;
  words.forEach((w, i) => {
    const lower = w.toLowerCase();
    const family = familyOf(lower);
    if (!family || seen.has(lower)) return;
    const prev = i > 0 ? words[i - 1].toLowerCase() : "";
    if (i > 0 && ADJECTIVE_CONTEXT.has(prev)) return;
    // "Built with Next.js", "deployed on Vercel": tool credits, not actions.
    const next = (words[i + 1] ?? "").toLowerCase();
    if ((next === "with" || next === "on" || next === "using") && /^(built|made|deployed|developed|created|coded)$/.test(lower)) return;
    if (/\d\s*$/.test(text.slice(0, text.indexOf(w)))) return;
    seen.add(lower);
    const lead = !leadFound && i < 3;
    if (lead) leadFound = true;
    hits.push({ verb: lower, family, lead });
  });
  return hits;
}

export function leadVerb(text: string): VerbHit | null {
  return verbsIn(text).find((h) => h.lead) ?? null;
}

/** The first word of the bullet, lowercased, whether or not it's in the lexicon. */
export function firstWord(text: string): string {
  return (text.match(WORD_RE) ?? [""])[0].toLowerCase();
}

export function containsWord(haystack: string, needle: string): boolean {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, "i").test(haystack);
}

export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
