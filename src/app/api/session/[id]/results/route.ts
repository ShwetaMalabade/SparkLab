// GET /api/session/[id]/results → Results (docs/plan/07 §2 screen 6). Every number is counted by code.
import { json, jsonError } from "@/lib/http";
import { sessionResults } from "@/lib/sessionResults";

export async function GET(_req: Request, ctx: RouteContext<"/api/session/[id]/results">) {
  const { id } = await ctx.params;
  if (!id || id.length > 64) return jsonError(400, "Bad session id.");
  const r = await sessionResults(id);
  return r ? json(r) : jsonError(404, `No session ${id}.`);
}
