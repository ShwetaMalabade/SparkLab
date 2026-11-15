// src/lib/acidBase.ts — titration chemistry, computed by code (Titration Lab). Pure: safe on the server and in the browser.
// The AI only names the acid, base, volumes, concentrations and indicator. Ka/Kb, pH, the end point and every color come from here.
import { normalizeChem } from "./chem";

export type Indicator = "phenolphthalein" | "methyl_orange" | "bromothymol_blue";
type Kind = "strong_acid" | "weak_acid" | "strong_base" | "weak_base";
export type AcidBase = { formula: string; name: string; kind: Kind; n: number; K: number | null }; // n = H+ or OH- per formula unit; K = Ka or Kb

// Classroom values (25 °C). H2SO4 is treated as fully diprotic, as in school titrations. Ba(OH)2 releases 2 OH-.
const TABLE: AcidBase[] = [
  { formula: "HCl", name: "hydrochloric acid", kind: "strong_acid", n: 1, K: null },
  { formula: "HNO3", name: "nitric acid", kind: "strong_acid", n: 1, K: null },
  { formula: "HBr", name: "hydrobromic acid", kind: "strong_acid", n: 1, K: null },
  { formula: "H2SO4", name: "sulfuric acid", kind: "strong_acid", n: 2, K: null },
  { formula: "CH3COOH", name: "acetic acid", kind: "weak_acid", n: 1, K: 1.8e-5 },
  { formula: "HCOOH", name: "formic acid", kind: "weak_acid", n: 1, K: 1.8e-4 },
  { formula: "HF", name: "hydrofluoric acid", kind: "weak_acid", n: 1, K: 6.8e-4 },
  { formula: "NaOH", name: "sodium hydroxide", kind: "strong_base", n: 1, K: null },
  { formula: "KOH", name: "potassium hydroxide", kind: "strong_base", n: 1, K: null },
  { formula: "LiOH", name: "lithium hydroxide", kind: "strong_base", n: 1, K: null },
  { formula: "Ba(OH)2", name: "barium hydroxide", kind: "strong_base", n: 2, K: null },
  { formula: "NH3", name: "ammonia", kind: "weak_base", n: 1, K: 1.8e-5 },
];
const ALIASES: Record<string, string> = { HC2H3O2: "CH3COOH", CH3CO2H: "CH3COOH", HCO2H: "HCOOH", NH4OH: "NH3" };

export function lookupAcidBase(formula: string): AcidBase | null {
  const f = normalizeChem(formula).replace(/\s+/g, "");
  const key = ALIASES[f] ?? f;
  return TABLE.find((x) => x.formula === key) ?? null;
}
const isAcid = (x: AcidBase) => x.kind === "strong_acid" || x.kind === "weak_acid";

export type Scenario = {
  analyte: { formula: string; molarity: number; volumeML: number }; // in the flask
  titrant: { formula: string; molarity: number }; // in the burette
};
export type Checked = { ok: true; analyte: AcidBase; titrant: AcidBase } | { ok: false; error: string };

/** Code's check that this titration is one we can compute honestly. */
export function checkScenario(s: Scenario): Checked {
  const a = lookupAcidBase(s.analyte.formula), t = lookupAcidBase(s.titrant.formula);
  if (!a) return { ok: false, error: `unknown acid/base "${s.analyte.formula}" (use one from the table: ${TABLE.map((x) => x.formula).join(", ")})` };
  if (!t) return { ok: false, error: `unknown acid/base "${s.titrant.formula}" (use one from the table: ${TABLE.map((x) => x.formula).join(", ")})` };
  if (isAcid(a) === isAcid(t)) return { ok: false, error: `a titration needs one acid and one base (${a.formula}, ${t.formula})` };
  if (a.K !== null && t.K !== null) return { ok: false, error: `weak + weak titrations have no sharp end point; titrate with a strong ${isAcid(a) ? "base" : "acid"}` };
  for (const [what, m] of [["analyte molarity", s.analyte.molarity], ["titrant molarity", s.titrant.molarity]] as const)
    if (!(m > 0 && m <= 18)) return { ok: false, error: `${what} ${m} M is not a sensible concentration` };
  if (!(s.analyte.volumeML > 0 && s.analyte.volumeML <= 250)) return { ok: false, error: `analyte volume ${s.analyte.volumeML} mL is out of range` };
  return { ok: true, analyte: a, titrant: t };
}

/** Volume of titrant (mL) that exactly neutralizes the analyte: n_a·M_a·V_a = n_t·M_t·V_t. */
export function equivalenceML(s: Scenario): number {
  const c = checkScenario(s);
  if (!c.ok) throw new Error(c.error);
  return (c.analyte.n * s.analyte.molarity * s.analyte.volumeML) / (c.titrant.n * s.titrant.molarity);
}

