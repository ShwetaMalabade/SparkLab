// scripts/make-fixture.ts — Builds data/fixtures/worksheet.json for P1 to develop against (chemistry-only since the pivot:
// q1 Titration Lab, q2 Mystery Sample, q3 Mix Lab, q4 Equation Balancer, q5 stoichiometry balloons).
// The drafts below are shaped like real Agent 1 + Agent 2 output; the REAL assemble() + code checks build every
// question, so the fixture matches the live schema exactly. Dev-only: never shown in the demo.
// Run: npx tsx scripts/make-fixture.ts
import fs from "node:fs";
import { assemble } from "../src/lib/assemble";
import { Worksheet } from "../src/lib/schema";

const base = { subject: "chemistry", printedChoices: null, reaction: null, equation: null, confidence: 0.9, printedAnswer: null, answerText: "" } as any;
const misC = [{ id: "gas_vs_precipitate", label: "Confused gas with solid", why: "Bubbles mean gas.", concept: "precipitation" },
  { id: "no_reaction_assumed", label: "Assumed nothing happens", why: "An insoluble product forms.", concept: "precipitation" },
  { id: "wrong_precipitate_color", label: "Wrong precipitate color", why: "PbI₂ is yellow.", concept: "precipitation" }];
const misB = [{ id: "unbalanced_oxygen", label: "O atoms don't match", why: "Count O both sides.", concept: "balancing" },
  { id: "unbalanced_hydrogen", label: "H atoms don't match", why: "Count H both sides.", concept: "balancing" },
  { id: "changed_subscripts", label: "Changed subscripts", why: "That's a different chemical.", concept: "balancing" }];
const rx = { reactants: [{ formula: "Pb(NO3)2", name: "lead(II) nitrate", state: "aq" }, { formula: "KI", name: "potassium iodide", state: "aq" }],
  products: [{ formula: "PbI2", name: "lead(II) iodide", state: "s" }, { formula: "KNO3", name: "potassium nitrate", state: "aq" }],
  equation: "Pb(NO3)2 + 2KI -> PbI2 + 2KNO3", type: "precipitation", observation: "A bright yellow solid forms",
  visual: { bubbles: false, colorFrom: "#F5F5F5", colorTo: "#F5F5F5", precipitateColor: "#FFD21F", heat: "none", flame: null }, hazard: "Lead compounds are toxic" };

const misT = [{ id: "inverted_molarity_ratio", label: "Flipped the molarity ratio", why: "V(NaOH) = M(acid)·V(acid) ÷ M(NaOH).", concept: "titration end point" },
  { id: "assumed_equal_volumes", label: "Assumed equal volumes", why: "Equal volumes only work when the molarities match.", concept: "titration end point" },
  { id: "treated_as_diprotic", label: "Treated a 1:1 acid as 2:1", why: "Acetic acid gives one H⁺ per molecule.", concept: "titration end point" },
  { id: "halved_mole_ratio", label: "Halved the mole ratio", why: "1 mol NaOH neutralizes 1 mol acetic acid.", concept: "titration end point" }];
const misS = [{ id: "stopped_at_moles", label: "Stopped at moles", why: "Multiply moles of H₂ by its molar mass to get grams.", concept: "mass-to-mass stoichiometry" },
  { id: "used_hcl_coefficient", label: "Used HCl's coefficient", why: "Mg and H₂ are 1:1; the 2 belongs to HCl.", concept: "mass-to-mass stoichiometry" },
  { id: "inverted_molar_masses", label: "Flipped the molar masses", why: "Divide by Mg's molar mass, multiply by H₂'s.", concept: "mass-to-mass stoichiometry" }];

