// POST /api/next {sessionId, attemptId?, attempt?} → NextStep & {ms}   (docs/plan/02 §6.4, 03 §9)
// The AI coach (Agent 4) proposes; code enforces the limits and re-checks any new question.
// The client gives up after 6 s and uses its own code fallback, so this must never hang the game.
import { z } from "zod";
import { decideNext } from "@/lib/coach";
import { json, jsonError, readBody } from "@/lib/http";
import { Attempt } from "@/lib/schema";

export const maxDuration = 15;

const Body = z.object({
  sessionId: z.string().min(1).max(64),
  attemptId: z.string().max(64).nullable().optional(),
  attempt: Attempt.omit({ simulated: true }).nullable().optional(),
});

export async function POST(req: Request) {
  const body = await readBody(req, Body, 12_000);
  if (!body.ok) return body.res;
  const r = await decideNext(body.data);
  return r.ok ? json(r.step) : jsonError(r.status, r.error);
}
