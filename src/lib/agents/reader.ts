// src/lib/agents/reader.ts — Agent 1, Reader-Solver (vision model). docs/plan/03 §1, §5.
// Reads the worksheet photo and solves it. Its output is only a DRAFT (ReadOut):
// assemble() and the code checks decide what a student ever sees.
import type { z } from "zod";
import { askJSON, type AskResult } from "../ai";
import { READER_PROMPT, REPAIR_PROMPT } from "../prompts";
import { ReadOut } from "../schema";

// askJSON infers T from the schema's INPUT type (fields with .default() look optional), but it returns
// schema.safeParse(...).data, the OUTPUT type with defaults filled in. The cast states the real runtime type.
export type TReadOut = z.infer<typeof ReadOut>;
type Ctx = { classCode?: string; reason?: string };

export function readWorksheet(image: Uint8Array, ctx: Ctx = {}): Promise<AskResult<TReadOut>> {
  return askJSON("reader", ReadOut, READER_PROMPT(), { image, ctx: { ...ctx, reason: ctx.reason ?? "scan" } }) as Promise<AskResult<TReadOut>>;
}

/** Send the reader its own draft plus code's error list. Pass the image only when the page itself must be re-read. */
export function repairRead(badJson: string, errors: string[], opts: { image?: Uint8Array; ctx?: Ctx } = {}): Promise<AskResult<TReadOut>> {
  return askJSON("reader", ReadOut, REPAIR_PROMPT(badJson, errors), { image: opts.image, ctx: { ...opts.ctx, reason: "repair" } }) as Promise<AskResult<TReadOut>>;
}
