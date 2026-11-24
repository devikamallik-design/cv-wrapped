"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RestartContext, buildCards } from "@/components/cards";
import type { AnalyseResponse } from "@/lib/api-types";

type State =
  | { phase: "idle"; error?: string }
  | { phase: "loading"; fileName: string; step: number }
  | { phase: "done"; result: Extract<AnalyseResponse, { ok: true }>; index: number };

const STEPS = [
  "Reading your file",
  "Pulling out every bullet",
  "Checking each one against your CV",
  "Counting verbs and ranking numbers",
  "Picking your animal",
];

export default function Home() {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Only the newest upload may write to the screen, so an old request can't overwrite a new one.
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const restart = useCallback(() => {
    abortRef.current?.abort();
    requestId.current++;
    if (inputRef.current) inputRef.current.value = "";
    setState({ phase: "idle" });
  }, []);

  async function analyse(file: File) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestId.current;
    setState({ phase: "loading", fileName: file.name, step: 0 });

    const timer = setInterval(() => {
      setState((s) => (s.phase === "loading" && s.step < STEPS.length - 2 ? { ...s, step: s.step + 1 } : s));
    }, 2200);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/analyse", { method: "POST", body, cache: "no-store", signal: controller.signal });
      const data = (await res.json()) as AnalyseResponse;
      if (id !== requestId.current) return;
      if (!data.ok) setState({ phase: "idle", error: data.message });
      else setState({ phase: "done", result: data, index: 0 });
    } catch (e) {
      if (id !== requestId.current || (e as Error).name === "AbortError") return;
      setState({ phase: "idle", error: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      clearInterval(timer);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const result = state.phase === "done" ? state.result : null;
  const cards = useMemo(() => (result ? buildCards(result) : []), [result]);
  const total = cards.length;
  const index = state.phase === "done" ? state.index : 0;

  const go = useCallback(
    (delta: number) =>
      setState((s) => {
        if (s.phase !== "done") return s;
        const next = Math.max(0, Math.min(total - 1, s.index + delta));
        return next === s.index ? s : { ...s, index: next };
      }),
    [total],
  );

  useEffect(() => {
    if (state.phase !== "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.phase, go]);

  if (state.phase === "done") {
    const card = cards[index];
    return (
      <RestartContext.Provider value={restart}>
      <main className="stage">
        <section className="card" data-tone={card.tone} aria-roledescription="story" aria-label={`${card.label}, ${index + 1} of ${cards.length}`}>
          <div className="progress" aria-hidden>
            {cards.map((c, i) => (
              <span key={c.key} data-state={i < index ? "done" : i === index ? "current" : "todo"} />
            ))}
          </div>
          {index > 0 && <button className="tap left" aria-label="Previous card" tabIndex={-1} onClick={() => go(-1)} />}
          {index < cards.length - 1 && <button className="tap right" aria-label="Next card" tabIndex={-1} onClick={() => go(1)} />}
          <div className="body" key={card.key}>
            {card.node}
          </div>
          <nav className="nav">
            <button className="btn ghost" onClick={() => go(-1)} disabled={index === 0}>
              Back
            </button>
            <span className="t-xs muted">
              {index + 1} / {cards.length}
            </span>
            {index < cards.length - 1 ? (
              <button className="btn" onClick={() => go(1)}>
                Next
              </button>
            ) : (
              <span style={{ width: 82 }} aria-hidden />
            )}
          </nav>
        </section>
      </main>
      </RestartContext.Provider>
    );
  }

  if (state.phase === "loading") {
    return (
      <main className="stage">
        <section className="card" data-tone="ink" aria-live="polite">
          <div className="body">
            <p className="kicker">{state.fileName}</p>
            <h1 className="display t-4xl">Reading your CV…</h1>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li className="step" key={s} data-state={i < state.step ? "done" : i === state.step ? "active" : "pending"}>
                  <span className="glyph" aria-hidden>
                    {i < state.step ? "✓" : ""}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="t-xs muted">Usually 10–20 seconds.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="stage">
      <section className="card" data-tone="cream">
        <div className="body">
          <h1 className="display t-4xl">Your CV, wrapped.</h1>
          <p>
            Drop your CV. Get the story it tells: the verbs you lean on, your biggest flex, your work animal, and what a recruiter will notice first.
          </p>
          <label
            className="drop"
            data-over={over}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) analyse(f);
            }}
          >
            <strong>Drop your CV here</strong>
            <span className="t-sm muted">or choose a file. PDF, Word or text, up to 5 MB.</span>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) analyse(f);
              }}
            />
          </label>
          {state.error && (
            <p className="error" role="alert">
              {state.error}
            </p>
          )}
          <p className="t-xs muted">
            Every number on the cards is counted from your own words. Your CV is sent to Claude (Anthropic&apos;s API) to read it. This site doesn&apos;t store it.
          </p>
        </div>
      </section>
    </main>
  );
}
