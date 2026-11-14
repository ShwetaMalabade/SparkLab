// src/game/molecules.ts: Molecule Builder rules. Pure functions (tested). Every count comes from parseFormula
// (@/lib/chem), so the feedback is computed by code, never guessed.
import { parseFormula } from "@/lib/chem";

export type MoleculeQuestion = {
  id: string;
  /** What the student reads. */
  prompt: string;
  /** Plain ASCII formula, e.g. "H2O". */
  formula: string;
  name: string;
  /** Atoms floating around: the right ones + tempting wrong ones. */
  palette: string[];
  /** One teaching line shown when it's built. */
  fact: string;
};

/** Organic room: carbon molecules. */
export const ORGANIC_QUESTIONS: MoleculeQuestion[] = [
  { id: "o1", prompt: "Build methane, the gas in a Bunsen burner.", formula: "CH4", name: "methane", palette: ["C", "H", "O", "N"], fact: "Carbon makes 4 bonds, so it holds 4 hydrogens in a tetrahedron. Methane is the simplest organic molecule." },
  { id: "o2", prompt: "Build ethane: two carbons joined together.", formula: "C2H6", name: "ethane", palette: ["C", "H", "O", "N"], fact: "Carbon can bond to carbon. That C–C chain is what all of organic chemistry is built on." },
  { id: "o3", prompt: "Build methanol, the simplest alcohol.", formula: "CH3OH", name: "methanol", palette: ["C", "H", "O", "N"], fact: "Swap one H in methane for an –OH group and you get an alcohol." },
];

/** Demo set until the curated list arrives. Distractors are the usual mix-ups. */
export const MOLECULE_QUESTIONS: MoleculeQuestion[] = [
  { id: "m1", prompt: "What is the formula of water? Build it!", formula: "H2O", name: "water", palette: ["H", "O", "C", "N"], fact: "Two hydrogens bond to one oxygen. The molecule is bent (about 104.5°)." },
  { id: "m2", prompt: "Build carbon dioxide, the gas you breathe out.", formula: "CO2", name: "carbon dioxide", palette: ["C", "O", "H", "N"], fact: "One carbon, two oxygens, in a straight line: O=C=O." },
  { id: "m3", prompt: "Build methane, the gas in a Bunsen burner.", formula: "CH4", name: "methane", palette: ["C", "H", "O", "N"], fact: "Carbon makes 4 bonds, so it holds 4 hydrogens in a tetrahedron." },
  { id: "m4", prompt: "Build ammonia.", formula: "NH3", name: "ammonia", palette: ["N", "H", "O", "C"], fact: "Nitrogen makes 3 bonds: three hydrogens in a pyramid." },
];

export const ELEMENT_NAME: Record<string, string> = {
  H: "hydrogen", O: "oxygen", C: "carbon", N: "nitrogen", Cl: "chlorine", Na: "sodium", S: "sulfur", K: "potassium",
};
const nm = (el: string) => ELEMENT_NAME[el] ?? el;
const plural = (n: number, el: string) => `${n} ${nm(el)}${n === 1 ? "" : "s"}`;

export type Counts = Record<string, number>;
export const targetCounts = (formula: string): Counts => parseFormula(formula);

/** Join "H and O" / "C, H and O". */
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export type AddResult =
  | { ok: true; counts: Counts; done: boolean; message: string }
  | { ok: false; reason: "wrong_element" | "too_many"; message: string };

/** Try to add one atom to the build (the student's grab + drop). */
export function addAtom(q: MoleculeQuestion, current: Counts, el: string): AddResult {
  const target = targetCounts(q.formula);
  if (!target[el]) {
    const els = Object.keys(target).map(nm);
    return { ok: false, reason: "wrong_element", message: `${cap(nm(el))} isn't in ${q.name}. ${cap(q.name)} is made of ${list(els)} only.` };
  }
  const have = current[el] ?? 0;
  if (have >= target[el]) {
    return { ok: false, reason: "too_many", message: `${cap(q.name)} has only ${plural(target[el], el)}.` };
  }
  const counts = { ...current, [el]: have + 1 };
  const done = isDone(target, counts);
  return { ok: true, counts, done, message: done ? builtLine(q, target) : progressLine(q, target, counts) };
}

export const isDone = (target: Counts, counts: Counts) =>
  Object.keys(target).every((k) => (counts[k] ?? 0) === target[k]) && Object.keys(counts).every((k) => target[k]);

/** "You have 1 hydrogen and 1 oxygen. Water needs 2 hydrogens: add 1 more." */
export function progressLine(q: MoleculeQuestion, target: Counts, counts: Counts): string {
  const missing = Object.keys(target).filter((k) => (counts[k] ?? 0) < target[k]);
  const have = Object.keys(counts).filter((k) => counts[k]).map((k) => plural(counts[k], k));
  const need = missing.map((k) => `${target[k] - (counts[k] ?? 0)} more ${nm(k)}`);
  return `You have ${list(have)}. ${cap(q.name)} needs ${list(need)}.`;
}

