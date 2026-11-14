"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadResults, type Results } from "@/lib/client/results";

const fmtTime = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`);

export function ResultsView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [res, setRes] = useState<Results | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void loadResults(sessionId).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [sessionId]);

  if (res === undefined) return <main className="mx-auto w-full max-w-2xl px-6 py-20 text-muted">Counting your answers…</main>;
  if (res === null || res.answered === 0)
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-20 text-center">
        <h1 className="font-display text-4xl font-bold">No answers yet</h1>
        <p className="text-muted">This session has no recorded answers. Play a worksheet and your results show up here.</p>
        <Link href="/" className="mx-auto rounded-xl bg-cyan px-6 py-3 font-semibold text-navy">
          Back to start
        </Link>
      </main>
    );

  const pct = Math.round((100 * res.score) / res.answered);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-6 pb-16 pt-16">
      <header className="text-center">
        <p className="text-sm uppercase tracking-wider text-muted">{res.worksheetTitle}</p>
        <h1 className="mt-2 font-display text-5xl font-bold">
          <span className="text-lime">{res.score}</span>
          <span className="text-muted"> / {res.answered}</span>
        </h1>
        <p className="mt-2 text-lg">
          {res.nickname ? `${res.nickname}, ` : ""}
          {pct}% right on the first try
          {res.timePlayedSec != null && <span className="text-muted"> · played {fmtTime(res.timePlayedSec)}</span>}
        </p>
      </header>

      {res.topics.length > 0 && (
        <Card title="Accuracy by topic">
          <ul className="flex flex-col gap-3">
            {res.topics.map((t) => (
              <li key={t.topic}>
                <div className="flex justify-between gap-2">
                  <span>{t.label}</span>
                  <span className="tabular-nums text-muted">
                    {t.right} of {t.n}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-navy" role="img" aria-label={`${t.right} of ${t.n}`}>
                  <div className={`h-full rounded-full ${t.right === t.n ? "bg-lime" : "bg-cyan"}`} style={{ width: `${(100 * t.right) / t.n}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Top mistake">
        {res.topMistake ? (
          <>
            <p className="text-lg font-semibold text-coral">
              {res.topMistake.label}
              {res.topMistake.times > 1 && <span className="text-muted"> · {res.topMistake.times} times</span>}
            </p>
            {res.topMistake.why && <p className="mt-1 text-muted">{res.topMistake.why}</p>}
          </>
        ) : (
          <p className="text-lime">No mistakes. Every first answer was right.</p>
        )}
      </Card>

      {(res.coachNote || res.variants.length > 0) && (
        <Card title="Your coach">
          {res.coachNote && <p className="italic">“{res.coachNote}”</p>}
          {res.variants.length > 0 && (
            <ul className={`flex flex-col gap-2 ${res.coachNote ? "mt-3" : ""}`}>
              {res.variants.map((v) => (
                <li key={v.id} className="rounded-xl border border-violet/40 px-3 py-2 text-sm">
                  <span className="text-violet">🧠 New question from your coach · {v.concept}</span>
                  <p className="mt-1">{v.prompt}</p>
                  <p className={v.result === "correct" ? "text-lime" : v.result === "wrong" ? "text-coral" : "text-muted"}>
                    {v.result === "correct" ? "✓ right" : v.result === "wrong" ? "✗ wrong" : "not answered"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href={`/play/${encodeURIComponent(res.worksheetId)}`} className="rounded-xl bg-cyan px-6 py-3 font-semibold text-navy">
          ▶ Play again
        </Link>
        <Link href="/" className="rounded-xl border border-line bg-panel px-6 py-3 font-semibold hover:border-cyan">
          New worksheet
        </Link>
      </div>
      <p className="text-center text-xs text-muted">
        Every number on this page was counted by code{res.source === "device" ? " from this device's record" : ""}.
      </p>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      {children}
    </section>
  );
}
