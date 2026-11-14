import { isBalanced, parseFormula, normalizeChem, sameSpecies, solubility, splitEquation } from "../src/lib/chem";
import { lintFormula, buildNumericChoices, fmt } from "../src/lib/verifyPhysics";
import { ReadOut, DesignOut, Question } from "../src/lib/schema";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { cond ? pass++ : fail++; console.log(cond ? "PASS" : "FAIL", name, extra === undefined ? "" : JSON.stringify(extra)); };

// chemistry
const eqs = ["NaHCO3 + CH3COOH -> CH3COONa + H2O + CO2","HCl + NaOH -> NaCl + H2O","AgNO3 + NaCl -> AgCl + NaNO3","Pb(NO3)2 + 2KI -> PbI2 + 2KNO3","CuSO4 + 2NaOH -> Cu(OH)2 + Na2SO4","FeCl3 + 3NaOH -> Fe(OH)3 + 3NaCl","BaCl2 + Na2SO4 -> BaSO4 + 2NaCl","Zn + 2HCl -> ZnCl2 + H2","Mg + 2HCl -> MgCl2 + H2","Fe + CuSO4 -> FeSO4 + Cu","CaCO3 + 2HCl -> CaCl2 + H2O + CO2","2H2O2 -> 2H2O + O2","CH4 + 2O2 -> CO2 + 2H2O","Ba(OH)2·8H2O + 2NH4Cl -> BaCl2 + 2NH3 + 10H2O"];
ok("14 classic reactions balance", eqs.every((e) => isBalanced(e).balanced));
ok("Fe2(SO4)3", JSON.stringify(parseFormula("Fe2(SO4)3")) === '{"Fe":2,"S":3,"O":12}');
ok("hydrate", JSON.stringify(parseFormula("Ba(OH)2·8H2O")) === '{"Ba":1,"O":10,"H":18}');
ok("CuSO4.5H2O", JSON.stringify(parseFormula("CuSO4.5H2O")) === '{"Cu":1,"S":1,"O":9,"H":10}');
ok("unicode H₂O", JSON.stringify(parseFormula("H₂O")) === '{"H":2,"O":1}');
for (const a of ["→", "=>", "⇌", "<=>", "<->", "=", "-->", "⟶"]) ok(`arrow ${a}`, isBalanced(`2H₂ + O₂ ${a} 2H₂O`).balanced);
ok("states stripped", isBalanced("2H2(g) + O2(g) -> 2H2O(l)").balanced);
ok("no crash on garbage", isBalanced("H2 + O2").error !== null);
ok("O unbalanced", JSON.stringify(isBalanced("H2 + O2 -> H2O").diff) === '{"O":[2,1]}');
ok("H unbalanced", JSON.stringify(isBalanced("H2 + O2 -> 2H2O").diff) === '{"H":[2,4]}');
ok("non-minimal flagged", isBalanced("4H2 + 2O2 -> 4H2O").balanced && !isBalanced("4H2 + 2O2 -> 4H2O").minimal);
ok("subscript trap: balanced but different species", isBalanced("H2 + O2 -> H2O2").balanced && !sameSpecies("H2 + O2 -> H2O2", "2H2 + O2 -> 2H2O"));
ok("same species ignores coefficients", sameSpecies("H2 + O2 -> H2O", "2H2 + O2 -> 2H2O"));
const sol: Record<string, string> = { AgCl: "insoluble", PbI2: "insoluble", "Cu(OH)2": "insoluble", "Fe(OH)3": "insoluble", BaSO4: "insoluble", CaCO3: "insoluble", "Mg(OH)2": "insoluble",
  NaNO3: "soluble", KNO3: "soluble", NaCl: "soluble", Na2SO4: "soluble", ZnCl2: "soluble", MgCl2: "soluble", FeSO4: "soluble", CaCl2: "soluble", "Pb(NO3)2": "soluble", KI: "soluble", "Ba(OH)2": "soluble", CH3COONa: "soluble" };
for (const [f, want] of Object.entries(sol)) ok(`solubility ${f}`, solubility(f) === want, solubility(f));

// physics lint (old regex flagged the 2nd and 3rd correct forms)
const G = { v: { value: 20, unit: "m/s" }, theta: { value: 30, unit: "deg" }, g: { value: 9.81, unit: "m/s^2" } };
for (const f of ["v^2*sin(2*theta*pi/180)/g", "v^2*sin(pi/180*2*theta)/g", "v^2*sin((2*theta)*pi/180)/g", "v**2*sin(2*θ*pi/180)/g"]) ok(`lint accepts ${f}`, lintFormula(f, G).error === null, lintFormula(f, G).error);
for (const f of ["v^2*sin(2*theta)/g", "v^2*sin(2*angle*pi/180)/g", "v^2*sin(2*theta*pi/180"]) ok(`lint rejects ${f}`, lintFormula(f, G).error !== null, lintFormula(f, G).error);

