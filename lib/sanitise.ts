// Anti-hallucination: everything the LLM returns must be literally in the CV.
import { parseMetric } from "./metrics";
import type { Bullet, Extraction } from "./types";
import { DISCIPLINES, DOMAINS } from "./types";

/** Lowercase, unify dashes/quotes/odd PDF characters, collapse whitespace. */
export function normalise(s: string): string {
  return s
    .replace(/[\u0002­‐‑‒–—―−]/g, "-")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[   ]/g, " ")
    .replace(/\s*-\s*\n\s*/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/** Bullet markers the LLM sometimes copies along with the text. */
export function stripMarker(s: string): string {
  return s.replace(/^[\s·•▪◦●○\-–—*>]+/, "").trim();
}

function words(s: string): string[] {
  return normalise(s)
    .replace(/[^a-z0-9%$£€.,/+~<>-]+/g, " ")
    .split(" ")
    // PDFs break "decision-making" as "decisionmaking" or "decision- making"; compare without hyphens.
    .map((t) => t.replace(/^[.,-]+|[.,-]+$/g, "").replace(/-/g, ""))
    .filter(Boolean);
}

/** Share of the bullet's 4-word windows that appear in the document. */
export function coverage(bullet: string, docWords: Set<string>): number {
  const w = words(bullet);
  if (w.length < 4) return docWords.has(w.join(" ")) ? 1 : 0;
  let hit = 0;
  const total = w.length - 3;
  for (let i = 0; i < total; i++) if (docWords.has(w.slice(i, i + 4).join(" "))) hit++;
  return hit / total;
}

export function shingles(doc: string): Set<string> {
  const w = words(doc);
  const set = new Set<string>();
  for (let i = 0; i + 4 <= w.length; i++) set.add(w.slice(i, i + 4).join(" "));
  for (let n = 1; n < 4; n++) for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(" "));
  return set;
}

const inBullet = (needle: string, bulletNorm: string) => {
  const n = normalise(needle);
  return n.length > 0 && bulletNorm.includes(n);
};

export interface SanitiseReport {
  bullets: Bullet[];
  droppedBullets: number;
  droppedFacts: number;
}

/**
 * Keeps a bullet only if at least 85% of it is found in the CV text.
 * Keeps a signal, artefact or metric only if it appears verbatim in its bullet.
 */
export function sanitise(extraction: Extraction, cvText: string): SanitiseReport {
  const docWords = shingles(cvText);
  const seen = new Set<string>();
  const bullets: Bullet[] = [];
  let droppedBullets = 0;
  let droppedFacts = 0;

  for (const role of extraction.roles ?? []) {
    if (role.isEducation) continue;
    for (const b of role.bullets ?? []) {
      const text = stripMarker(b.text ?? "");
      const norm = normalise(text);
      if (norm.split(" ").length < 4 || seen.has(norm)) {
        droppedBullets++;
        continue;
      }
      if (coverage(text, docWords) < 0.85) {
        droppedBullets++;
        continue;
      }
      seen.add(norm);

      const keep = (list: string[] | undefined) => {
        const kept = Array.from(new Set((list ?? []).filter((x) => inBullet(x, norm))));
        droppedFacts += (list?.length ?? 0) - kept.length;
        return kept;
      };

      const metrics = (b.metrics ?? [])
        .filter((m) => {
          const ok = inBullet(m.raw, norm);
          if (!ok) droppedFacts++;
          return ok;
        })
        .map((m) => ({ ...m, subject: m.subject && inBullet(m.subject, norm) ? m.subject : null }))
        .map(parseMetric)
        .filter((m): m is NonNullable<typeof m> => m !== null);

      bullets.push({
        id: bullets.length,
        text,
        org: role.org ?? "",
        roleTitle: role.title ?? "",
        domain: DOMAINS.includes(b.domain) ? b.domain : "other",
        discipline: DISCIPLINES.includes(b.discipline) ? b.discipline : "other",
        peopleSignals: keep(b.peopleSignals),
        scopeSignals: keep(b.scopeSignals),
        artefacts: keep(b.artefacts),
        metrics,
      });
    }
  }
  return { bullets, droppedBullets, droppedFacts };
}
