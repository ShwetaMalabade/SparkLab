// POST /api/class {timeBudgetSec?, worksheetId?} → {code}   (docs/plan/02 §6.4, 06 §1)
// Called by Landing on load, so the QR + code are on screen before the scan.
// With worksheetId ("Use last scan") the class is linked at once and no scan is needed.
import { z } from "zod";
import { newClassCode } from "@/lib/classCode";
import { db, DuplicateIdError } from "@/lib/db";
import { json, jsonError, readBody } from "@/lib/http";

const Body = z.object({
  timeBudgetSec: z.number().int().min(60).max(3600).default(600),
  worksheetId: z.string().min(1).max(64).optional(),
});

export async function POST(req: Request) {
  const body = await readBody(req, Body, 2_000);
  if (!body.ok) return body.res;
  const { timeBudgetSec, worksheetId } = body.data;
  if (worksheetId && !(await db.findOne("worksheets", { _id: worksheetId }))) return jsonError(404, `No worksheet ${worksheetId}.`);

  for (let tries = 0; tries < 5; tries++) {
    const code = newClassCode();
    try {
      await db.insert("classes", { _id: code, worksheetId: worksheetId ?? null, timeBudgetSec });
      // Classmates (Agent 5, P2-20) will be started here for worksheetId, if Merge 2 is green.
      return json({ code });
    } catch (e) {
      if (!(e instanceof DuplicateIdError)) throw e;
    }
  }
  return jsonError(503, "Couldn't find a free class code; try again.");
}
