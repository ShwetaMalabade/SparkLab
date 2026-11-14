// src/lib/agents/designer.ts — Agent 2, Mistake Modeler + Level Designer (fast model). docs/plan/03 §1, §5.
// Names likely mistakes, writes a WRONG FORMULA per mistake (code computes the value), and picks the 3D template.
// Its output is a DRAFT (DesignOut), validated with the draft schema, never the final Question.
import { z } from "zod";
import { askJSON, type AskResult } from "../ai";
import { DESIGNER_PROMPT, REPAIR_PROMPT } from "../prompts";
import { DesignOut, DesignQuestion, Misconception, ReadQuestion } from "../schema";

// askJSON infers T from the schema's INPUT type (fields with .default() look optional), but it returns
// schema.safeParse(...).data, the OUTPUT type with defaults filled in. The cast states the real runtime type.
export type TDesignOut = z.infer<typeof DesignOut>;
type Ctx = { classCode?: string; reason?: string };

/** Real model output (2026-11-14) often had a 5th misconception or 6th wrong option, and one bad question failed the
 *  whole scan. So: trim the overflow (code still checks every option it keeps), keep each question that passes the
 *  draft schema, and leave the rest out; ingest designs those again. If none pass, the real errors go to repair. */
export const trimOverflow = (q: unknown) => {
  if (!q || typeof q !== "object") return q;
  const o = { ...(q as Record<string, unknown>) };
  if (Array.isArray(o.misconceptions) && o.misconceptions.length > 4) {
    o.misconceptions = o.misconceptions.slice(0, 4);
    // Drop the options tied to a mistake we cut, if enough spares remain (else code reports them for repair).
    const kept = new Set((o.misconceptions as { id?: unknown }[]).map((m) => m?.id));
    if (Array.isArray(o.wrong)) {
      const tied = o.wrong.filter((w) => kept.has((w as { misconceptionId?: unknown } | null)?.misconceptionId));
      if (tied.length >= 3) o.wrong = tied;
    }
  }
  if (Array.isArray(o.wrong)) o.wrong = o.wrong.slice(0, 5);
  return o;
};
export const PerQuestionDesignOut = z.preprocess((v) => {
  const qs = (v as { questions?: unknown } | null)?.questions;
  if (!Array.isArray(qs)) return v;
  const trimmed = qs.map(trimOverflow);
  const good = trimmed.filter((q) => DesignQuestion.safeParse(q).success);
  return { questions: good.length ? good : trimmed };
}, DesignOut);

export function designQuestions(
  questions: z.infer<typeof ReadQuestion>[],
  registry: z.infer<typeof Misconception>[] = [],
  ctx: Ctx = {},
): Promise<AskResult<TDesignOut>> {
  return askJSON("designer", PerQuestionDesignOut, DESIGNER_PROMPT(JSON.stringify(questions), JSON.stringify(registry)), {
    ctx: { ...ctx, reason: ctx.reason ?? "scan" },
  }) as Promise<AskResult<TDesignOut>>;
}

export function repairDesign(badJson: string, errors: string[], ctx: Ctx = {}): Promise<AskResult<TDesignOut>> {
  return askJSON("designer", PerQuestionDesignOut, REPAIR_PROMPT(badJson, errors), { ctx: { ...ctx, reason: "repair" } }) as Promise<AskResult<TDesignOut>>;
}
