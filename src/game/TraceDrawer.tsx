"use client";
// src/game/TraceDrawer.tsx: the AI trace drawer (docs/plan/05 §7, P1-17). T key or the 🧠 button.
// One card per coach decision this session: who decided (coach or code fallback), how long it took, the coach's
// one-line reason, what code rejected ("code caught it"), and where the next question came from (worksheet or a
// coach variant). This is the "you can watch the AI think" moment, so it shows only what the API returned.
import { useEffect, useState } from "react";
import { subscribe, useGame, type TraceEntry } from "./store";

const secs = (ms?: number) => (ms === undefined ? "" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

export function TraceDrawer() {
  const [open, setOpen] = useState(false);
  const trace = useGame((s) => s.trace);

  useEffect(() => subscribe("command", (e) => e.cmd === "trace" && setOpen((o) => !o)), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="AI trace"
        title="AI trace (T)"
        className="pointer-events-auto absolute right-4 top-[200px] z-40 grid h-12 w-12 place-items-center rounded-full border border-violet/60 bg-navy/85 text-2xl hover:bg-violet/15"
      >
        🧠
      </button>
      <aside
        className={`pointer-events-auto absolute inset-y-0 right-0 z-50 flex w-[440px] max-w-[92vw] flex-col border-l border-violet/40 bg-panel/95 backdrop-blur transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-violet">🧠 AI trace</h2>
            <p className="text-sm text-muted">Every step the coach took. Code checks each one.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-1 text-muted hover:text-text">
            T ✕
          </button>
        </header>
        <ol className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {trace.length === 0 && <li className="text-muted">No steps yet. The first one appears when the game starts.</li>}
          {[...trace].reverse().map((e, i) => (
            <Step key={trace.length - i} n={trace.length - i} e={e} />
          ))}
        </ol>
      </aside>
    </>
  );
}

function Step({ n, e }: { n: number; e: TraceEntry }) {
  const { ns, after, skipped } = e;
  const coach = ns.source === "coach";
  const q = e.served;
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line bg-navy/70 px-4 py-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Step {n}</span>
        <span>
          {after ? (
            <>
              after {after.questionId}: <span className={after.correct ? "text-lime" : "text-coral"}>{after.correct ? "✓" : "✗"} {after.chosenText}</span>
            </>
          ) : skipped ? (
            <>after {skipped}: skipped</>
          ) : (
            "start"
          )}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold ${coach ? "bg-violet/20 text-violet" : "bg-line text-muted"}`}>
          {coach ? "Coach" : "Code fallback"}
        </span>
        {ns.ms !== undefined && <span className="shrink-0 text-sm tabular-nums text-muted">{secs(ns.ms)}</span>}
        <span className="text-base leading-snug">{ns.reason}</span>
      </div>
      {after?.misconceptionId && <div className="text-sm text-muted">mistake: <span className="text-text">{after.misconceptionId}</span></div>}
      {ns.feedback && <div className="text-sm text-violet">Coach said: “{ns.feedback}”</div>}
      {(ns.rejected ?? []).map((r, i) => (
        <div key={i} className="rounded-lg border border-amber/40 bg-amber/10 px-2 py-1 text-sm text-amber">
          🛡️ Code caught it: {r}
        </div>
      ))}
      {e.replaced && <div className="text-sm text-muted">Code: {e.replaced} was already played, so it served the next unplayed question.</div>}
      <div className="text-sm">
        {q ? (
          q.origin === "variant" ? (
            <span className="text-violet">→ 🧠 new question {q.id} from the coach (passed code checks)</span>
          ) : (
            <span className="text-muted">→ next: {q.id} from the worksheet</span>
          )
        ) : (
          <span className="text-muted">→ finish</span>
        )}
      </div>
    </li>
  );
}
