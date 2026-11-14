// src/game/balancer.ts: Equation Balancer rules (docs/plan/05 §4, P1-TASKS P1-16). Pure functions, no React,
// so tests can run them. Every count and every verdict comes from @/lib/chem (code checks every number).
import { isBalanced, parseFormula, sameSpecies, splitEquation, withCoefficients } from "@/lib/chem";
import type { TQuestion, TWorksheet } from "@/lib/schema";

export type Species = { left: string[]; right: string[] };
export type Coefs = { left: number[]; right: number[] };

export const MIN_COEF = 1;
export const MAX_COEF = 9;

/** Species (formulas, in order) from question.equation; the student starts with every coefficient at 1. */
export function speciesOf(q: TQuestion): Species | null {
  const s = q.equation ? splitEquation(q.equation) : null;
  if (!s || !s.left.length || !s.right.length) return null;
  return { left: s.left.map((t) => t.formula), right: s.right.map((t) => t.formula) };
}

/** The answer key's coefficients (for the reveal animation). */
export function answerCoefs(q: TQuestion): Coefs | null {
  const s = q.equation ? splitEquation(q.equation) : null;
  if (!s) return null;
  return { left: s.left.map((t) => t.coef), right: s.right.map((t) => t.coef) };
}

export const ones = (sp: Species): Coefs => ({ left: sp.left.map(() => 1), right: sp.right.map(() => 1) });
export const flat = (c: Coefs) => [...c.left, ...c.right];
export const coefText = (c: Coefs) => flat(c).join(", ");

/**
 * The subscript trap: raise the last element's subscript of the first product (H2O → H2O2).
 * Balanced-looking, but a different chemical.
 */
export function trapFormula(f: string): string {
  const m = /^(.*?)(\d*)$/.exec(f)!;
  const n = m[2] ? parseInt(m[2]) : 1;
  return `${m[1]}${n + 1}`;
}
export function trapped(sp: Species): Species {
  return { left: sp.left, right: sp.right.map((f, i) => (i === 0 ? trapFormula(f) : f)) };
}

export const build = (sp: Species, c: Coefs) => withCoefficients(sp.left, sp.right, c.left, c.right);

/** Atom count per element on each side (for the counters and the scale tilt). */
export function atomCounts(sp: Species, c: Coefs) {
  const side = (fs: string[], cs: number[]) => {
    const out: Record<string, number> = {};
    fs.forEach((f, i) => {
      for (const [el, n] of Object.entries(parseFormula(f))) out[el] = (out[el] ?? 0) + n * cs[i];
    });
    return out;
  };
  const L = side(sp.left, c.left);
  const R = side(sp.right, c.right);
  // Element order: first appearance, left side first (H, O for water).
  const order: string[] = [];
  for (const f of [...sp.left, ...sp.right]) for (const el of Object.keys(parseFormula(f))) if (!order.includes(el)) order.push(el);
  const rows = order.map((el) => ({ el, left: L[el] ?? 0, right: R[el] ?? 0 }));
  const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  return { rows, leftTotal: total(L), rightTotal: total(R) };
}

/** Element symbol → the word used in misconception ids ("unbalanced_oxygen"). */
const ELEMENT_WORD: Record<string, string> = {
  H: "hydrogen", O: "oxygen", C: "carbon", N: "nitrogen", Cl: "chlorine", Na: "sodium", S: "sulfur", Fe: "iron",
  Cu: "copper", Ag: "silver", Ca: "calcium", Mg: "magnesium", K: "potassium", Pb: "lead", I: "iodine", Ba: "barium",
  Al: "aluminum", P: "phosphorus", Zn: "zinc", F: "fluorine", Br: "bromine", Li: "lithium",
};

export type Verdict =
  | { kind: "simplify" }
  | { kind: "lock"; chosen: "A" | "B" | "C" | "D" | "X"; chosenText: string; correct: boolean; misconceptionId: string | null };

const inRegistry = (ws: TWorksheet | null, id: string) => !ws || ws.misconceptions.some((m) => m.id === id);

/**
 * Judge a Check (05 §4 recording order).
 * `secondSimplify`: the student already saw "Now simplify" once; a second non-minimal answer locks in as wrong.
 */
export function judge(q: TQuestion, ws: TWorksheet | null, sp: Species, c: Coefs, opts: { trap: boolean; secondSimplify?: boolean }): Verdict {
  const original = speciesOf(q);
  const built = build(sp, c);

  // 0. Subscript trap first (H2 + O2 -> H2O2 is atom-balanced but a different chemical).
  if (opts.trap || !original || !sameSpecies(built, build(original, c))) {
    const choice = q.choices.find((ch) => ch.misconceptionId === "changed_subscripts");
    if (choice) return { kind: "lock", chosen: choice.id, chosenText: choice.text, correct: false, misconceptionId: choice.misconceptionId };
    return { kind: "lock", chosen: "X", chosenText: built, correct: false, misconceptionId: inRegistry(ws, "changed_subscripts") ? "changed_subscripts" : null };
  }

  // 1. Code checks the atoms.
  const b = isBalanced(built);
  const text = coefText(c);

  // 2. Balanced and simplest → the correct choice.
  if (b.balanced && b.minimal) {
    const choice = q.choices.find((ch) => ch.correct);
    return { kind: "lock", chosen: choice?.id ?? "X", chosenText: choice?.text ?? text, correct: true, misconceptionId: null };
  }
  // 3. Balanced but not simplest (4, 2, 4) → one more try.
  if (b.balanced && !opts.secondSimplify) return { kind: "simplify" };
  if (b.balanced) return { kind: "lock", chosen: "X", chosenText: text, correct: false, misconceptionId: null };

  // 4. Unbalanced → the wrong choice with the same coefficient list.
  const match = q.choices.find((ch) => !ch.correct && ch.text.replace(/\s/g, "") === text.replace(/\s/g, ""));
  if (match) return { kind: "lock", chosen: match.id, chosenText: match.text, correct: false, misconceptionId: match.misconceptionId };

  // 5. No matching choice → "X", named from the first mismatched element (O → unbalanced_oxygen) if the registry has it.
  const first = Object.keys(b.diff)[0];
  const id = first && ELEMENT_WORD[first] ? `unbalanced_${ELEMENT_WORD[first]}` : null;
  return { kind: "lock", chosen: "X", chosenText: text, correct: false, misconceptionId: id && inRegistry(ws, id) ? id : null };
}
