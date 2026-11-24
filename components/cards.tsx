"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { AnalyseResponse } from "@/lib/api-types";
import type { Axis, Wrapped } from "@/lib/wrapped";

type Ok = Extract<AnalyseResponse, { ok: true }>;
export type Tone = "cream" | "orange" | "ink" | "lime" | "pink" | "blue";

export interface CardDef {
  key: string;
  label: string;
  tone: Tone;
  node: React.ReactNode;
}

/** The restart action, provided by the page so cards never hold a function in render. */
export const RestartContext = createContext<() => void>(() => {});

function RestartButton({ className, children }: { className: string; children: React.ReactNode }) {
  const restart = useContext(RestartContext);
  return (
    <button className={className} onClick={restart}>
      {children}
    </button>
  );
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const animalSrc = (w: Wrapped) => `/animals/${w.archetype.animal.toLowerCase()}.webp`;

/** "from under 5% to ~31%" -> ["under 5%", "~31%"], so the result can be the big number. */
function splitChange(raw: string): [string, string] | null {
  const m = raw.replace(/^from\s+/i, "").match(/^(.*?)\s+(?:to|→|->)\s+(.*)$/i);
  return m ? [m[1], m[2]] : null;
}

const STAGES = ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"];
const STAGE_LINE: Record<string, string> = {
  Novice: "you follow the playbook and follow it well.",
  "Advanced Beginner": "you spot the patterns and need less hand-holding.",
  Competent: "you plan your own work and own the result.",
  Proficient: "you own outcomes end to end, not just tasks.",
  Expert: "you work on instinct, and others learn from how you do it.",
};

function Spectrum({ axis }: { axis: Axis }) {
  const leftWins = axis.value < 0.5;
  return (
    <div className="spectrum">
      <div className="ends t-lg">
        <span data-win={!axis.nearMiddle && leftWins}>{axis.left}</span>
        <span data-win={!axis.nearMiddle && !leftWins}>{axis.right}</span>
      </div>
      <div className="track" role="img" aria-label={`${axis.left} to ${axis.right}: ${Math.round(axis.value * 100)}%`}>
        {[0, 25, 50, 75, 100].map((p) => (
          <span className="tick" key={p} style={{ left: `calc(${p}% - ${p === 100 ? 1.5 : 0}px)` }} />
        ))}
        <span className="dot" style={{ left: `${axis.value * 100}%` }} />
      </div>
      <p className="serif t-lg">{axis.caption}</p>
      <p className="t-xs muted">{axis.evidence}</p>
    </div>
  );
}

function Summary({ w, rewrite }: { w: Wrapped; rewrite: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  async function download() {
    if (!ref.current) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(ref.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-wrapped-${w.archetype.animal.toLowerCase()}.png`;
      a.click();
    } finally {
      setSaving(false);
    }
  }

  const shape = [w.axes.making, w.axes.wide, w.axes.crowd].map((a) => (a.nearMiddle ? "Balanced" : a.winner)).join(" · ");

  return (
    <>
      <h2 className="display t-3xl">That&apos;s a wrap.</h2>
      <div className="share" ref={ref}>
        <div className="share-head">
          {/* eslint-disable-next-line @next/next/no-img-element -- html-to-image needs a plain img */}
          <img src={animalSrc(w)} alt="" />
          <div>
            <p className="display t-xl">I&apos;m a {w.archetype.animal}.</p>
            <p className="serif t-lg">{w.archetype.tagline}.</p>
          </div>
        </div>
        <div className="share-grid t-sm">
          <div>
            <p className="kicker">Top verbs</p>
            <ol>
              {w.topVerbs.slice(0, 3).map((v, i) => (
                <li key={v.verb}>
                  {i + 1} {v.verb}
                </li>
              ))}
            </ol>
          </div>
          {w.flex.hero && (
            <div>
              <p className="kicker">Biggest flex</p>
              <p className="display t-lg">
                {(() => {
                  const sp = splitChange(w.flex.hero.raw);
                  return sp ? `${sp[0].replace(/^under\s+/i, "<")} → ${sp[1]}` : w.flex.hero.raw;
                })()}
              </p>
              {w.flex.hero.subject && <p className="t-xs">{w.flex.hero.subject}</p>}
            </div>
          )}
        </div>
        <div>
          <p className="kicker">Shape</p>
          <p className="t-sm" style={{ fontWeight: 700 }}>
            {shape}
          </p>
        </div>
        <div className="share-foot">
          <span>CV Wrapped</span>
          <span>{w.roles[0] ? `${w.roles[0].title}, ${w.roles[0].domain}` : ""}</span>
        </div>
      </div>
      <div className="actions">
        <button className="btn" onClick={download} disabled={saving}>
          {saving ? "Saving image…" : "Download image"}
        </button>
        <RestartButton className="btn ghost">Upload another CV</RestartButton>
      </div>
      {rewrite === null && w.plotTwist.target && (
        <p className="t-xs muted">The bullet rewrite was skipped because it tried to add facts that weren&apos;t in your CV.</p>
      )}
    </>
  );
}

export function buildCards(res: Ok): CardDef[] {
  const w = res.wrapped;
  const n = w.numbers.bullets;
  const cards: CardDef[] = [];

  cards.push({
    key: "read",
    label: "We read your CV",
    tone: "orange",
    node: (
      <>
        {w.read.headline && <p className="kicker">{w.read.headline}</p>}
        <h1 className="display t-4xl">We read your CV.</h1>
        <p className="serif t-2xl">All {n} bullet points of it.</p>
        <ul className="rows t-sm">
          <li className="row">
            <span>File</span>
            <span className="count">{res.file.name}</span>
          </li>
          <li className="row">
            <span>Pages</span>
            <span className="count">{res.file.pages}</span>
          </li>
          <li className="row">
            <span>Places</span>
            <span className="count">{w.read.orgs.length}</span>
          </li>
        </ul>
        <p className="t-xs">
          {w.read.orgs.join(", ")}.
          {w.read.droppedBullets > 0 && ` We ignored ${plural(w.read.droppedBullets, "line")} that wasn't in your file.`}
          {w.read.droppedFacts > 0 && ` We also removed ${plural(w.read.droppedFacts, "detail")} that weren't in your words.`}{" "}
          Not your CV? <RestartButton className="textbtn">Upload a different file</RestartButton>
        </p>
      </>
    ),
  });

  const numShare = w.numbers.withNumbers / n;
  cards.push({
    key: "numbers",
    label: "By the numbers",
    tone: "cream",
    node: (
      <>
        <p className="kicker">By the numbers</p>
        <p className="display t-5xl accent">{w.numbers.withNumbers}</p>
        <p className="display t-xl">of your {n} bullets have a number in them.</p>
        <p className="serif t-xl">
          {numShare >= 0.5
            ? "More than half your CV comes with receipts."
            : numShare >= 0.25
              ? "A good share, but numbers are what skimmers stop on."
              : "Numbers are what skimmers stop on. You've hidden most of yours."}
        </p>
        <p className="t-sm muted">
          {w.numbers.withPeople} involve other people. {w.numbers.withArtefacts} name something you made.
        </p>
      </>
    ),
  });

  if (w.topVerbs.length > 0) {
    cards.push({
      key: "verbs",
      label: "Top verbs",
      tone: "cream",
      node: (
        <>
          <h2 className="display t-2xl">Your most-used verbs</h2>
          <ol className="verbs">
            {w.topVerbs.map((v, i) => (
              <li key={v.verb}>
                <span className="n">{i + 1}</span>
                <span className={`display ${i === 0 ? "t-3xl" : "t-2xl"}`}>{v.verb}</span>
                <span className="x">×{v.count}</span>
              </li>
            ))}
          </ol>
          <p className="serif t-lg">Counted across all {n} bullet points.</p>
        </>
      ),
    });
  }

  if (w.flex.hero) {
    const h = w.flex.hero;
    const split = splitChange(h.raw);
    cards.push({
      key: "flex",
      label: "Biggest flex",
      tone: "blue",
      node: (
        <>
          <p className="kicker">Your biggest flex</p>
          {split ? (
            <>
              <p className="display t-2xl muted">{split[0]} →</p>
              <p className="display t-5xl accent">{split[1]}</p>
            </>
          ) : (
            <p className="display t-4xl accent">{h.raw}</p>
          )}
          {h.subject && <p className="display t-xl">{h.subject}</p>}
          <p className="serif t-xl">
            {h.jump ? `${h.jump}.` : ""} {h.org}.
          </p>
          {w.flex.runnersUp.length > 0 && (
            <div className="t-sm">
              <p className="kicker">Runners-up</p>
              {w.flex.runnersUp.map((r) => (
                <p key={r.raw + r.org}>
                  {r.raw}
                  {r.subject ? ` ${r.subject}` : ""}, {r.org}
                </p>
              ))}
            </div>
          )}
        </>
      ),
    });
  }

  cards.push({
    key: "shape",
    label: "Your shape",
    tone: "cream",
    node: (
      <>
        <div>
          <h2 className="display t-3xl">Your shape</h2>
          <p className="t-sm muted">Where your bullets put you on three spectrums.</p>
        </div>
        <Spectrum axis={w.axes.making} />
        <Spectrum axis={w.axes.wide} />
        <Spectrum axis={w.axes.crowd} />
      </>
    ),
  });

  const poles = [w.axes.making, w.axes.wide, w.axes.crowd].map((a) => (a.nearMiddle ? "Balanced." : `${a.winner}.`));
  cards.push({
    key: "setup",
    label: "Put together",
    tone: "ink",
    node: (
      <>
        <p className="display t-4xl">
          {poles.map((p) => (
            <span key={p} style={{ display: "block" }}>
              {p}
            </span>
          ))}
        </p>
        <p className="serif t-2xl accent">Put that together and you&apos;re…</p>
      </>
    ),
  });

  cards.push({
    key: "reveal",
    label: "Your animal",
    tone: "lime",
    node: (
      <div className="body center" style={{ flex: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a static, pre-sized image */}
        <img className="animal" src={animalSrc(w)} alt={`Illustration of a ${w.archetype.animal.toLowerCase()}`} />
        <p className="kicker">Your work animal is</p>
        <h2 className="display t-4xl reveal-name">The {w.archetype.animal}</h2>
        <p className="serif t-2xl">{w.archetype.tagline}.</p>
        <p className="t-md">{w.archetype.oneLiner}</p>
      </div>
    ),
  });

  cards.push({
    key: "why",
    label: `Why the ${w.archetype.animal}`,
    tone: "cream",
    node: (
      <>
        <h2 className="display t-2xl">Why the {w.archetype.animal}?</h2>
        <p>{w.archetype.definition}</p>
        <p className="kicker accent">The receipts</p>
        {w.receipts.map((r) => (
          <blockquote key={r.text}>
            <p>“{r.text}”</p>
            <cite>{r.org}</cite>
          </blockquote>
        ))}
        <div className="box t-sm">
          <p className="kicker" style={{ color: "var(--lime)" }}>
            Watch out for
          </p>
          <p>{w.archetype.watchOut}</p>
        </div>
      </>
    ),
  });

  const lv = w.level;
  const stageIdx = STAGES.indexOf(lv.stage);
  const datesDisagree =
    lv.yearsSource === "stated" && lv.datedYears !== null && Math.abs(lv.datedYears - (lv.years ?? 0)) >= 2;
  cards.push({
    key: "thrive",
    label: "Where you'd thrive",
    tone: "pink",
    node: (
      <>
        <h2 className="display t-3xl">Where you&apos;d thrive</h2>
        <div>
          <p className="kicker">Level, estimated</p>
          <div className="level-bar" style={{ marginTop: 8 }}>
            {STAGES.map((s, i) => (
              <span key={s} data-on={i <= stageIdx} />
            ))}
          </div>
          <div className="level-labels" style={{ marginTop: 6 }}>
            {STAGES.map((s) => (
              <span key={s} data-on={s === lv.stage}>
                {s === "Advanced Beginner" ? "Beginner" : s}
              </span>
            ))}
          </div>
        </div>
        <p className="serif t-xl">
          {lv.stage}: {STAGE_LINE[lv.stage]}
        </p>
        <p className="t-xs muted">
          {lv.years === null
            ? "No years or dates found, so this is a middle guess."
            : lv.yearsSource === "stated"
              ? `From the ${plural(lv.years, "year")} your CV states.`
              : `From ${plural(lv.years, "year")} of dated roles.`}
          {lv.bumped ? " Moved up one step for signs of ownership and scale." : ""}{" "}
          <a className="link" href="https://en.wikipedia.org/wiki/Dreyfus_model_of_skill_acquisition" target="_blank" rel="noreferrer">
            How the stages work
          </a>
        </p>
        {datesDisagree && (
          <p className="t-sm">
            <strong>Worth checking:</strong> your profile says {lv.years} years, but your dated roles cover {lv.datedYears}.
          </p>
        )}
        {w.roles.length > 0 && (
          <ol className="rows" style={{ listStyle: "none" }}>
            {w.roles.map((r, i) => (
              <li className="row" key={r.title + r.domain} style={{ flexDirection: "column", gap: 0 }}>
                <span style={{ fontWeight: 700 }} className="t-lg">
                  {i + 1} {r.title} · {r.seniority}
                </span>
                <span className="t-sm muted">
                  {r.domain}. {plural(r.evidence, "bullet")} of evidence.
                </span>
              </li>
            ))}
          </ol>
        )}
      </>
    ),
  });

  const pt = w.plotTwist;
  cards.push({
    key: "twist",
    label: "Plot twist",
    tone: "ink",
    node: (
      <>
        <p className="display t-xl" style={{ color: "var(--orange)" }}>
          {pt.rule === 4 ? "No plot twist" : "Plot twist"}
        </p>
        <h2 className="display t-2xl">{pt.title}</h2>
        <p className="serif t-xl accent">{pt.body}</p>
        {pt.target && (
          <div className="box t-sm" style={{ display: "grid", gap: 8 }}>
            <p className="kicker">{pt.fixLabel}</p>
            <p className="was t-md">“{pt.target.text}”</p>
            {res.rewrite ? (
              <p>→ “{res.rewrite}”</p>
            ) : (
              <p>→ Start this one with what you made, then the detail. The first verb is the one people remember.</p>
            )}
          </div>
        )}
      </>
    ),
  });

  cards.push({
    key: "summary",
    label: "Summary",
    tone: "ink",
    node: <Summary w={w} rewrite={res.rewrite} />,
  });

  return cards;
}