const built = [
  assemble({ ...base, id: "q1", subject: "chemistry", topic: "acid_base_ph", concept: "titration end point",
      prompt: "20.0 mL of 0.150 M acetic acid (CH₃COOH) is titrated with 0.100 M NaOH using phenolphthalein. What volume of NaOH reaches the end point?",
      unknown: "Vt", given: { Ma: { value: 0.15, unit: "M" }, Va: { value: 20, unit: "mL" }, Mt: { value: 0.1, unit: "M" } }, unit: "mL", formula: "Ma*Va/Mt",
      titration: { analyte: { formula: "CH3COOH", name: "acetic acid", volumeML: 20, molarity: 0.15 }, titrant: { formula: "NaOH", name: "sodium hydroxide", molarity: 0.1 }, indicator: "phenolphthalein", endpointML: null } },
    { id: "q1", template: "titration_lab", templateReason: "titration", params: {}, misconceptions: misT, correctWhy: "0.150 × 20.0 ÷ 0.100 = 30.0 mL of NaOH.",
      wrong: [{ misconceptionId: "inverted_molarity_ratio", wrongFormula: "Mt*Va/Ma", text: null, why: "That flipped the molarities." },
              { misconceptionId: "assumed_equal_volumes", wrongFormula: "Va", text: null, why: "Equal volumes only work for equal molarities." },
              { misconceptionId: "treated_as_diprotic", wrongFormula: "2*Ma*Va/Mt", text: null, why: "Acetic acid has one acidic H." },
              { misconceptionId: "halved_mole_ratio", wrongFormula: "Ma*Va/Mt/2", text: null, why: "The ratio is 1:1, not 1:2." }] } as any),
  assemble({ ...base, id: "q2", subject: "chemistry", topic: "other_chemistry", concept: "identify ions with tests",
      prompt: "Sample X is a white solid. Run the tests on the bench and identify it.", unknown: null, given: {}, unit: null, formula: null,
      answerText: "potassium chloride", mystery: { compound: "KCl" } },
    { id: "q2", template: "mystery_sample", templateReason: "identify the unknown", params: {}, correctWhy: "Lilac flame = K⁺; white precipitate with AgNO₃ = Cl⁻.",
      misconceptions: [{ id: "placeholder_mystery", label: "-", why: "-", concept: "-" }],
      wrong: [1, 2, 3].map(() => ({ misconceptionId: "placeholder_mystery", wrongFormula: null, text: "-", why: "-" })) } as any),
  assemble({ ...base, id: "q3", subject: "chemistry", topic: "reaction_prediction", concept: "precipitation", prompt: "What do you see when lead(II) nitrate is mixed with potassium iodide?", unknown: null, given: {}, unit: null, formula: null, answerText: "Bright yellow solid forms", reaction: rx },
    { id: "q3", template: "mix_lab", templateReason: "mixing", params: {}, misconceptions: misC, correctWhy: "PbI₂ is insoluble and yellow.",
      wrong: [{ misconceptionId: "gas_vs_precipitate", wrongFormula: null, text: "Bubbles of gas", why: "No gas forms." },
              { misconceptionId: "no_reaction_assumed", wrongFormula: null, text: "Nothing happens", why: "A solid forms." },
              { misconceptionId: "wrong_precipitate_color", wrongFormula: null, text: "White solid forms", why: "PbI₂ is yellow." }] } as any),
  assemble({ ...base, id: "q4", subject: "chemistry", topic: "balancing_equations", concept: "balancing", prompt: "Balance: __H2 + __O2 → __H2O", unknown: null, given: {}, unit: null, formula: null, equation: "2H2 + O2 -> 2H2O" },
    { id: "q4", template: "equation_balancer", templateReason: "balance", params: {}, misconceptions: misB, correctWhy: "4 H and 2 O on each side.",
      wrong: [{ misconceptionId: "unbalanced_oxygen", wrongFormula: null, text: "1, 1, 1", why: "O doesn't match." },
              { misconceptionId: "unbalanced_hydrogen", wrongFormula: null, text: "1, 1, 2", why: "H doesn't match." },
              { misconceptionId: "changed_subscripts", wrongFormula: null, text: "H2 + O2 -> H2O2", why: "That's a different chemical." }] } as any),
  assemble({ ...base, id: "q5", subject: "chemistry", topic: "stoichiometry", concept: "mass-to-mass stoichiometry",
      prompt: "Mg + 2HCl → MgCl₂ + H₂. What mass of hydrogen gas forms from 2.43 g of magnesium? (Mg = 24.3 g/mol, H₂ = 2.016 g/mol)",
      unknown: "m_H2", given: { m: { value: 2.43, unit: "g" }, MMg: { value: 24.3, unit: "g/mol" }, MH2: { value: 2.016, unit: "g/mol" } }, unit: "g", formula: "m/MMg*MH2" },
    { id: "q5", template: "answer_balloons", templateReason: "numeric stoichiometry", params: {}, misconceptions: misS, correctWhy: "2.43 g ÷ 24.3 = 0.100 mol Mg = 0.100 mol H₂ × 2.016 = 0.202 g.",
      wrong: [{ misconceptionId: "stopped_at_moles", wrongFormula: "m/MMg", text: null, why: "0.100 is moles; multiply by 2.016 g/mol." },
              { misconceptionId: "used_hcl_coefficient", wrongFormula: "2*m/MMg*MH2", text: null, why: "The 2 belongs to HCl." },
              { misconceptionId: "inverted_molar_masses", wrongFormula: "m*MMg/MH2", text: null, why: "Divide by Mg's molar mass." }] } as any),
];
const errors = built.flatMap((b) => b.errors);
if (errors.length) { console.error("fixture failed code checks:", errors); process.exit(1); }
const added = built.flatMap((b) => b.added ?? []);
const ws = Worksheet.parse({ id: "ws_fixture", title: "Chemistry Lab Warm-up (dev fixture)", source: "generated", imageHash: null,
  questions: built.map((b) => b.question), misconceptions: [...misT, ...added.filter((m, i) => added.findIndex((x) => x.id === m.id) === i), ...misC, ...misB, ...misS],
  createdAt: new Date().toISOString() });
fs.mkdirSync("data/fixtures", { recursive: true });
fs.writeFileSync("data/fixtures/worksheet.json", JSON.stringify(ws, null, 2));
console.log("wrote data/fixtures/worksheet.json:", ws.questions.map((q) => `${q.id}:${q.template}`).join(", "));
console.log("flags:", built.flatMap((b) => b.flags));
