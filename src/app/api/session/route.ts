// POST /api/session NewSession → {sessionId, timeBudgetSec}   (docs/plan/02 §6.3–6.4)
// Called at the end of Calibrate. Time budget: the body's, else the class's (picked on Landing), else 600 s.
import { db } from "@/lib/db";
import { json, readBody } from "@/lib/http";
import { NewSession } from "@/lib/schema";

export async function POST(req: Request) {
  const body = await readBody(req, NewSession, 2_000);
  if (!body.ok) return body.res;
  const s = body.data;
  const cls = await db.findOne<{ _id: string; createdAt: Date; timeBudgetSec?: number }>("classes", { _id: s.classCode });
  const timeBudgetSec = typeof body.raw.timeBudgetSec === "number" ? s.timeBudgetSec : (cls?.timeBudgetSec ?? s.timeBudgetSec);
  const sessionId = await db.insert(
    "sessions",
    {
      classCode: s.classCode,
      nickname: s.nickname,
      worksheetId: s.worksheetId,
      mode: s.mode,
      timeBudgetSec,
      simulated: false,
      studentModel: { concepts: {}, notes: "" },
      played: [],
      variants: [],
      startedAt: new Date(),
      endedAt: null,
    },
    "s",
  );
  return json({ sessionId, timeBudgetSec });
}
