// POST /api/attempt Attempt → {ok, attemptId}   (docs/plan/02 §6.4)
// Zod-checked, ≤ 10 KB, server sets createdAt. Attempts are the source of truth for what's been played,
// so the questionId is also pushed to session.played.
import { db } from "@/lib/db";
import { json, jsonError, readBody } from "@/lib/http";
import { Attempt } from "@/lib/schema";

export async function POST(req: Request) {
  const body = await readBody(req, Attempt, 10_000);
  if (!body.ok) return body.res;
  const a = { ...body.data, simulated: false }; // only Agent 5 writes simulated attempts, never a client
  const session = await db.findOne<{ _id: string; createdAt: Date; classCode: string }>("sessions", { _id: a.sessionId });
  if (!session) return jsonError(404, `No session ${a.sessionId}.`);
  if (session.classCode !== a.classCode) return jsonError(400, "classCode doesn't match the session.");
  const attemptId = await db.insert("attempts", a, "a");
  await db.update("sessions", { _id: a.sessionId }, { $push: { played: a.questionId } });
  return json({ ok: true, attemptId });
}
