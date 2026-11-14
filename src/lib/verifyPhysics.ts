// src/lib/verifyPhysics.ts — the AI writes formulas; this code computes every number.
import { parse, evaluate } from "mathjs";

type Given = Record<string, { value: number; unit: string }>;
const ALLOWED = new Set(["pi", "e", "sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "abs", "log", "exp", "min", "max"]);

/** Clean the formula, then check it. Returns the cleaned formula or an error the repair loop can send back. */
export function lintFormula(raw: string, given: Given): { formula: string; error: string | null } {
  const formula = raw.replace(/\*\*/g, "^").replace(/θ/g, "theta").replace(/μ/g, "mu")
    .replace(/×|·/g, "*").replace(/÷/g, "/").replace(/√\(/g, "sqrt(");
  let node;
  try { node = parse(formula); } catch (e) { return { formula, error: `formula "${formula}" doesn't parse: ${(e as Error).message}` }; }
  const unknown = new Set<string>();
  node.traverse((n: any) => { if (n.isSymbolNode && !ALLOWED.has(n.name) && !(n.name in given)) unknown.add(n.name); });
  if (unknown.size) return { formula, error: `formula uses ${[...unknown].join(", ")}, which are not in "given"` };
  // Check EACH sin/cos/tan call: if its argument uses a degree value, that same argument must contain pi.
  // (A "pi" elsewhere in the formula must not hide sin(2*theta).)
  const degKeys = new Set(Object.entries(given).filter(([, v]) => /deg|°/i.test(v.unit)).map(([k]) => k));
  let degBug = false;
  node.traverse((n: any) => {
    if (!n.isFunctionNode || !["sin", "cos", "tan"].includes(n.fn?.name)) return;
    const syms = new Set<string>();
    n.args.forEach((a: any) => a.traverse((m: any) => { if (m.isSymbolNode) syms.add(m.name); }));
    if ([...syms].some((s) => degKeys.has(s)) && !syms.has("pi")) degBug = true;
  });
  if (degBug) return { formula, error: `angle is in degrees; convert with *pi/180 inside sin/cos/tan` };
  return { formula, error: null };
}

export function compute(formula: string, given: Given): number {
  const scope: Record<string, number> = {};
  for (const [k, v] of Object.entries(given)) scope[k] = v.value;
  return Number(evaluate(formula, scope));
}

/** 3 significant figures; ≥ 1000 shown as a whole number (999.7 → "1000", never "1.00e+3"). Tiny values use ×10^n, never "e-7". */
export function fmt(x: number, unit: string | null) {
  const p = Number(x.toPrecision(3));
  let s: string;
  if (Math.abs(x) >= 999.5) s = String(Math.round(x));                       // 999.7 -> "1000", 1234.5 -> "1235"
  else if (p !== 0 && Math.abs(p) < 0.001) { const [m, e] = p.toExponential(2).split("e"); s = `${m}×10^${Number(e)}`; }
  else s = p.toPrecision(3);
  return unit ? `${s} ${unit}` : s;
}

export const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));

/**
 * Verify one numeric question. The AI supplied: the correct formula, and one WRONG formula per distractor
 * (each one models a named mistake). Code computes every value and writes every choice text.
 */
export function buildNumericChoices(q: {
  id: string; given: Given; unit: string | null; formula: string; printedKey: number | null;
  wrong: { misconceptionId: string; wrongFormula: string }[];
}) {
  const errors: string[] = []; const flags: string[] = [];
  const main = lintFormula(q.formula, q.given);
  if (main.error) return { errors: [`${q.id}: ${main.error}`], flags };
  let correct: number;
  try { correct = compute(main.formula, q.given); } catch (e) { return { errors: [`${q.id}: formula failed: ${(e as Error).message}`], flags }; }
  if (!Number.isFinite(correct) || correct <= 0) return { errors: [`${q.id}: formula gives ${correct}; expected a positive magnitude`], flags };
  if (q.printedKey != null && relDiff(q.printedKey, correct) > 0.02) flags.push(`answer_key_mismatch:${q.printedKey}->${fmt(correct, null)}`);

  const values = [correct];
  const wrongOut: { misconceptionId: string; value: number; text: string }[] = [];
  for (const w of q.wrong) {
    const l = lintFormula(w.wrongFormula, q.given);
    if (l.error) { errors.push(`${q.id}/${w.misconceptionId}: ${l.error}`); continue; }
    let v: number;
    try { v = compute(l.formula, q.given); } catch { errors.push(`${q.id}/${w.misconceptionId}: wrong formula failed`); continue; }
    if (!Number.isFinite(v) || v <= 0) { errors.push(`${q.id}/${w.misconceptionId}: wrong value ${v} is not a positive number`); continue; }
    if (values.some((x) => relDiff(v, x) < 0.05)) { errors.push(`${q.id}/${w.misconceptionId}: wrong value ${fmt(v, null)} is within 5% of another choice; model a different mistake`); continue; }
    values.push(v); wrongOut.push({ misconceptionId: w.misconceptionId, value: v, text: fmt(v, q.unit) });
  }
  if (wrongOut.length < 3) errors.push(`${q.id}: need 3 valid wrong formulas, have ${wrongOut.length}`);
  return { errors, flags, formula: main.formula, correct: { value: correct, text: fmt(correct, q.unit) }, wrong: wrongOut.slice(0, 3) };
}
