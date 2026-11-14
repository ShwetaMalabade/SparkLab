// src/lib/agents/reader.ts — Agent 1, Reader-Solver (vision model). docs/plan/03 §1, §5.
// Reads the worksheet photo and solves it. Its output is only a DRAFT (ReadOut):
// assemble() and the code checks decide what a student ever sees.
import { z } from "zod";
import { askJSON, type AskResult } from "../ai";
import { READER_PROMPT, REPAIR_PROMPT } from "../prompts";
import { ReadOut, ReadQuestion } from "../schema";

// askJSON infers T from the schema's INPUT type (fields with .default() look optional), but it returns
// schema.safeParse(...).data, the OUTPUT type with defaults filled in. The cast states the real runtime type.
export type TReadOut = z.infer<typeof ReadOut>;
type Ctx = { classCode?: string; reason?: string };

/** Real reads (2026-11-14) sometimes had a concept over 60 chars, which failed the whole page. Trim the text fields
 *  that have length limits, keep every question that then passes the draft schema, and only if none pass return the
 *  real errors (for repair). Numbers are never touched: code checks those. Exported for tests. */
export const LenientReadOut = z.preprocess((v) => {
  const o = v as { questions?: unknown } | null;
  if (!o || !Array.isArray(o.questions)) return v;
  const trimmed = o.questions.map((q) =>
    q && typeof q === "object" && typeof (q as { concept?: unknown }).concept === "string"
      ? { ...(q as object), concept: (q as { concept: string }).concept.slice(0, 60) }
      : q,
  );
  const good = trimmed.filter((q) => ReadQuestion.safeParse(q).success);
  return { ...o, questions: good.length ? good : trimmed };
}, ReadOut);

export function readWorksheet(image: Uint8Array, ctx: Ctx = {}): Promise<AskResult<TReadOut>> {
  return askJSON("reader", LenientReadOut, READER_PROMPT(), { image, ctx: { ...ctx, reason: ctx.reason ?? "scan" } }) as Promise<AskResult<TReadOut>>;
}

/** Send the reader its own draft plus code's error list. Pass the image only when the page itself must be re-read. */
export function repairRead(badJson: string, errors: string[], opts: { image?: Uint8Array; ctx?: Ctx } = {}): Promise<AskResult<TReadOut>> {
  return askJSON("reader", LenientReadOut, REPAIR_PROMPT(badJson, errors), { image: opts.image, ctx: { ...opts.ctx, reason: "repair" } }) as Promise<AskResult<TReadOut>>;
}