// q1: AI writes formulas, code writes numbers; printed key 34.0 is wrong
const r = buildNumericChoices({ id: "q1", given: G, unit: "m", formula: "v^2*sin(2*theta*pi/180)/g", printedKey: 34.0, wrong: [
  { misconceptionId: "sin_theta_not_sin_2theta", wrongFormula: "v^2*sin(theta*pi/180)/g" },
  { misconceptionId: "lost_factor_2", wrongFormula: "v^2*sin(theta*pi/180)*cos(theta*pi/180)/g" },
  { misconceptionId: "doubled_range", wrongFormula: "2*v^2*sin(2*theta*pi/180)/g" },
  { misconceptionId: "degrees_as_radians", wrongFormula: "v^2*sin(2*theta)/g" }] });
ok("q1 correct 35.3 m", r.correct?.text === "35.3 m", r.correct);
ok("q1 wrong texts", JSON.stringify(r.wrong?.map((w) => w.text)) === '["20.4 m","17.7 m","70.6 m"]', r.wrong?.map((w) => w.text));
ok("q1 key mismatch flagged", r.flags.some((f) => f.startsWith("answer_key_mismatch:34")), r.flags);
ok("q1 degree-bug wrong formula rejected, not used", r.errors.length === 1 && /degrees/.test(r.errors[0]), r.errors);
const r2 = buildNumericChoices({ id: "q5", given: { h: { value: 20, unit: "m" }, g: { value: 9.81, unit: "m/s^2" } }, unit: "s", formula: "sqrt(2*h/g)", printedKey: null, wrong: [
  { misconceptionId: "forgot_sqrt", wrongFormula: "2*h/g" }, { misconceptionId: "forgot_half", wrongFormula: "sqrt(h/g)" }, { misconceptionId: "t_equals_h_over_g", wrongFormula: "h/g" }, { misconceptionId: "multiplied_by_g", wrongFormula: "sqrt(2*h*g)" }] });
ok("q5: h/g (2.04 s) rejected as too close to 2.02 s", r2.errors.some((e) => /t_equals_h_over_g.*within 5%/.test(e)), r2.errors);
ok("q5 choices", JSON.stringify([r2.correct?.text, ...(r2.wrong ?? []).map((w) => w.text)]) === '["2.02 s","4.08 s","1.43 s","19.8 s"]');
ok("fmt big", fmt(1234.5, "J") === "1235 J" && fmt(0.30969, "m/s²") === "0.310 m/s²");

// schema: a raw agent draft is checked with the draft schema, not the final one
const draft = { title: "t", questions: [{ id: "q1", subject: "physics", topic: "projectile_motion", concept: "range uses sin 2θ", prompt: "p", given: G, unknown: "R", unit: "m", formula: "v^2*sin(2*theta*pi/180)/g", printedAnswer: "34.0 m", printedChoices: null, answerText: "35.3 m", reaction: null, equation: null, confidence: 0.9 }] };
ok("ReadOut accepts a Reader draft", ReadOut.safeParse(draft).success);
ok("final Question rejects a Reader draft (so never validate drafts with it)", !Question.safeParse(draft.questions[0]).success);
console.log(`\n${pass} passed, ${fail} failed`);

// --- Regression checks added Sat 1:45 AM (Claude review of v3) ---
{
  const G2: any = { v: { value: 20, unit: "m/s" }, theta: { value: 30, unit: "deg" }, g: { value: 9.81, unit: "m/s^2" } };
  const r1 = lintFormula("v^2*sin(2*theta)/g + 0*pi", G2).error !== null;
  const r2 = lintFormula("v^2*sin(2*theta)*cos(theta*pi/180)/g", G2).error !== null;
  const r3 = lintFormula("v^2*sin(2*theta*pi/180)/g", G2).error === null;
  const r4 = lintFormula("v*cos(theta*pi/180)*sqrt(2)", G2).error === null;
  const f1 = fmt(999.7, "m") === "1000 m", f2 = fmt(1e-7, "s") === "1.00×10^-7 s", f3 = fmt(99.96, "m") === "100 m", f4 = fmt(35.312, "m") === "35.3 m";
  for (const [n, c] of [["lint: pi elsewhere doesn't hide sin(2*theta)", r1], ["lint: mixed trig args caught", r2], ["lint: correct formula still accepted", r3], ["lint: cos with pi + sqrt accepted", r4],
                        ["fmt 999.7 -> 1000 m (no e+3)", f1], ["fmt 1e-7 -> ×10^-7", f2], ["fmt 99.96 -> 100 m", f3], ["fmt 35.312 -> 35.3 m", f4]] as [string, boolean][]) {
    console.log(c ? "PASS" : "FAIL", n); if (!c) process.exitCode = 1;
  }
}