export const builtLine = (q: MoleculeQuestion, target: Counts) =>
  `${list(Object.keys(target).map((k) => plural(target[k], k)))} = ${q.formula} (${q.name})!`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Where each atom sits in the finished molecule (centre atom first), in molecule units. */
export function moleculeLayout(formula: string): { el: string; at: [number, number, number] }[] {
  // Chains (2 heavy atoms): each heavy atom keeps its own hydrogens.
  if (formula === "C2H6")
    return [
      { el: "C", at: [-0.38, 0, 0] }, { el: "C", at: [0.38, 0, 0] },
      { el: "H", at: [-0.72, 0.38, 0] }, { el: "H", at: [-0.72, -0.25, 0.32] }, { el: "H", at: [-0.72, -0.25, -0.32] },
      { el: "H", at: [0.72, 0.38, 0] }, { el: "H", at: [0.72, -0.25, 0.32] }, { el: "H", at: [0.72, -0.25, -0.32] },
    ];
  if (formula === "CH3OH")
    return [
      { el: "C", at: [-0.3, 0, 0] }, { el: "O", at: [0.42, 0.08, 0] },
      { el: "H", at: [-0.66, 0.38, 0] }, { el: "H", at: [-0.62, -0.28, 0.32] }, { el: "H", at: [-0.62, -0.28, -0.32] },
      { el: "H", at: [0.8, -0.25, 0] },
    ];
  const t = targetCounts(formula);
  const els = Object.keys(t);
  // Centre = the element with the fewest atoms that isn't H (O in H2O, C in CO2/CH4, N in NH3).
  const centre = els.filter((e) => e !== "H").sort((a, b) => t[a] - t[b])[0] ?? els[0];
  const rest = els.flatMap((e) => Array.from({ length: t[e] - (e === centre ? 1 : 0) }, () => e));
  const known: Record<number, [number, number, number][]> = {
    1: [[0.55, 0, 0]],
    2: formula === "CO2" ? [[-0.6, 0, 0], [0.6, 0, 0]] : [[-0.45, -0.32, 0], [0.45, -0.32, 0]], // linear CO2, bent H2O
    3: [[0, -0.2, 0.5], [-0.45, -0.2, -0.25], [0.45, -0.2, -0.25]], // pyramid
    4: [[0.35, 0.35, 0.35], [-0.35, -0.35, 0.35], [-0.35, 0.35, -0.35], [0.35, -0.35, -0.35]], // tetrahedron
  };
  const spots = known[rest.length] ?? rest.map((_, i) => [Math.cos((i / rest.length) * Math.PI * 2) * 0.6, Math.sin((i / rest.length) * Math.PI * 2) * 0.6, 0] as [number, number, number]);
  return [{ el: centre, at: [0, 0, 0] }, ...rest.map((el, i) => ({ el, at: spots[i] }))];
}

// ---------------------------------------------------------------- combining pieces (H + H → H₂, H₂ + O → H₂O)

/** A piece's formula, elements in the order the target writes them (H2O → "H2O", "HO", "H2"); others after, A–Z. */
export function pieceFormula(counts: Counts, targetFormula: string): string {
  const order = Object.keys(targetCounts(targetFormula));
  const els = Object.keys(counts).filter((k) => counts[k] > 0);
  els.sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)) || a.localeCompare(b));
  return els.map((k) => `${k}${counts[k] > 1 ? counts[k] : ""}`).join("");
}

const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** "H2O" → "H₂O" for labels. */
export const subscript = (f: string) => f.replace(/(?<=[A-Za-z)])(\d+)/g, (d) => [...d].map((c) => SUB[+c]).join(""));

export type MergeResult =
  | { ok: true; counts: Counts; done: boolean; message: string }
  | { ok: false; reason: "wrong_element" | "too_many"; message: string };

/** Bond two pieces together. Allowed only if the result could still become the target molecule. */
export function mergePieces(q: MoleculeQuestion, a: Counts, b: Counts): MergeResult {
  const target = targetCounts(q.formula);
  const counts: Counts = { ...a };
  for (const [k, v] of Object.entries(b)) counts[k] = (counts[k] ?? 0) + v;
  const fa = subscript(pieceFormula(a, q.formula)), fb = subscript(pieceFormula(b, q.formula)), fc = subscript(pieceFormula(counts, q.formula));
  for (const k of Object.keys(counts)) {
    if (!target[k]) return { ok: false, reason: "wrong_element", message: `${cap(nm(k))} isn't in ${q.name}. ${cap(q.name)} is made of ${list(Object.keys(target).map(nm))} only.` };
    if (counts[k] > target[k]) return { ok: false, reason: "too_many", message: `${fa} + ${fb} would have ${plural(counts[k], k)}, but ${q.name} has only ${target[k]}.` };
  }
  const done = isDone(target, counts);
  return { ok: true, counts, done, message: done ? `${fa} + ${fb} → ${fc}: ${builtLine(q, target)}` : `${fa} + ${fb} → ${fc}. ${progressLine(q, target, counts)}` };
}
