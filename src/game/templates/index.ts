// src/game/templates/index.ts: question.template → template. Unknown or invalid props → Answer Balloons (05 §1).
import type { TQuestion } from "@/lib/schema";
import { AnswerBalloons } from "./AnswerBalloons";
import { EquationBalancer } from "./EquationBalancer";
import { MixLab } from "./MixLab";
import { ProjectileLauncher } from "./ProjectileLauncher";
import type { TemplateDef } from "./types";
import { speciesOf } from "../balancer";

export type TemplateName = TQuestion["template"];

/** Runtime check: a template only runs when the question carries what it needs. */
export function templateFits(q: TQuestion, name: TemplateName): boolean {
  switch (name) {
    case "projectile_launcher":
      return typeof q.given.v?.value === "number" && typeof q.given.theta?.value === "number";
    case "mix_lab":
      return !!q.reaction && q.reaction.reactants.length >= 2;
    case "equation_balancer":
      return !!q.equation && speciesOf(q) !== null;
    default:
      return true;
  }
}

// Phase 2/3 templates (Launcher P1-12, Mix Lab P1-14, Balancer P1-16) register here when built.
const REGISTRY: Partial<Record<TemplateName, TemplateDef>> = {
  answer_balloons: AnswerBalloons,
  projectile_launcher: ProjectileLauncher,
  mix_lab: MixLab,
  equation_balancer: EquationBalancer,
};

export function pickTemplate(q: TQuestion): { def: TemplateDef; name: TemplateName } {
  const def = REGISTRY[q.template];
  if (def && templateFits(q, q.template)) return { def, name: q.template };
  return { def: AnswerBalloons, name: "answer_balloons" };
}
