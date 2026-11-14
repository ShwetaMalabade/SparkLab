// src/lib/agents/designer.ts — Agent 2, Mistake Modeler + Level Designer (fast model). docs/plan/03 §1, §5.
// Names likely mistakes, writes a WRONG FORMULA per mistake (code computes the value), and picks the 3D template.
// Its output is a DRAFT (DesignOut), validated with the draft schema, never the final Question.
import type { z } from "zod";
import { askJSON, type AskResult } from "../ai";
import { DESIGNER_PROMPT, REPAIR_PROMPT } from "../prompts";
import { DesignOut, Misconception, ReadQuestion } from "../schema";

// askJSON infers T from the schema's INPUT type (fields with .default() look optional), but it returns
// schema.safeParse(...).data, the OUTPUT type with defaults filled in. The cast states the real runtime type.
export type TDesignOut = z.infer<typeof DesignOut>;
type Ctx = { classCode?: string; reason?: string };

export function designQuestions(
  questions: z.infer<typeof ReadQuestion>[],
  registry: z.infer<typeof Misconception>[] = [],
  ctx: Ctx = {},
): Promise<AskResult<TDesignOut>> {
  return askJSON("designer", DesignOut, DESIGNER_PROMPT(JSON.stringify(questions), JSON.stringify(registry)), {
    ctx: { ...ctx, reason: ctx.reason ?? "scan" },
  }) as Promise<AskResult<TDesignOut>>;
}

export function repairDesign(badJson: string, errors: string[], ctx: Ctx = {}): Promise<AskResult<TDesignOut>> {
  return askJSON("designer", DesignOut, REPAIR_PROMPT(badJson, errors), { ctx: { ...ctx, reason: "repair" } }) as Promise<AskResult<TDesignOut>>;
}
