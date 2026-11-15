// src/game/lab/lessons.ts: what each subject room teaches. Molecules are counted by code (molecules.ts);
// every equation is atom-checked in tests (isBalanced). Explanations are short and classroom-safe ("Virtual only").
import type { RoomId } from "@/three/lab/LabWorld";
import { MOLECULE_QUESTIONS, ORGANIC_QUESTIONS, type MoleculeQuestion } from "../molecules";

export type Liquid = { formula: string; name: string; color: string };
export type PourExperiment = {
  id: string;
  prompt: string;
  a: Liquid;
  b: Liquid;
  result: {
    kind: "precipitate" | "color" | "bubbles";
    color: string;
    /** Balanced, ASCII arrows; shown with ChemText. */
    equation: string;
    observation: string;
    why: string[];
    hazard?: string;
  };
};

export type Activity = { kind: "build"; q: MoleculeQuestion } | { kind: "pour"; x: PourExperiment } | { kind: "experiments" };

export const POURS: Record<string, PourExperiment> = {
  pbi2: {
    id: "pbi2",
    prompt: "Pour lead(II) nitrate and potassium iodide into the flask. What happens?",
    a: { formula: "Pb(NO3)2", name: "lead(II) nitrate", color: "#E8F4F8" },
    b: { formula: "KI", name: "potassium iodide", color: "#E8F4F8" },
    result: {
      kind: "precipitate", color: "#FFD21F", equation: "Pb(NO3)2 + 2KI -> PbI2 + 2KNO3",
      observation: "A bright yellow solid rains down: lead(II) iodide.",
      why: ["The ions swap partners: Pb²⁺ meets I⁻.", "PbI₂ does not dissolve in water, so it falls out as a solid (a precipitate).", "K⁺ and NO₃⁻ stay dissolved: they are spectator ions."],
      hazard: "Lead compounds are toxic",
    },
  },
  neutralize: {
    id: "neutralize",
    prompt: "The flask will hold acid with an indicator. Pour in the acid, then the base. Watch the colour.",
    a: { formula: "HCl", name: "hydrochloric acid + phenolphthalein", color: "#E8F4F8" },
    b: { formula: "NaOH", name: "sodium hydroxide (a little extra)", color: "#E8F4F8" },
    result: {
      kind: "color", color: "#E0218A", equation: "HCl + NaOH -> NaCl + H2O",
      observation: "Colourless turns pink.",
      why: ["H⁺ from the acid and OH⁻ from the base make water: neutralisation.", "Once all the acid is used up, the extra OH⁻ raises the pH above 8.2.", "Phenolphthalein is colourless in acid and pink in base, so the flask turns pink."],
      hazard: "Strong acids and bases are corrosive",
    },
  },
  fizz: {
    id: "fizz",
    prompt: "Pour vinegar and baking soda together. What do you see?",
    a: { formula: "CH3COOH", name: "vinegar (acetic acid)", color: "#F3F0E6" },
    b: { formula: "NaHCO3", name: "baking soda solution", color: "#E8F4F8" },
    result: {
      kind: "bubbles", color: "#F3F0E6", equation: "NaHCO3 + CH3COOH -> CH3COONa + H2O + CO2",
      observation: "Lots of fizzing bubbles.",
      why: ["An acid reacts with a carbonate (bicarbonate).", "One product is carbon dioxide gas, CO₂, which bubbles out.", "That's the same gas you breathe out."],
    },
  },
};

const INORGANIC_BUILD = MOLECULE_QUESTIONS.filter((q) => q.formula === "H2O" || q.formula === "NH3");

export const LESSONS: Record<RoomId, { title: string; activities: Activity[] }> = {
  balance: { title: "Organic Chemistry", activities: ORGANIC_QUESTIONS.map((q) => ({ kind: "build", q })) },
  mix: { title: "Inorganic Chemistry", activities: [...INORGANIC_BUILD.map((q) => ({ kind: "build" as const, q })), { kind: "pour", x: POURS.pbi2 }] },
  titration: { title: "Acids & Bases", activities: [{ kind: "pour", x: POURS.neutralize }, { kind: "pour", x: POURS.fizz }] },
  // Experiments Lab (was the empty "Physical Chemistry, coming soon" room): a menu of hands-on experiments
  // (ExperimentsHub), chemistry computed by code in src/game/experiments.ts.
  study: { title: "Experiments Lab", activities: [{ kind: "experiments" }] },
};
