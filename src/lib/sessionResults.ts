// src/lib/sessionResults.ts — one session's Results from the database (docs/plan/07 §2 screen 6). Server-only.
import { db, type Doc } from "./db";
import { summarizeResults, type Results } from "./results";
import type { TAttempt, TQuestion } from "./schema";
import { loadWorksheet } from "./worksheetStore";

type SessionDoc = Doc & {
  nickname: string;
  worksheetId: string;
  startedAt: Date;
  endedAt: Date | null;
  variants?: { id: string; question: TQuestion }[];
};
type DecisionDoc = Doc & { reason: string | null; outputJson: { source?: string } | null };

export async function sessionResults(sessionId: string): Promise<Results | null> {
  const s = await db.findOne<SessionDoc>("sessions", { _id: sessionId });
  if (!s) return null;
  const ws = await loadWorksheet(s.worksheetId);
  if (!ws) return null;
  const [attempts, decisions] = await Promise.all([
    db.find<Doc & TAttempt>("attempts", { sessionId }, { sort: { createdAt: 1 } }),
    db.find<DecisionDoc>("aiCalls", { sessionId, agent: "director", inputHash: "decision" }, { sort: { createdAt: -1 }, limit: 10 }),
  ]);
  // The coach's note = its last real decision (fallback rows are code's "next unplayed question", not a note).
  const note = decisions.find((d) => d.outputJson?.source === "coach" && d.reason)?.reason ?? null;
  const last = attempts.at(-1)?.createdAt;
  const end = s.endedAt ?? last ?? null;
  return summarizeResults(ws, attempts, {
    playId: s.worksheetId,
    nickname: s.nickname,
    startedAt: s.startedAt ? +new Date(s.startedAt) : null,
    endedAt: end ? +new Date(end) : null,
    variants: (s.variants ?? []).map((v) => v.question).filter(Boolean),
    coachNote: note,
    source: "server",
  });
}
