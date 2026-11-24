import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMetric } from "../lib/metrics";
import { sanitise } from "../lib/sanitise";
import type { Extraction } from "../lib/types";
import { EngineError, computeWrapped, validateRewrite } from "../lib/wrapped";

const cv = readFileSync(join(__dirname, "fixtures/devi-cv.txt"), "utf8");
const extraction = JSON.parse(readFileSync(join(__dirname, "fixtures/devi-extraction.json"), "utf8")) as Extraction;

function run(ex: Extraction = extraction, text = cv) {
  const report = sanitise(ex, text);
  return { report, wrapped: computeWrapped(ex, report.bullets, report, 2026) };
}

describe("sanitise", () => {
  it("drops a bullet that is not in the CV", () => {
    const { report } = run();
    expect(report.bullets.some((b) => b.text.includes("Monzo"))).toBe(false);
    expect(report.droppedBullets).toBe(1);
  });

  it("drops a metric that is not in its bullet", () => {
    const { report } = run();
    const companion = report.bullets.find((b) => b.text.startsWith("Designed a predictive"))!;
    expect(companion.metrics).toHaveLength(0);
  });

  it("matches across PDF hyphen breaks", () => {
    const { report } = run();
    expect(report.bullets.some((b) => b.text.includes("Social Value Activation Plan"))).toBe(true);
  });
});

describe("engine on Devi's CV", () => {
  const { wrapped } = run();

  it("is deterministic", () => {
    expect(run().wrapped).toEqual(wrapped);
  });

  it("prints the result", () => {
    console.log(JSON.stringify(wrapped, null, 2));
  });

  it("picks the walkthrough metric as the hero", () => {
    expect(wrapped.flex.hero?.raw).toBe("from under 5% to ~31%");
    expect(wrapped.flex.hero?.jump).toBe("A 6× jump (+26 percentage points)");
    // ranked by points, not ratio: under 1% -> 13% is 13x but only +12pp
    expect(wrapped.flex.runnersUp[0].raw).toBe("from under 1% to ~13%");
  });

  it("uses stated years and flags the dates disagree", () => {
    expect(wrapped.level.years).toBe(4);
    expect(wrapped.level.yearsSource).toBe("stated");
    expect(wrapped.level.datedYears).toBe(8);
  });

  it("picks the vague bullet as the rewrite target", () => {
    expect(wrapped.plotTwist.target?.text.startsWith("Solved the supply-side")).toBe(true);
  });
});

describe("edge cases", () => {
  it("throws TOO_SHORT under 5 bullets", () => {
    const short: Extraction = { ...extraction, roles: [{ ...extraction.roles[0], bullets: extraction.roles[0].bullets.slice(0, 3) }] };
    expect(() => run(short)).toThrow(EngineError);
  });

  it("works with no metrics at all", () => {
    const bare: Extraction = {
      ...extraction,
      roles: extraction.roles.map((r) => ({ ...r, bullets: r.bullets.map((b) => ({ ...b, metrics: [] })) })),
    };
    const { wrapped } = run(bare);
    expect(wrapped.flex.hero).toBeNull();
    expect(wrapped.archetype).toBeDefined();
  });

  it("parses numbers in code", () => {
    expect(parseMetric({ raw: "$4M", kind: "money", subject: null })?.value).toBe(4e6);
    expect(parseMetric({ raw: "6.1/7 satisfaction", kind: "rating", subject: null })?.value).toBeCloseTo(0.871, 2);
    expect(parseMetric({ raw: "1,400 users", kind: "count", subject: null })?.value).toBe(1400);
  });
});

describe("rewrite validation", () => {
  const original =
    "Solved the supply-side chicken-and-egg problem: GPs browse patient demand and build profiles before completing verification, with bookings locked until medical credentials are manually approved.";
  it("accepts a faithful rewrite", () => {
    expect(
      validateRewrite(original, "Designed a pre-verification flow: GPs browse demand and build profiles, with bookings locked until credentials are approved."),
    ).toBe(true);
  });
  it("rejects new numbers", () => {
    expect(validateRewrite(original, "Designed a pre-verification flow that onboarded 40 GPs.")).toBe(false);
  });
  it("rejects new names", () => {
    expect(validateRewrite(original, "Designed a pre-verification flow for Bupa GPs.")).toBe(false);
  });
  it("rejects long rewrites", () => {
    expect(validateRewrite(original, Array(30).fill("word").join(" "))).toBe(false);
  });
});

describe("verb counting", () => {
  it("ignores tool credits like 'Built with Next.js'", async () => {
    const { verbsIn } = await import("../lib/lexicon");
    expect(verbsIn("SplitClean: a bill app. Built with Claude API, deployed on Vercel.").map((v) => v.verb)).toEqual([]);
    expect(verbsIn("Built a payments service in Go.").map((v) => v.verb)).toEqual(["built"]);
  });
});
