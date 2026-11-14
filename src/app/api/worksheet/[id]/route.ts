// GET   /api/worksheet/[id] → TWorksheet & {dropped}
// PATCH /api/worksheet/[id] {questionId, prompt?, given?: {symbol: number}} → updated worksheet
//   Re-runs CODE verification only (assemble on the saved agent drafts). No AI call. (docs/plan/02 §6.4)
import { z } from "zod";
import { assemble } from "@/lib/assemble";
import { json, jsonError, readBody } from "@/lib/http";
import { loadDrafts, loadDropped, loadWorksheet, replaceQuestion } from "@/lib/worksheetStore";

export async function GET(_req: Request, ctx: RouteContext<"/api/worksheet/[id]">) {
  const { id } = await ctx.params;
  const ws = await loadWorksheet(id);
  return ws ? json({ ...ws, dropped: await loadDropped(id) }) : jsonError(404, `No worksheet ${id}.`);
}

const Patch = z
  .object({
    questionId: z.string().min(1),
    prompt: z.string().min(1).max(600).optional(),
    given: z.record(z.string(), z.number().finite()).optional(), // new VALUES for existing symbols; units stay
  })
  .refine((b) => b.prompt !== undefined || b.given !== undefined, "Send a new prompt and/or given values.");

export async function PATCH(req: Request, ctx: RouteContext<"/api/worksheet/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(req, Patch, 5_000);
  if (!body.ok) return body.res;
  const { questionId, prompt, given } = body.data;

  const ws = await loadWorksheet(id);
  if (!ws) return jsonError(404, `No worksheet ${id}.`);
  const q = ws.questions.find((x) => x.id === questionId);
  const draft = (await loadDrafts(id))[questionId];
  if (!q || !draft) return jsonError(404, `No question ${questionId} in ${id}.`);

  const unknownKeys = Object.keys(given ?? {}).filter((k) => !(k in draft.read.given));
  if (unknownKeys.length) return jsonError(400, `Unknown symbol(s): ${unknownKeys.join(", ")}.`);

  const read = {
    ...draft.read,
    ...(prompt !== undefined ? { prompt } : {}),
    given: Object.fromEntries(Object.entries(draft.read.given).map(([k, v]) => [k, given && k in given ? { ...v, value: given[k] } : v])),
  };
  const out = assemble(read, draft.design, q.origin, q.parentId);
  if (!out.question) return jsonError(422, "Code checks failed for these values; nothing was changed.", { errors: out.errors });

  await replaceQuestion(id, out.question, { read, design: draft.design });
  const updated = await loadWorksheet(id);
  return json({ ...updated, dropped: await loadDropped(id) });
}
