// POST /api/session/[id]/end → {ok}. Sets endedAt.
import { db } from "@/lib/db";
import { json, jsonError } from "@/lib/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/session/[id]/end">) {
  const { id } = await ctx.params;
  const n = await db.update("sessions", { _id: id }, { $set: { endedAt: new Date() } });
  return n ? json({ ok: true }) : jsonError(404, `No session ${id}.`);
}
