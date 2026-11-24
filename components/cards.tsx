"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { AnalyseResponse } from "@/lib/api-types";
import type { Axis, Wrapped } from "@/lib/wrapped";

type Ok = Extract<AnalyseResponse, { ok: true }>;

export interface CardDef {
  key: string;
  label: string;
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

function Spectrum({ axis }: { axis: Axis }) {
  const leftWins = axis.value < 0.5;
  return (
    <div className="spectrum">
      <div className="ends">
        <span data-win={!axis.nearMiddle && leftWins}>{axis.left}</span>
        <span data-win={!axis.nearMiddle && !leftWins}>{axis.right}</span>
      </div>
      <div className="track" role="img" aria-label={`${axis.left} to ${axis.right}: ${Math.round(axis.value * 100)}%`}>
        <span className="mid" />
        <span className="dot" style={{ left: `${axis.value * 100}%` }} />
      </div>
      <p className="small">
        {axis.caption} <span className="muted">{axis.evidence}</span>
      </p>
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

  return (
    <>
      <div className="summary" ref={ref}>
        <div className="summary-head">
          <p className="small muted">My CV, wrapped</p>
          <p className="display h2">
            {w.archetype.emoji} {w.archetype.animal}
          </p>
          <p className="small">{w.archetype.tagline}</p>
        </div>
        <ul className="rows small">
          {w.topVerbs.slice(0, 3).map((v, i) => (
            <li className="row" key={v.verb}>
              <span>
                {i + 1}. {v.verb}
              </span>
              <span className="count">×{v.count}</span>
            </li>
          ))}
        </ul>
        {w.flex.hero && (
          <p className="small">
            Biggest flex: <strong>{w.flex.hero.raw}</strong>
            {w.flex.hero.subject ? ` ${w.flex.hero.subject}` : ""}
          </p>
        )}
        {w.roles[0] && (
          <p className="small">
            Best fit: <strong>{w.roles[0].title}</strong>, {w.roles[0].domain}
          </p>
        )}
      </div>
      <div className="actions">
        <button className="btn" onClick={download} disabled={saving}>
          {saving ? "Saving image…" : "Download image"}
        </button>
        <RestartButton className="btn ghost">Upload another CV</RestartButton>
      </div>
      {rewrite === null && w.plotTwist.target && (
        <p className="xs muted">The bullet rewrite was skipped because it tried to add facts that weren&apos;t in your CV.</p>
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
    label: "What we read",
    node: (
      <>
        <p className="kicker">First, check we read the right CV</p>
        <h1 className="display h2">{res.file.name}</h1>
        <ul className="rows">
          <li className="row">
            <span>Headline</span>
            <span className="count">{w.read.headline ?? "None found"}</span>
          </li>
          <li className="row">
            <span>Pages</span>
            <span className="count">{res.file.pages}</span>
          </li>
          <li className="row">
            <span>Bullet points</span>
            <span className="count">{n}</span>
          </li>
          <li className="row">
            <span>Places</span>
            <span className="count">{w.read.orgs.length}</span>
          </li>
        </ul>
        <p className="small muted">
          {w.read.orgs.join(", ")}.
          {w.read.droppedBullets > 0 &&
            ` We ignored ${plural(w.read.droppedBullets, "line")} the model returned that we couldn't find in your file.`}
          {w.read.droppedFacts > 0 && ` We also removed ${plural(w.read.droppedFacts, "detail")} that weren't in your words.`}
        </p>
        <p className="small">
          Not your CV?{" "}
          <RestartButton className="textbtn">Upload a different file</RestartButton>
        </p>
      </>
    ),
  });

  cards.push({
    key: "numbers",
    label: "Your bullets",
    node: (
      <>
        <p className="kicker">Your CV, counted</p>
        <p className="display huge">{n}</p>
        <p className="lede">bullet points about your work. Of those:</p>
        <ul className="rows">
          <li className="row">
            <span>have a number in them</span>
            <span className="count">{w.numbers.withNumbers}</span>
          </li>
          <li className="row">
            <span>involve other people</span>
            <span className="count">{w.numbers.withPeople}</span>
          </li>
          <li className="row">
            <span>name something you made</span>
            <span className="count">{w.numbers.withArtefacts}</span>
          </li>
        </ul>
      </>
    ),
  });

  if (w.topVerbs.length > 0) {
    const [lead, ...rest] = w.topVerbs;
    cards.push({
      key: "verbs",
      label: "Top verbs",
      node: (
        <>
          <p className="kicker">The verb you use most</p>
          <p className="display verb-lead">{lead.verb}</p>
          <p className="lede">Used in {plural(lead.count, "bullet")}. Then:</p>
          <ul className="rows">
            {rest.map((v, i) => (
              <li className="row" key={v.verb}>
                <span>
                  {i + 2}. {v.verb}
                </span>
                <span className="count">×{v.count}</span>
              </li>
            ))}
          </ul>
          <p className="xs muted">Counted from a fixed list of action verbs. Each verb counts once per bullet.</p>
        </>
      ),
    });
  }

  if (w.flex.hero) {
    const h = w.flex.hero;
    cards.push({
      key: "flex",
      label: "Biggest flex",
      node: (
        <>
          <p className="kicker">Your biggest flex</p>
          <p className="display big">{h.raw}</p>
          <p className="lede">
            {h.subject ? `${h.subject.charAt(0).toUpperCase()}${h.subject.slice(1)}` : "Your top result"}
            {h.org ? `, ${h.org}` : ""}.{h.jump ? ` ${h.jump}.` : ""}
          </p>
          {w.flex.runnersUp.length > 0 && (
            <>
              <p className="small muted">Runners-up</p>
              <ul className="rows small">
                {w.flex.runnersUp.map((r) => (
                  <li className="row" key={r.raw + r.org}>
                    <span>
                      {r.raw}
                      {r.subject ? ` ${r.subject}` : ""}
                    </span>
                    <span className="count">{r.org}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="xs muted">
            Ranked: before→after changes first, then % change, money, ratings, counts and time. Percentages rank by points gained, so a tiny starting number can&apos;t win on ratio alone.
          </p>
        </>
      ),
    });
  }

  cards.push({
    key: "shape",
    label: "Your shape",
    node: (
      <>
        <p className="kicker">Your shape</p>
        <h2 className="display h2">Three questions about how you work</h2>
        <Spectrum axis={w.axes.making} />
        <Spectrum axis={w.axes.wide} />
        <Spectrum axis={w.axes.crowd} />
      </>
    ),
  });

  cards.push({
    key: "reveal",
    label: "Your animal",
    node: (
      <div className="reveal">
        <p className="kicker">So, put together, you&apos;re a…</p>
        <p className="animal" aria-hidden>
          {w.archetype.emoji}
        </p>
        <h2 className="display animal-name">{w.archetype.animal}</h2>
        <p className="lede">
          {w.archetype.tagline}. {w.archetype.oneLiner}
        </p>
        <p className="small muted">Thrives in: {w.archetype.thrivesIn}</p>
      </div>
    ),
  });

  cards.push({
    key: "why",
    label: `Why the ${w.archetype.animal}`,
    node: (
      <>
        <p className="kicker">Why the {w.archetype.animal}</p>
        <p className="lede">{w.archetype.definition}</p>
        {w.receipts.map((r) => (
          <blockquote key={r.text}>
            {r.text}
            <cite>{r.org}</cite>
          </blockquote>
        ))}
        <p className="small">
          <span className="muted">Watch out:</span> {w.archetype.watchOut}
        </p>
      </>
    ),
  });

  const lv = w.level;
  const datesDisagree = lv.yearsSource === "stated" && lv.datedYears !== null && Math.abs(lv.datedYears - (lv.years ?? 0)) >= 2;
  cards.push({
    key: "level",
    label: "Your level",
    node: (
      <>
        <p className="kicker">Your level, estimated</p>
        <p className="display big">{lv.stage}</p>
        <p className="lede">Reads as {lv.seniority}.</p>
        <p className="small">
          {lv.years === null
            ? "We couldn't find years of experience or dates, so this is a middle guess."
            : lv.yearsSource === "stated"
              ? `Based on the ${plural(lv.years, "year")} your CV states`
              : `Based on ${plural(lv.years, "year")} of dated roles`}
          {lv.bumped ? `, moved up one step for ${lv.scopeSignals.length} signs of ownership and scale.` : lv.years === null ? "" : "."}
        </p>
        {datesDisagree && (
          <p className="small">
            <span className="lime">Worth checking:</span> your profile says {lv.years} years, but your dated roles cover {lv.datedYears}. A recruiter will notice the gap either way.
          </p>
        )}
        <p className="xs muted">
          Stages from the{" "}
          <a className="link" href="https://en.wikipedia.org/wiki/Dreyfus_model_of_skill_acquisition" target="_blank" rel="noreferrer">
            Dreyfus model
          </a>
          : under 1 year Novice, 1–2 Advanced Beginner, 2–4 Competent, 4–8 Proficient, 8+ Expert. It can move up one step at most.
        </p>
      </>
    ),
  });

  if (w.roles.length > 0) {
    cards.push({
      key: "roles",
      label: "Roles",
      node: (
        <>
          <p className="kicker">Where your evidence is strongest</p>
          <h2 className="display h2">Roles you can back up today</h2>
          <ul className="rows">
            {w.roles.map((r, i) => (
              <li className="row" key={r.title + r.domain} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span className="lede">
                  {i + 1}. {r.title}
                </span>
                <span className="small muted">
                  {r.domain}, {r.seniority}. {plural(r.evidence, "bullet")} of evidence.
                </span>
              </li>
            ))}
          </ul>
          <p className="xs muted">Each role is a discipline paired with the industry where your CV has the most bullets for it.</p>
        </>
      ),
    });
  }

  const pt = w.plotTwist;
  cards.push({
    key: "twist",
    label: "Plot twist",
    node: (
      <>
        <p className="kicker">{pt.rule === 4 ? "No twist" : "Plot twist"}</p>
        <h2 className="display h3">{pt.title}</h2>
        <p>{pt.body}</p>
        {pt.target && (
          <div className="before-after">
            <p className="small lime">{pt.fixLabel}</p>
            <p className="was">{pt.target.text}</p>
            {res.rewrite ? (
              <p className="now">{res.rewrite}</p>
            ) : (
              <p className="small muted">
                Start this one with what you made, then the detail. The first verb is the one people remember.
              </p>
            )}
          </div>
        )}
      </>
    ),
  });

  cards.push({
    key: "summary",
    label: "Summary",
    node: <Summary w={w} rewrite={res.rewrite} />,
  });

  return cards;
}