/** Analyte molarity from a measured end-point volume (the "find the concentration" question). */
export function analyteMolarityFrom(s: Omit<Scenario, "analyte"> & { analyte: { formula: string; volumeML: number } }, endpointML: number): number {
  const a = lookupAcidBase(s.analyte.formula), t = lookupAcidBase(s.titrant.formula);
  if (!a || !t) throw new Error("unknown acid/base");
  return (t.n * s.titrant.molarity * endpointML) / (a.n * s.analyte.volumeML);
}

const KW = 1e-14;
/** pH of the flask after adding `addedML` of titrant: solves the full charge balance for [H+] (exact, no regime switching). */
export function phAt(s: Scenario, addedML: number): number {
  const c = checkScenario(s);
  if (!c.ok) throw new Error(c.error);
  const V = (s.analyte.volumeML + Math.max(0, addedML)) / 1000; // L
  const parts = [
    { x: c.analyte, conc: (s.analyte.molarity * s.analyte.volumeML) / 1000 / V },
    { x: c.titrant, conc: (s.titrant.molarity * Math.max(0, addedML)) / 1000 / V },
  ];
  // f(h) = positive charge − negative charge, increasing in h.
  const f = (h: number) => {
    let pos = h, neg = KW / h;
    for (const { x, conc } of parts) {
      if (x.kind === "strong_acid") neg += x.n * conc; // fully dissociated anion
      else if (x.kind === "strong_base") pos += x.n * conc; // fully dissociated cation
      else if (x.kind === "weak_acid") neg += (conc * x.K!) / (x.K! + h); // [A-]
      else pos += (conc * h) / (h + KW / x.K!); // weak base: [BH+]
    }
    return pos - neg;
  };
  let lo = -15, hi = 1.5; // log10 [H+]
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (f(10 ** mid) > 0) hi = mid;
    else lo = mid;
  }
  return -(lo + hi) / 2;
}

export type CurvePoint = { ml: number; pH: number };
/** The titration curve, from 0 to 2× the end point, with extra points near the end point so the jump is sharp. */
export function curve(s: Scenario, points = 120): CurvePoint[] {
  const eq = equivalenceML(s), max = 2 * eq;
  const xs = new Set<number>();
  for (let i = 0; i <= points; i++) xs.add(+((max * i) / points).toFixed(3));
  for (let d = -0.05; d <= 0.0501; d += 0.005) xs.add(+(eq * (1 + d)).toFixed(3)); // ±5 % around the end point
  return [...xs].filter((x) => x >= 0).sort((a, b) => a - b).map((ml) => ({ ml, pH: +phAt(s, ml).toFixed(2) }));
}

// Indicator colors: [acid color, base color] across the transition range.
export const INDICATORS: Record<Indicator, { name: string; low: number; high: number; acid: string; base: string; acidLabel: string; baseLabel: string }> = {
  phenolphthalein: { name: "phenolphthalein", low: 8.2, high: 10.0, acid: "#F8FAFC", base: "#E75480", acidLabel: "colorless", baseLabel: "pink" }, // chemistry-plan/03 §3
  methyl_orange: { name: "methyl orange", low: 3.1, high: 4.4, acid: "#E53935", base: "#FBC02D", acidLabel: "red", baseLabel: "yellow" },
  bromothymol_blue: { name: "bromothymol blue", low: 6.0, high: 7.6, acid: "#FDD835", base: "#1E63D6", acidLabel: "yellow", baseLabel: "blue" },
};

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const mix = (a: string, b: string, t: number) => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => hex(p(a, i) + (p(b, i) - p(a, i)) * t)).join("")}`.toUpperCase();
};

/** The flask's color at this pH, plus how strongly colored it is (phenolphthalein's acid form is clear). */
export function indicatorColor(ind: Indicator, pH: number): { hex: string; strength: number; label: string } {
  const I = INDICATORS[ind];
  const t = Math.max(0, Math.min(1, (pH - I.low) / (I.high - I.low)));
  const label = t <= 0.05 ? I.acidLabel : t >= 0.95 ? I.baseLabel : ind === "phenolphthalein" ? "faint pink" : ind === "bromothymol_blue" ? "green" : "orange";
  // Phenolphthalein: clear → pink; above its range it deepens to magenta (an overshoot the student can see).
  if (ind === "phenolphthalein") {
    const deep = Math.max(0, Math.min(1, (pH - I.high) / 2.5));
    return { hex: deep > 0 ? mix(I.base, "#C2185B", deep) : mix(I.acid, I.base, t), strength: Math.min(1, t * 0.85 + deep * 0.15), label: deep > 0.3 ? "deep magenta" : label };
  }
  return { hex: mix(I.acid, I.base, t), strength: 0.75, label };
}

/** Does this indicator change color inside the steep jump (1 % before to 1 % after the end point)? */
export function indicatorFits(s: Scenario, ind: Indicator): boolean {
  const eq = equivalenceML(s);
  const a = phAt(s, eq * 0.99), b = phAt(s, eq * 1.01);
  const I = INDICATORS[ind];
  return Math.min(a, b) <= I.high && Math.max(a, b) >= I.low;
}
