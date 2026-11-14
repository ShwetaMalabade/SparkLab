// src/lib/agents/director.ts — Agent 4, the AI coach. Decides the next step after every answer.
import { z } from "zod";
import { ReadQuestion, DesignQuestion, Misconception, type TQuestion, type TWorksheet, type TAttempt } from "../schema";
import { assemble } from "../assemble";

export const StudentModel = z.object({
  concepts: z.record(z.string(), z.object({ mastery: z.number().min(0).max(1), evidence: z.string().max(80) })),
  notes: z.string().max(200),
});
export const DirectorOut = z.object({
  action: z.enum(["next", "variant", "probe", "finish"]),
  nextQuestionId: z.string().nullable(),
  targetMisconceptionId: z.string().nullable(),
  newQuestion: z.object({ read: ReadQuestion, design: DesignQuestion }).nullable(),
  newMisconceptions: z.array(Misconception).max(2).default([]),   // only if the student showed a mistake not in the registry
  feedback: z.string().max(160),                                  // spoken to the student, ≤ 25 words
  reason: z.string().max(160),                                    // shown in the AI trace + teacher phone
  studentModel: StudentModel,
});
export type TDirectorOut = z.infer<typeof DirectorOut>;

export type Session = { id: string; played: string[]; variants: { id: string; target: string | null }[]; startedAt: number; timeBudgetSec: number };
export type NextStep = { action: "play" | "finish"; question?: TQuestion; feedback: string | null; reason: string; source: "coach" | "fallback"; rejected?: string[] };

/** Code fallback: the next unplayed worksheet question, else finish. Used on timeout, error or an invalid choice. */
export function fallbackNext(ws: TWorksheet, s: Session, why: string): NextStep {
  const q = ws.questions.find((x) => x.origin === "worksheet" && !s.played.includes(x.id));
  return q ? { action: "play", question: q, feedback: null, reason: `fallback: ${why}`, source: "fallback" }
           : { action: "finish", feedback: null, reason: `fallback: ${why}; all questions played`, source: "fallback" };
}

/** Apply the coach's decision with hard limits. The coach proposes; code decides what is allowed. */
export function applyDirector(ws: TWorksheet, s: Session, last: TAttempt, out: TDirectorOut, now = Date.now()): NextStep {
  const elapsed = (now - s.startedAt) / 1000;
  const unplayed = ws.questions.filter((x) => x.origin === "worksheet" && !s.played.includes(x.id));
  const fb = out.feedback;
  if (out.action === "finish") {
    if (unplayed.length === 0 || elapsed >= 0.8 * s.timeBudgetSec) return { action: "finish", feedback: fb, reason: out.reason, source: "coach" };
    return { ...fallbackNext(ws, s, "coach tried to finish early"), feedback: fb };
  }
  if (out.action === "next") {
    const q = unplayed.find((x) => x.id === out.nextQuestionId);
    return q ? { action: "play", question: q, feedback: fb, reason: out.reason, source: "coach" } : { ...fallbackNext(ws, s, `unknown question ${out.nextQuestionId}`), feedback: fb };
  }
  // variant / probe: limits, then the SAME code checks as a scanned question
  const sameTarget = s.variants.filter((v) => v.target === out.targetMisconceptionId).length;
  if (s.variants.length >= 3 || sameTarget >= 2) return { ...fallbackNext(ws, s, "variant limit reached"), feedback: fb };
  if (elapsed > s.timeBudgetSec - 20) return { ...fallbackNext(ws, s, "no time for a variant"), feedback: fb };
  if (!out.newQuestion) return { ...fallbackNext(ws, s, "variant had no question"), feedback: fb };
  const id = `${last.questionId.split("v")[0]}v${s.variants.length + 1}`;
  const reg = [...ws.misconceptions, ...out.newMisconceptions];
  const design = { ...out.newQuestion.design, id, misconceptions: [...out.newQuestion.design.misconceptions, ...reg.filter((m) => !out.newQuestion!.design.misconceptions.some((x) => x.id === m.id))] };
  const built = assemble({ ...out.newQuestion.read, id, printedAnswer: null }, design, "variant", last.questionId);
  if (!built.question) return { ...fallbackNext(ws, s, "coach's question failed the code check"), feedback: fb, rejected: built.errors };
  return { action: "play", question: built.question, feedback: fb, reason: out.reason, source: "coach" };
}

/** Agent 6 guard: every number in the AI's teacher summary must exist in the computed stats or the label text.
 *  Dates/times and long ids are skipped (they'd allow almost any number), and simple percentages of real counts are allowed. */
export function numbersAllowed(text: string, statsAndLabels: unknown): boolean {
  const allowed = new Set<number>(); const ints: number[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "number") { allowed.add(v); if (Number.isInteger(v) && v >= 0 && v <= 500) ints.push(v); }
    else if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^[0-9a-f]{12,}$/i.test(v)) return;   // ISO dates, Mongo ids
      for (const m of v.match(/\d+(\.\d+)?/g) ?? []) allowed.add(Number(m));
    }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(statsAndLabels);
  for (const a of ints) for (const b of ints) if (b > 0 && a <= b) allowed.add(Math.round((100 * a) / b));
  return (text.match(/\d+(\.\d+)?/g) ?? []).every((n) => allowed.has(Number(n)));
}
