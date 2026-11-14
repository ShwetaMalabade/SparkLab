// src/lib/coach.ts — what /api/next does after every answer (docs/plan/03 §9). Server-only.
// The coach (Agent 4) PROPOSES the next step; applyDirector() and assemble() decide what is allowed.
// Any failure (timeout, bad JSON, invalid choice, a variant that fails code) → the code fallback.
import { z } from "zod";
import { askJSON, type AskResult } from "./ai";
import { applyDirector, DirectorOut, fallbackNext, type Session, type TDirectorOut } from "./agents/director";
import type { NextStep } from "./client/types";
import { db, type Doc } from "./db";
import { DIRECTOR_PROMPT } from "./prompts";
import { loadReplaySeed, recordedDecision } from "./replaySeed";
import { Attempt, type Misconception, type TAttempt, type TQuestion, type TWorksheet } from "./schema";
import { trimOverflow } from "./agents/designer";
import { isLab } from "./assemble";
import { loadDrafts, loadWorksheet, type Drafts } from "./worksheetStore";

type M = z.infer<typeof Misconception>;
type StudentModel = TDirectorOut["studentModel"];
type SessionDoc = Doc & {
  classCode: string;
  nickname: string;
  worksheetId: string;
  timeBudgetSec: number;
  startedAt: Date;
  played: string[];
  studentModel: StudentModel;
  variants?: { id: string; target: string | null; question: TQuestion }[];
  served?: string[];
  skipped?: string[];
};

export type CoachDeps = {
  ask: (prompt: string, ctx: { sessionId: string; classCode: string; after?: string; spareWrong?: unknown[] }) => Promise<AskResult<TDirectorOut>>;
};

/** Tidy the coach's JSON before the strict check (real outputs, 2026-11-14), so a good decision isn't thrown away
 *  over form: the new question's overflow is trimmed like Agent 2's; if it has < 3 wrong options, it's topped up with
 *  the answered question's own wrong formulas (they model the same mistakes, so they fit new numbers; code computes and
 *  checks every value); internal student-model notes are cut to their limits. Exported for tests. */
export function tidyCoachJson(v: unknown, spareWrong: unknown[] = []): unknown {
  if (!v || typeof v !== "object") return v;
  const o = { ...(v as Record<string, unknown>) };
  const sm = o.studentModel as { concepts?: Record<string, { evidence?: unknown }>; notes?: unknown } | undefined;
  if (sm && typeof sm === "object") {
    const concepts = Object.fromEntries(
      Object.entries(sm.concepts ?? {}).map(([k, c]) => [k, typeof c?.evidence === "string" ? { ...c, evidence: c.evidence.slice(0, 80) } : c]),
    );
    o.studentModel = { ...sm, concepts, ...(typeof sm.notes === "string" ? { notes: sm.notes.slice(0, 200) } : {}) };
  }
  const nq = o.newQuestion as { design?: unknown } | null | undefined;
  if (nq?.design && typeof nq.design === "object") {
    const d = trimOverflow(nq.design) as { wrong?: { misconceptionId?: unknown }[] };
    if (Array.isArray(d.wrong) && d.wrong.length < 3) {
      const used = new Set(d.wrong.map((w) => w?.misconceptionId));
      const extra = spareWrong.filter((w) => !used.has((w as { misconceptionId?: unknown })?.misconceptionId));
      d.wrong = [...d.wrong, ...extra].slice(0, 5) as typeof d.wrong;
    }
    o.newQuestion = { ...nq, design: d };
  }
  return o;
}

const realCoach: CoachDeps = {
  // reason records which answer this call followed ("next after q2/C/0", or "next first"): the replay export
  // pairs each recorded decision with its answer this way (scripts/export-replay.ts).
  ask: (prompt, { after, spareWrong, ...ctx }) =>
    askJSON("director", z.preprocess((v) => tidyCoachJson(v, spareWrong), DirectorOut), prompt, {
      ctx: { ...ctx, reason: `next ${after ?? "first"}` },
    }) as Promise<AskResult<TDirectorOut>>,
};
/** "after q2/C/0" = question q2, choice C, wrong. Parsed back by scripts/export-replay.ts. */
export const afterTag = (a: { questionId: string; chosen: string; correct: boolean } | null) =>
  a ? `after ${a.questionId}/${a.chosen}/${a.correct ? 1 : 0}` : "first";

