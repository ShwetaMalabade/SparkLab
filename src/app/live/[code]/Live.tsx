"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ClassStats } from "@/lib/classStats";

type Toast = { id: string; title: string; detail: string | null; correct: boolean };
const POLL_MS = 2000;

export function Live() {
  const { code: raw } = useParams<{ code: string }>();
  const code = raw.toUpperCase();
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastAt = useRef("");

  // docs/plan/06 §3: poll every 2 s; the FIRST poll only records the time (no toasts for old answers).
  useEffect(() => {
    let stop = false;
    let first = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/class/${encodeURIComponent(code)}`, { cache: "no-store" });
        if (r.status === 404) setError(`There's no class ${code}. Check the code on the laptop screen.`);
        else if (r.ok) {
          const s: ClassStats = await r.json();
          if (stop) return;
          setStats(s);
          setError(null);
          setFailures(0);
          if (!first) {
            const fresh = [...s.latest].reverse().filter((e) => e.at > lastAt.current && !e.simulated);
            if (fresh.length) {
              setToasts((t) => [
                ...t,
                ...fresh.map((e) => ({ id: e.at + e.nickname, title: `${e.nickname} chose ${e.chosenText}`, detail: e.label, correct: e.correct })),
              ].slice(-3));
              navigator.vibrate?.(80);
            }
          }
          lastAt.current = s.latest[0]?.at ?? lastAt.current;
          first = false;
        } else setFailures((f) => f + 1);
      } catch {
        setFailures((f) => f + 1);
      }
      if (!stop) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code]);

  // Toasts fade after 4 s.
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 4000);
    return () => clearTimeout(t);
  }, [toasts]);

  if (error) return <main className="px-4 pt-14 text-lg text-coral">✗ {error}</main>;
  if (!stats) return <main className="px-4 pt-14 text-lg text-muted">Connecting to class {code}…</main>;

  const simulated = stats.students.filter((s) => s.simulated).length;
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-10 pt-12 text-base">
      <header>
        <p className="font-display text-xl font-bold leading-tight">{stats.worksheetTitle ?? "Waiting for a worksheet…"}</p>
        <p className="text-sm text-muted">
          class <span className="font-semibold tracking-widest text-cyan">{stats.code}</span> · {stats.students.length} student
          {stats.students.length === 1 ? "" : "s"}
          {simulated > 0 && ` (${simulated} AI-simulated)`}
          {failures >= 2 && <span className="text-amber"> · reconnecting…</span>}
        </p>
      </header>

      <div className="fixed inset-x-0 top-10 z-40 mx-auto flex max-w-md flex-col gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${t.correct ? "border-lime/60 bg-navy/95" : "border-coral/60 bg-navy/95"}`}>
            <p className={`font-semibold ${t.correct ? "text-lime" : "text-coral"}`}>
              {t.title} {t.correct ? "✓" : "✗"}
            </p>
            {t.detail && <p className="text-sm text-muted">{t.detail}</p>}
          </div>
        ))}
      </div>

      {stats.waiting ? (
        <Card title="Waiting for a worksheet…">
          <p className="text-muted">As soon as the laptop scans a worksheet, the questions and every answer show up here, live.</p>
        </Card>
      ) : (
        <>
          <Card title="Students">
            {stats.students.length === 0 ? (
              <p className="text-muted">No one has joined yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-1 text-left">
                  <thead>
                    <tr className="text-sm text-muted">
                      <th className="font-normal" />
                      {stats.questions.map((q, i) => (
                        <th key={q.id} className="w-8 text-center font-normal">
                          q{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.students.map((s) => (
                      <tr key={s.sessionId}>
                        <td className="max-w-[9rem] truncate pr-2" title={s.profile ?? undefined}>
                          {s.nickname}
                          {s.live && <span className="ml-1 text-xs text-cyan">● live</span>}
                          {s.simulated && <span className="ml-1 rounded bg-violet/20 px-1 text-xs text-violet">AI</span>}
                          {s.variants > 0 && <span className="ml-1 text-xs text-violet">🧠{s.variants}</span>}
                        </td>
                        {stats.questions.map((q) => {
                          const a = s.answers[q.id];
                          return (
                            <td key={q.id} className={`text-center font-bold ${a === "correct" ? "text-lime" : a === "wrong" ? "text-coral" : "text-muted"}`}>
                              {a === "correct" ? "✓" : a === "wrong" ? "✗" : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Top mistakes">
            {stats.topMistakes.length === 0 ? (
              <p className="text-muted">No mistakes yet.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {stats.topMistakes.map((m, i) => (
                  <li key={m.misconceptionId}>
                    <div className="flex justify-between gap-2">
                      <span>
                        {i + 1}. {m.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-coral">
                        {m.students}/{m.ofStudents}
                      </span>
                    </div>
                    <Bar pct={m.ofStudents ? (100 * m.students) / m.ofStudents : 0} tone="bg-coral" />
                    <p className="text-sm text-muted">{m.nicknames.join(", ")}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Questions">
            <ol className="flex flex-col gap-3">
              {stats.questions.map((q, i) => (
                <li key={q.id}>
                  <div className="flex justify-between gap-2">
                    <span className="truncate">
                      q{i + 1} · {q.short}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{q.n ? `${q.correctPct}% ✓ of ${q.n}` : "no answers"}</span>
                  </div>
                  <Bar pct={q.correctPct} tone="bg-lime" />
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Coach decisions">
            {stats.coachFeed.length === 0 ? (
              <p className="text-muted">The AI coach&apos;s choices appear here after each answer.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.coachFeed.map((c) => (
                  <li key={c.at + c.nickname} className="text-sm">
                    <span className="font-semibold">{c.nickname}:</span> {c.variant && <span className="text-violet">🧠 wrote a new question · </span>}
                    {c.rejected && <span className="text-amber">✗ code rejected the coach&apos;s question · </span>}
                    <span className={c.fallback ? "text-muted" : ""}>{c.reason}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
      <p className="text-center text-xs text-muted">Updates every 2 s · every number computed by code · camera video never leaves the laptop</p>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-navy" role="img" aria-label={`${Math.round(pct)}%`}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
