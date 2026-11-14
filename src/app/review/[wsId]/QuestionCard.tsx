"use client";
import { useState } from "react";
import { editQuestion, removeQuestion, type ReviewData } from "@/lib/client/review";
import type { TQuestion, TWorksheet } from "@/lib/schema";
import { flagText, TEMPLATE } from "./flags";

type Props = {
  n: number;
  q: TQuestion;
  wsId: string;
  registry: TWorksheet["misconceptions"];
  editable: boolean;
  canRemove: boolean;
  onChange: (d: ReviewData) => void;
};

export function QuestionCard({ n, q, wsId, registry, editable, canRemove, onChange }: Props) {
  const [prompt, setPrompt] = useState(q.prompt);
  const [given, setGiven] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(q.given).map(([k, v]) => [k, String(v.value)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const t = TEMPLATE[q.template];
  const label = (id: string | null) => registry.find((m) => m.id === id)?.label ?? id;

  const changedGiven = Object.fromEntries(
    Object.entries(given)
      .filter(([k, v]) => Number(v) !== q.given[k]?.value)
      .map(([k, v]) => [k, Number(v)]),
  );
  const invalid = Object.values(given).some((v) => v.trim() === "" || !Number.isFinite(Number(v)));
  const dirty = prompt.trim() !== q.prompt || Object.keys(changedGiven).length > 0;

  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await editQuestion(wsId, q.id, {
      ...(prompt.trim() !== q.prompt ? { prompt: prompt.trim() } : {}),
      ...(Object.keys(changedGiven).length ? { given: changedGiven } : {}),
    });
    setBusy(false);
    if (r.ok) onChange(r.data);
    else setError(r.errors?.length ? `${r.error} ${r.errors[0]}` : r.error);
  };
  const remove = async () => {
    setBusy(true);
    const r = await removeQuestion(wsId, q.id);
    setBusy(false);
    if (r.ok) onChange(r.data);
    else {
      setError(r.error);
      setConfirmRemove(false);
    }
  };

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="mr-2 text-2xl align-middle" aria-hidden>{t.icon}</span>
          <span className="font-semibold text-text">Q{n}</span> · {t.label} · {q.concept}
        </p>
        {editable && canRemove && !confirmRemove && (
          <button type="button" onClick={() => setConfirmRemove(true)} className="text-sm text-muted hover:text-coral">
            Remove
          </button>
        )}
        {confirmRemove && (
          <span className="flex gap-2 text-sm">
            <span className="text-coral">Remove Q{n}?</span>
            <button type="button" disabled={busy} onClick={remove} className="font-semibold text-coral underline">Yes</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className="text-muted underline">Cancel</button>
          </span>
        )}
      </div>

      {editable ? (
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="w-full resize-y rounded-lg border border-line bg-navy px-3 py-2 text-lg" aria-label={`Question ${n} text`} />
      ) : (
        <p className="text-lg">{q.prompt}</p>
      )}

      {Object.keys(q.given).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(q.given).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 rounded-lg border border-line bg-navy px-3 py-1.5">
              <span className="font-display font-semibold text-cyan">{k}</span>
              <span className="text-muted">=</span>
              {editable ? (
                <input
                  value={given[k] ?? ""}
                  onChange={(e) => setGiven((g) => ({ ...g, [k]: e.target.value }))}
                  inputMode="decimal"
                  className="w-20 bg-transparent tabular-nums outline-none"
                  aria-label={`${k} value`}
                />
              ) : (
                <span className="tabular-nums">{v.value}</span>
              )}
              <span className="text-sm text-muted">{v.unit}</span>
            </label>
          ))}
        </div>
      )}

      {editable && dirty && (
        <div className="flex items-center gap-3">
          <button type="button" disabled={busy || invalid} onClick={save} className="rounded-lg bg-lime px-4 py-2 font-bold text-navy disabled:opacity-50">
            {busy ? "Checking…" : "Recompute with code"}
          </button>
          <span className="text-sm text-muted">Code recomputes the answer and every wrong choice. No AI call.</span>
        </div>
      )}
      {error && <p className="text-sm text-coral">✗ {error}</p>}

      {q.flags.length > 0 && (
        <ul className="flex flex-col gap-1">
          {q.flags.map((f) => (
            <li key={f} className="rounded-lg bg-amber/10 px-3 py-2 text-sm text-amber">⚠️ {flagText(f, q)}</li>
          ))}
        </ul>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {q.choices.map((c) => (
          <li key={c.id} className={`rounded-lg border px-3 py-2 ${c.correct ? "border-lime/50 bg-lime/10" : "border-line"}`}>
            <p className={c.correct ? "font-semibold text-lime" : ""}>
              {c.correct ? "✓" : "✗"} {c.id}. {c.text}
            </p>
            {!c.correct && c.misconceptionId && <p className="text-xs text-violet">🧠 {label(c.misconceptionId)}</p>}
          </li>
        ))}
      </ul>
    </li>
  );
}