export type CoachResult = { ok: true; step: NextStep & { ms: number } } | { ok: false; status: number; error: string };

export async function decideNext(
  req: { sessionId: string; attemptId?: string | null; attempt?: Omit<TAttempt, "simulated"> | null },
  deps: CoachDeps = realCoach,
  now = Date.now(),
): Promise<CoachResult> {
  const t0 = Date.now();
  const s = await db.findOne<SessionDoc>("sessions", { _id: req.sessionId });
  if (!s) return { ok: false, status: 404, error: `No session ${req.sessionId}.` };
  const ws = await loadWorksheet(s.worksheetId);
  if (!ws) return { ok: false, status: 404, error: `No worksheet ${s.worksheetId}.` };

  const attempts = await db.find<Doc & TAttempt>("attempts", { sessionId: s._id }, { sort: { createdAt: 1 } });
  const stored = req.attemptId ? attempts.find((a) => a._id === req.attemptId) : undefined;
  const inline = req.attempt ? Attempt.safeParse(req.attempt) : null;
  const last: TAttempt | null = stored ?? (inline?.success ? inline.data : null);

  // What's been played: saved attempts (the source of truth) + the inline one whose POST may still be queued.
  const played = new Set([...s.played, ...attempts.map((a) => a.questionId), ...(last ? [last.questionId] : [])]);
  // A call with no answer after we served a question = the student skipped it (N): don't offer it again.
  const skipped = new Set(s.skipped ?? []);
  const lastServed = s.served?.at(-1);
  if (!last && lastServed && !played.has(lastServed) && !skipped.has(lastServed)) skipped.add(lastServed);

  const variants = s.variants ?? [];
  const session: Session = {
    id: s._id,
    played: [...played, ...skipped],
    variants: variants.map((v) => ({ id: v.id, target: v.target })),
    startedAt: new Date(s.startedAt).getTime(),
    timeBudgetSec: s.timeBudgetSec,
  };

  // ---- ask the coach
  const ctx = buildContext(ws, s, session, attempts, last, now, last ? await loadDrafts(ws.id) : {});
  const spareWrong = (ctx.lastQuestionDrafts?.design.wrong ?? []) as unknown[];
  let r = await deps.ask(DIRECTOR_PROMPT(JSON.stringify(ctx)), { sessionId: s._id, classCode: s.classCode, after: afterTag(last), spareWrong });
  // Offline: the exact prompt (it includes the seconds left) rarely matches the recording, so reuse the recorded
  // decision for the same answer. It goes through the same code checks below; no match → the code fallback.
  if (!r.ok && process.env.OFFLINE === "1") {
    const rec = DirectorOut.safeParse(recordedDecision(loadReplaySeed(), last));
    if (rec.success) r = { ok: true, data: rec.data, ms: 0, cached: true };
  }
  let step: NextStep;
  let out: TDirectorOut | null = null;
  if (!r.ok) step = fallbackNext(ws, session, r.error === "schema" ? "coach answer didn't match the format" : `coach unavailable (${r.error})`);
  else {
    out = r.data;
    step = last ? applyDirector(ws, session, last, out, now) : firstPick(ws, session, out);
  }

  // Chemistry-only build: a coach question that no lab can simulate isn't served (no answer balloons).
  if (step.question?.origin === "variant" && !isLab(step.question.template))
    step = { ...fallbackNext(ws, session, "coach's question has no lab"), feedback: step.feedback, rejected: ["coach's question has no lab"] };

  // ---- persist: a passed variant, new mistakes, the student model, what we served
  const update: Record<string, unknown> = {};
  if (step.question?.origin === "variant" && out) {
    update.variants = [...variants, { id: step.question.id, target: out.targetMisconceptionId, question: step.question }];
    const known = new Set(ws.misconceptions.map((m) => m.id));
    const added = out.newMisconceptions.filter((m: M) => !known.has(m.id));
    if (added.length) await db.update("worksheets", { _id: ws.id }, { $set: { misconceptions: [...ws.misconceptions, ...added] } });
  }
  if (out) update.studentModel = out.studentModel; // already clamped by the schema (mastery 0–1, short evidence)
  update.skipped = [...skipped];
  if (step.question) update.served = [...(s.served ?? []), step.question.id];
  await db.update("sessions", { _id: s._id }, { $set: update });

  const ms = Date.now() - t0;
  // One row per decision (what code actually allowed), for the teacher's coach feed and the AI trace.
  await db.log({
    agent: "director",
    model: "code",
    inputHash: "decision",
    ms,
    ok: step.source === "coach",
    error: null,
    outputJson: {
      action: step.action,
      questionId: step.question?.id ?? null,
      origin: step.question?.origin ?? null,
      proposed: out?.action ?? null,
      source: step.source,
      rejected: step.rejected ?? null,
    },
    sessionId: s._id,
    classCode: s.classCode,
    reason: step.reason,
  });
  return { ok: true, step: { ...step, ms } };
}

