// scripts/make-fixture.ts — P2, Phase 0. Builds data/fixtures/worksheet.json for P1 to develop against.
// The drafts below are shaped like real Agent 1 + Agent 2 output; the REAL assemble() + code checks build every
// question, so the fixture matches the live schema exactly. Dev-only: never shown in the demo.
// Run: npx tsx scripts/make-fixture.ts
import fs from "node:fs";
import { assemble } from "../src/lib/assemble";
import { Worksheet } from "../src/lib/schema";

const base = { subject: "physics", printedChoices: null, reaction: null, equation: null, confidence: 0.9, printedAnswer: null, answerText: "" } as any;
const G = { v: { value: 20, unit: "m/s" }, theta: { value: 30, unit: "deg" }, g: { value: 9.81, unit: "m/s^2" } };
const misR = [{ id: "sin_theta_not_sin_2theta", label: "Used sin θ instead of sin 2θ", why: "Range uses sin(2θ).", concept: "range" },
  { id: "lost_factor_2", label: "Dropped the 2 in 2sinθcosθ", why: "sin 2θ = 2 sinθ cosθ.", concept: "range" },
  { id: "doubled_range", label: "Doubled the range", why: "The ball lands once.", concept: "range" }];
const misF = [{ id: "ignored_friction", label: "Ignored friction", why: "Friction pushes back.", concept: "net force" },
  { id: "added_friction", label: "Added friction", why: "Friction reduces net force.", concept: "net force" },
  { id: "mass_weight_confusion", label: "Mixed up mass and weight", why: "Divide by mass, not weight.", concept: "net force" }];
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

const built = [
  assemble({ ...base, id: "q1", topic: "projectile_motion", concept: "range uses sin 2θ", prompt: "A ball is launched at 20 m/s at 30° above level ground. How far does it travel?", unknown: "R", given: G, unit: "m", formula: "v^2*sin(2*theta*pi/180)/g", printedAnswer: "34.0 m" },
    { id: "q1", template: "projectile_launcher", templateReason: "launch angle question", params: {}, misconceptions: misR, correctWhy: "R = v² sin 2θ / g ≈ 35.3 m.",
      wrong: [{ misconceptionId: "sin_theta_not_sin_2theta", wrongFormula: "v^2*sin(theta*pi/180)/g", text: null, why: "That used sin 30° instead of sin 60°." },
              { misconceptionId: "lost_factor_2", wrongFormula: "v^2*sin(theta*pi/180)*cos(theta*pi/180)/g", text: null, why: "That lost the 2." },
              { misconceptionId: "doubled_range", wrongFormula: "2*v^2*sin(2*theta*pi/180)/g", text: null, why: "That's double the range." }] } as any),
  assemble({ ...base, id: "q2", topic: "newtons_second_law", concept: "net force with friction", prompt: "A 10 kg crate is pushed with 50 N; friction coefficient 0.2. Acceleration?", unknown: "a",
      given: { F: { value: 50, unit: "N" }, m: { value: 10, unit: "kg" }, mu: { value: 0.2, unit: "" }, g: { value: 9.81, unit: "m/s^2" } }, unit: "m/s²", formula: "(F - mu*m*g)/m" },
    { id: "q2", template: "answer_balloons", templateReason: "generic numeric", params: {}, misconceptions: misF, correctWhy: "Net force 30.4 N ÷ 10 kg.",
      wrong: [{ misconceptionId: "ignored_friction", wrongFormula: "F/m", text: null, why: "That ignores friction." },
              { misconceptionId: "added_friction", wrongFormula: "(F + mu*m*g)/m", text: null, why: "Friction was added." },
              { misconceptionId: "mass_weight_confusion", wrongFormula: "(F - mu*m*g)/(m*g)", text: null, why: "That divided by weight." }] } as any),
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
];
const errors = built.flatMap((b) => b.errors);
if (errors.length) { console.error("fixture failed code checks:", errors); process.exit(1); }
const ws = Worksheet.parse({ id: "ws_fixture", title: "Dev fixture (code-assembled)", source: "generated", imageHash: null,
  questions: built.map((b) => b.question), misconceptions: [...misR, ...misF, ...misC, ...misB], createdAt: new Date().toISOString() });
fs.mkdirSync("data/fixtures", { recursive: true });
fs.writeFileSync("data/fixtures/worksheet.json", JSON.stringify(ws, null, 2));
console.log("wrote data/fixtures/worksheet.json:", ws.questions.map((q) => `${q.id}:${q.template}`).join(", "));
console.log("flags:", built.flatMap((b) => b.flags));
