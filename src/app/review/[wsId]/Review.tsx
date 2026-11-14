"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadForReview, type ReviewData } from "@/lib/client/review";
import { QuestionCard } from "./QuestionCard";

export function Review() {
  const { wsId } = useParams<{ wsId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadForReview(wsId)
      .then((d) => !cancelled && setData(d))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load the worksheet."));
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  if (error)
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <p className="text-coral">✗ {error}</p>
      </main>
    );
  if (!data) return <main className="mx-auto w-full max-w-4xl px-6 py-16 text-muted">Loading the worksheet…</main>;

  const { ws, dropped, editable } = data;
  const flagged = ws.questions.filter((q) => q.flags.length).length;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-muted">Review</p>
          <h1 className="text-4xl font-bold">{ws.title}</h1>
          <p className="mt-1 text-muted">
            {ws.questions.length} question{ws.questions.length === 1 ? "" : "s"} · <span className="text-lime">✓ every number computed by code</span>
            {flagged > 0 && <span className="text-amber"> · ⚠️ {flagged} to look at</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/play/${ws.id}`)}
          className="rounded-xl bg-cyan px-7 py-3 text-lg font-bold text-navy hover:brightness-110"
        >
          ▶ Play
        </button>
      </header>

      {!editable && (
        <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
          Read-only: this is the dev fixture. Editing works on a real scan.
        </p>
      )}
      {dropped.length > 0 && (
        <ul className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
          {dropped.map((d) => (
            <li key={d}>⚠️ {d}</li>
          ))}
        </ul>
      )}

      <ol className="flex flex-col gap-4">
        {ws.questions.map((q, i) => (
          <QuestionCard key={q.id} n={i + 1} q={q} wsId={ws.id} registry={ws.misconceptions} editable={editable} canRemove={ws.questions.length > 1} onChange={setData} />
        ))}
      </ol>
    </main>
  );
}
