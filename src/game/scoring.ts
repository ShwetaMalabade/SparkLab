// src/game/scoring.ts: score rules (docs/plan/05 §1) and the AttemptInput built at LOCK-IN (CONTRACTS §6).
import type { AttemptInput } from "@/lib/client/api";
import type { TQuestion } from "@/lib/schema";
import type { GameSession, LockResult } from "./store";

/** +100 correct, +50 if answered in < 10 s, ×1.5 once you already have 3 correct in a row. Variants score the same. */
export function scoreAnswer(correct: boolean, msToAnswer: number, prevStreak: number): { points: number; streak: number } {
  if (!correct) return { points: 0, streak: 0 };
  const base = 100 + (msToAnswer < 10_000 ? 50 : 0);
  const mult = prevStreak >= 3 ? 1.5 : 1;
  return { points: Math.round(base * mult), streak: prevStreak + 1 };
}

/** Builds the attempt exactly as the schema allows (lengths capped so the server's Zod parse never rejects it). */
export function buildAttempt(s: GameSession, q: TQuestion, r: LockResult, msToAnswer: number): AttemptInput {
  return {
    classCode: s.classCode,
    sessionId: s.sessionId,
    worksheetId: s.worksheetId,
    questionId: q.id,
    questionOrigin: q.origin,
    chosen: r.chosen,
    chosenText: r.chosenText.slice(0, 60),
    correct: r.correct,
    misconceptionId: r.misconceptionId,
    msToAnswer: Math.max(0, Math.round(msToAnswer)),
    input: r.input,
    hoverTrace: r.hoverTrace.slice(-20).map((h) => ({ choice: h.choice, ms: Math.round(h.ms) })),
    experiments: (r.experiments ?? []).slice(0, 5),
    mixTries: (r.mixTries ?? []).slice(0, 4),
    balancerSteps: (r.balancerSteps ?? []).slice(-30),
  };
}