/** First question (no answer yet): the coach may only pick an unplayed worksheet question. */
function firstPick(ws: TWorksheet, s: Session, out: TDirectorOut): NextStep {
  const q = ws.questions.find((x) => x.origin === "worksheet" && !s.played.includes(x.id) && x.id === out.nextQuestionId);
  if (out.action === "next" && q) return { action: "play", question: q, feedback: out.feedback, reason: out.reason, source: "coach" };
  return fallbackNext(ws, s, out.action === "next" ? `unknown question ${out.nextQuestionId}` : `no answer yet, so "${out.action}" isn't allowed`);
}

/** The coach's context, kept small (~6 KB): ids and concepts, not full questions. */
function buildContext(ws: TWorksheet, s: SessionDoc, session: Session, attempts: TAttempt[], last: TAttempt | null, now: number, drafts: Drafts) {
  const misconceptionCounts: Record<string, number> = {};
  for (const a of attempts) if (a.misconceptionId) misconceptionCounts[a.misconceptionId] = (misconceptionCounts[a.misconceptionId] ?? 0) + 1;
  const byId = new Map([...ws.questions, ...(s.variants ?? []).map((v) => v.question).filter((q): q is TQuestion => !!q)].map((q) => [q.id, q]));
  // The exact draft format a new question must use: the reader + designer drafts behind the question just answered
  // (for a coach question, its worksheet parent's). Without it the model invents its own fields.
  const lastQ = last ? byId.get(last.questionId) : undefined;
  const lastQuestionDrafts = lastQ ? (drafts[lastQ.id] ?? (lastQ.parentId ? drafts[lastQ.parentId] : undefined) ?? null) : null;
  return {
    lastQuestionDrafts,
    worksheet: ws.questions.map((q) => ({ id: q.id, concept: q.concept, template: q.template, played: session.played.includes(q.id) })),
    registry: ws.misconceptions.map((m) => ({ id: m.id, label: m.label })),
    studentModel: s.studentModel,
    counts: { correct: attempts.filter((a) => a.correct).length, wrong: attempts.filter((a) => !a.correct).length, misconceptionCounts },
    secondsLeft: Math.max(0, Math.round(s.timeBudgetSec - (now - session.startedAt) / 1000)),
    templatesPlayed: [...new Set(attempts.map((a) => byId.get(a.questionId)?.template).filter(Boolean))],
    variantsWritten: session.variants.length,
    lastAttempt: last
      ? {
          questionId: last.questionId,
          concept: byId.get(last.questionId)?.concept ?? null,
          chosenText: last.chosenText,
          correct: last.correct,
          misconceptionId: last.misconceptionId,
          msToAnswer: last.msToAnswer,
          hoverTrace: last.hoverTrace,
          experiments: last.experiments,
          mixTries: last.mixTries,
          balancerSteps: last.balancerSteps,
          titrationLog: last.titrationLog ?? null,
          testsUsed: last.testsUsed ?? null,
        }
      : null,
  };
}
