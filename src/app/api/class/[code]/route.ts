// GET /api/class/[code] → ClassStats (docs/plan/06 §4). Polled every 2 s by the teacher's phone.
import { classStats } from "@/lib/classStats";
import { normalizeClassCode } from "@/lib/classCode";
import { json, jsonError } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/class/[code]">) {
  const code = normalizeClassCode((await ctx.params).code);
  if (!code) return jsonError(400, "Class codes are 4 letters or digits.");
  const stats = await classStats(code);
  return stats ? json(stats) : jsonError(404, `No class ${code}.`);
}
