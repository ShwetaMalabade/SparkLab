// src/lib/chem.ts — verification only. No reaction content lives here.
type Counts = Record<string, number>;
const add = (a: Counts, b: Counts, m = 1) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] ?? 0) + v * m; return a; };

const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** Run on EVERY formula and equation before any other chem function (they also call it themselves). */
export const normalizeChem = (s: string) => s
  .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))     // H₂O -> H2O
  .replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")                        // drop superscript charges
  .replace(/[•∙*]/g, "·")                                  // hydrate dots
  .replace(/\((s|l|g|aq)\)/g, "")                          // drop states
  .replace(/\s*(<=>|<->|⇌|⇄|=>|-->|⟶|→|->|=)\s*/g, " -> ") // every arrow -> " -> "
  .replace(/\s+/g, " ").trim();

export function parseFormula(raw: string): Counts {
  const f = normalizeChem(raw).replace(/\s/g, "");
  return f.split(/[·.]/).filter(Boolean).reduce((acc, part) => {
    const m = part.match(/^(\d+)(.*)$/);
    return add(acc, parseGroup(m ? m[2] : part), m ? parseInt(m[1]) : 1);
  }, {} as Counts);
}

function parseGroup(f: string): Counts {
  const stack: Counts[] = [{}]; let i = 0;
  const readNum = () => { let n = ""; while (i < f.length && /\d/.test(f[i])) n += f[i++]; return n ? parseInt(n) : 1; };
  while (i < f.length) {
    const ch = f[i];
    if (ch === "(" || ch === "[") { stack.push({}); i++; }
    else if (ch === ")" || ch === "]") { i++; const mult = readNum(); const top = stack.pop() ?? {}; add(stack[stack.length - 1] ?? (stack[0] = {}), top, mult); }
    else if (/[A-Z]/.test(ch)) { let el = ch; i++; while (i < f.length && /[a-z]/.test(f[i])) el += f[i++]; add(stack[stack.length - 1], { [el]: readNum() }); }
    else i++;
  }
  return stack[0];
}

export type Term = { coef: number; formula: string };
export function splitEquation(eq: string): { left: Term[]; right: Term[] } | null {
  const parts = normalizeChem(eq).split(" -> ");
  if (parts.length !== 2) return null;                     // never crash on odd arrows
  const terms = (s: string) => s.split(" + ").map((t) => t.trim()).filter(Boolean).map((t) => {
    const m = t.match(/^(\d+)\s*(.*)$/);
    return { coef: m ? parseInt(m[1]) : 1, formula: m ? m[2] : t };
  });
  return { left: terms(parts[0]), right: terms(parts[1]) };
}

const sideCounts = (ts: Term[]) => ts.reduce((acc, t) => add(acc, parseFormula(t.formula), t.coef), {} as Counts);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function isBalanced(eq: string) {
  const s = splitEquation(eq);
  if (!s || !s.left.length || !s.right.length) return { balanced: false, minimal: false, diff: {}, error: `can't read equation "${eq}"` };
  const L = sideCounts(s.left), R = sideCounts(s.right);
  const diff: Record<string, [number, number]> = {};
  for (const e of new Set([...Object.keys(L), ...Object.keys(R)]))
    if ((L[e] ?? 0) !== (R[e] ?? 0)) diff[e] = [L[e] ?? 0, R[e] ?? 0];
  const g = [...s.left, ...s.right].map((t) => t.coef).reduce(gcd);
  return { balanced: Object.keys(diff).length === 0, minimal: g === 1, diff, error: null as string | null };
}

export function withCoefficients(left: string[], right: string[], lc: number[], rc: number[]) {
  const side = (fs: string[], cs: number[]) => fs.map((f, i) => (cs[i] === 1 ? f : `${cs[i]}${f}`)).join(" + ");
  return `${side(left, lc)} -> ${side(right, rc)}`;
}

/** Same species, same order? (Balancer subscript trap: H2O -> H2O2 is balanced but a different chemical.) */
export function sameSpecies(a: string, b: string) {
  const A = splitEquation(a), B = splitEquation(b);
  if (!A || !B) return false;
  const key = (ts: Term[]) => ts.map((t) => t.formula).join("|");
  return key(A.left) === key(B.left) && key(A.right) === key(B.right);
}

// ---- Solubility rules: used ONLY to check the AI's "a precipitate forms" claims ----
const ALKALI = /^(Li|Na|K|Rb|Cs)/;
export function solubility(raw: string): "soluble" | "insoluble" | "unknown" {
  const f = normalizeChem(raw);
  const cat = f.startsWith("NH4") ? "NH4" : (f.match(/^[A-Z][a-z]?/)?.[0] ?? "");
  if (ALKALI.test(f) || cat === "NH4" || /NO3|CH3COO|ClO3|ClO4/.test(f)) return "soluble";
  if (/(Cl|Br|I)\d*$/.test(f) && !/O/.test(f)) return ["Ag", "Pb", "Hg"].includes(cat) ? "insoluble" : "soluble";
  if (/SO4/.test(f)) return ["Ba", "Pb", "Sr", "Ca", "Ag"].includes(cat) ? "insoluble" : "soluble";
  if (/\(OH\)\d*$|OH$/.test(f)) return ["Ba", "Sr"].includes(cat) ? "soluble" : "insoluble";
  if (/CO3|PO4|SO3|CrO4/.test(f) || /^[A-Z][a-z]?\d*S$/.test(f)) return "insoluble";
  return "unknown";
}
