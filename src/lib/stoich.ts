// src/lib/stoich.ts — the Reaction Yield Lab (mass-to-mass and mass-to-gas-volume stoichiometry), computed by code.
// Pure: safe on the server and in the browser. The AI names the equation, the measured reactant and its mass, and
// what to find; molar masses, moles, the yield and the gas volume all come from here.
import { isBalanced, normalizeChem, parseFormula, splitEquation } from "./chem";

// Standard atomic weights (IUPAC, rounded as on a school periodic table).
const ATOMIC: Record<string, number> = {
  H: 1.008, He: 4.003, Li: 6.94, Be: 9.012, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Ne: 20.18,
  Na: 22.99, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948, K: 39.098, Ca: 40.078,
  Cr: 51.996, Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, Br: 79.904, Ag: 107.868,
  Sn: 118.71, I: 126.904, Ba: 137.327, Au: 196.967, Hg: 200.59, Pb: 207.2,
};

/** g/mol from the formula, or null if it has an element outside the table. */
export function molarMass(formula: string): number | null {
  const counts = parseFormula(formula);
  const els = Object.keys(counts);
  if (!els.length) return null;
  let m = 0;
  for (const el of els) {
    if (!(el in ATOMIC)) return null;
    m += ATOMIC[el] * counts[el];
  }
  return m;
}

/** Gases at room temperature (the lab shows a gas syringe filling for these). */
const GASES = new Set(["H2", "O2", "N2", "CO2", "CO", "Cl2", "NH3", "SO2", "NO2", "NO", "CH4", "C2H6", "C3H8", "HCl", "H2S", "F2", "He", "Ne", "Ar"]);
export const isGas = (formula: string) => GASES.has(normalizeChem(formula).replace(/\s+/g, ""));

/** Gas molar volumes a worksheet may use (L/mol): STP 22.4 (or 22.7 at 1 bar), room temperature 24.0 / 24.5. */
export const GAS_MOLAR_VOLUMES = [22.4, 22.7, 24.0, 24.5] as const;

export type StoichScenario = {
  equation: string; // balanced
  known: { formula: string; massG: number }; // the reactant the student weighs
  target: { formula: string }; // the product (or reactant) asked for
  ask: "mass_g" | "gas_volume_ml" | "moles";
  gasMolarVolumeL: number | null; // only for gas_volume_ml
};

export type StoichResult = {
  coefKnown: number;
  coefTarget: number;
  mmKnown: number;
  mmTarget: number;
  molesKnown: number;
  molesTarget: number;
  answer: number; // in the asked unit: g, mL or mol
};

const same = (a: string, b: string) => normalizeChem(a).replace(/\s+/g, "") === normalizeChem(b).replace(/\s+/g, "");

/** Code's check + the full chain: grams → moles (÷ M) → mole ratio from the coefficients → target moles → g, mL or mol. */
export function solveStoich(s: StoichScenario): { ok: true; r: StoichResult } | { ok: false; error: string } {
  const b = isBalanced(s.equation);
  if (b.error) return { ok: false, error: b.error };
  if (!b.balanced) return { ok: false, error: `the equation isn't balanced: ${JSON.stringify(b.diff)}` };
  const sp = splitEquation(s.equation)!;
  const terms = [...sp.left, ...sp.right];
  const k = terms.find((t) => same(t.formula, s.known.formula));
  const t = terms.find((x) => same(x.formula, s.target.formula));
  if (!k) return { ok: false, error: `${s.known.formula} is not in the equation` };
  if (!t) return { ok: false, error: `${s.target.formula} is not in the equation` };
  if (!sp.left.some((x) => same(x.formula, s.known.formula))) return { ok: false, error: `the weighed substance ${s.known.formula} must be a reactant` };
  const mmK = molarMass(k.formula), mmT = molarMass(t.formula);
  if (mmK == null || mmT == null) return { ok: false, error: `unknown element in ${mmK == null ? k.formula : t.formula}` };
  if (!(s.known.massG > 0 && s.known.massG <= 1000)) return { ok: false, error: `mass ${s.known.massG} g is out of range` };
  const molesKnown = s.known.massG / mmK;
  const molesTarget = (molesKnown * t.coef) / k.coef;
  let answer: number;
  if (s.ask === "gas_volume_ml" && !isGas(t.formula)) return { ok: false, error: `${t.formula} isn't a gas, so it has no gas volume` };
  if (s.ask === "mass_g") answer = molesTarget * mmT;
  else if (s.ask === "moles") answer = molesTarget;
  else {
    const vm = s.gasMolarVolumeL;
    if (vm == null || !GAS_MOLAR_VOLUMES.some((x) => Math.abs(x - vm) < 1e-6)) return { ok: false, error: `gas molar volume must be one of ${GAS_MOLAR_VOLUMES.join(", ")} L/mol` };
    answer = molesTarget * vm * 1000;
  }
  return { ok: true, r: { coefKnown: k.coef, coefTarget: t.coef, mmKnown: mmK, mmTarget: mmT, molesKnown, molesTarget, answer } };
}
