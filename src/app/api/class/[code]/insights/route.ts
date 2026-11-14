// POST /api/class/[code]/insights → Insight (docs/plan/03 §11, 06 §6). The phone calls it every 20 s or on tap.
// Agent 6 words the class's computed stats; code checks every number and replaces failing text.
import { normalizeClassCode } from "@/lib/classCode";
import { json, jsonError } from "@/lib/http";
import { classInsight } from "@/lib/insight";

export const maxDuration = 15;

export async function POST(_req: Request, ctx: RouteContext<"/api/class/[code]/insights">) {
  const code = normalizeClassCode((await ctx.params).code);
  if (!code) return jsonError(400, "Class codes are 4 letters or digits.");
  const r = await classInsight(code);
  return r.ok ? json(r.insight) : jsonError(r.status, r.error);
}
