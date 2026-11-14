"use client";
// Score from the mock attempts in localStorage (written by postAttempt in mock mode). Replaced in P2-18.
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";

type Row = { sessionId: string; correct: boolean };

function readAttempts(): string {
  try {
    return window.localStorage.getItem("ha:attempts") ?? "[]";
  } catch {
    return "[]";
  }
}

export function MockScore() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const raw = useSyncExternalStore(() => () => {}, readAttempts, () => "[]");
  let rows: Row[] = [];
  try {
    rows = (JSON.parse(raw) as Row[]).filter((a) => a.sessionId === sessionId);
  } catch {
    rows = [];
  }
  const right = rows.filter((a) => a.correct).length;
  if (rows.length === 0) return <p className="text-muted">No answers recorded for this session yet.</p>;
  return (
    <p className="text-2xl">
      <span className="font-bold text-lime">✓ {right}</span> of {rows.length} correct
    </p>
  );
}
