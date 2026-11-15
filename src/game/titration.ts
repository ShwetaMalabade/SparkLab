// src/game/titration.ts: the Titration Lab's rules (chemistry-plan/03-titration-lab.md), pure and tested.
// Every pH, volume and colour comes from src/lib/acidBase.ts; the answer choices are built by code, not the AI.
import { equivalenceML, indicatorColor, phAt, type Indicator, type Scenario } from "@/lib/acidBase";

/** Demo question (plan §2): unequal concentrations on purpose, so dripping to 25 mL is visibly wrong. */
export const TITRATION_DEMO: Scenario & { indicator: Indicator; names: { analyte: string; titrant: string } } = {
  analyte: { formula: "HCl", molarity: 0.1, volumeML: 25 },
  titrant: { formula: "NaOH", molarity: 0.2 },
  indicator: "phenolphthalein",
  names: { analyte: "hydrochloric acid", titrant: "sodium hydroxide" },
};

export const DROP_ML = 0.05; // one burette drop
export const BURETTE_ML = 50; // the scale on the burette
/** Stopcock opening p (0 = closed … 1 = wide open) → mL per second. Closed below 0.10 (plan §2.2: 0.05 + p·2.0). */
export const dripRate = (p: number) => (p < 0.1 ? 0 : 0.05 + Math.min(1, p) * 2.0);

export type StopWindow = "too_early" | "endpoint" | "overshot";
/** Where the student stopped, judged against the first lasting pink (plan §2.2 table). */
export function stopWindow(stoppedML: number, eqML = equivalenceML(TITRATION_DEMO)): StopWindow {
  if (stoppedML < eqML - 1e-6) return "too_early";
  if (stoppedML <= eqML + 0.2 + 1e-6) return "endpoint"; // 12.50–12.70 mL for the demo
  return "overshot";
}
export const WINDOW_TEXT: Record<StopWindow, string> = {
  too_early: "You stopped too early: the flask was still colorless and the pH hadn't jumped yet.",
  endpoint: "Great stop: right at the first lasting pink (the endpoint).",
  overshot: "You went past the endpoint: the deep magenta means extra NaOH is in the flask.",
};

/** State of the flask after `ml` of titrant (pH, indicator colour). */
export function flaskAt(ml: number) {
  const pH = phAt(TITRATION_DEMO, ml);
  return { pH, ...indicatorColor(TITRATION_DEMO.indicator, pH) };
}

export type Choice = { id: "A" | "B" | "C" | "D"; text: string; correct: boolean; tag: string | null; why: string };
/** The four notebook answers (plan §2.3), computed from the scenario so any numbers would work. */
export function titrationChoices(s: Scenario = TITRATION_DEMO): Choice[] {
  const eq = equivalenceML(s), Va = s.analyte.volumeML, Ma = s.analyte.molarity, Mb = s.titrant.molarity;
  const nA = (Ma * Va) / 1000;
  const f = (v: number) => v.toFixed(2);
  return [
    { id: "A", text: `${f(Va)} mL`, correct: false, tag: "used_volumes_not_moles", why: `That matches the volumes and ignores that the NaOH is ${Mb.toFixed(3)} M, ${+(Mb / Ma).toFixed(2)}× as concentrated.` },
    { id: "B", text: `${f(eq)} mL`, correct: true, tag: null, why: `Moles of HCl = ${Ma.toFixed(3)} × ${(Va / 1000).toFixed(5)} = ${nA.toFixed(5)} mol. V(NaOH) = ${nA.toFixed(5)} ÷ ${Mb.toFixed(3)} = ${(eq / 1000).toFixed(5)} L = ${f(eq)} mL.` },
    { id: "C", text: `${f((Mb * Va) / Ma)} mL`, correct: false, tag: "swapped_molarities", why: `Those molarities were flipped: that's (${Mb.toFixed(3)} × ${f(Va)}) ÷ ${Ma.toFixed(3)}.` },
    { id: "D", text: `${f(eq)} L`, correct: false, tag: "forgot_ml_to_l", why: `${f(eq)} is the right number in milliliters, not liters.` },
  ];
}
export const TAG_LABEL: Record<string, string> = {
  used_volumes_not_moles: "Matched volumes, ignored concentration",
  swapped_molarities: "Swapped the molarities",
  forgot_ml_to_l: "Right digits, wrong unit (mL vs L)",
};
