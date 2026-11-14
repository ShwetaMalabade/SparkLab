import { assemble, checkReaction } from "../src/lib/assemble";
const G = { v: { value: 20, unit: "m/s" }, theta: { value: 30, unit: "deg" }, g: { value: 9.81, unit: "m/s^2" } };
const base = { subject: "physics", topic: "projectile_motion", concept: "range uses sin 2θ", prompt: "A ball is launched at 20 m/s at 30°. Range?", unknown: "R", printedChoices: null, reaction: null, equation: null, confidence: 0.9 } as any;
const mis = [{ id: "sin_theta_not_sin_2theta", label: "Used sin θ instead of sin 2θ", why: "Range uses sin(2θ).", concept: "range" },
  { id: "lost_factor_2", label: "Dropped the 2 in 2sinθcosθ", why: "sin 2θ = 2 sinθ cosθ.", concept: "range" },
  { id: "doubled_range", label: "Doubled the range", why: "The ball lands once.", concept: "range" }];
let fails = 0; const ok = (n: string, c: boolean, x?: any) => { if (!c) fails++; console.log(c ? "PASS" : "FAIL", n, x === undefined ? "" : JSON.stringify(x)); };

const q1 = assemble({ ...base, id: "q1", given: G, unit: "m", formula: "v^2*sin(2*theta*pi/180)/g", printedAnswer: "34.0 m", answerText: "" },
  { id: "q1", template: "projectile_launcher", templateReason: "launch", params: {}, misconceptions: mis, correctWhy: "R = v² sin 2θ / g ≈ 35.3 m.",
    wrong: [{ misconceptionId: "sin_theta_not_sin_2theta", wrongFormula: "v^2*sin(theta*pi/180)/g", text: null, why: "That used sin 30° instead of sin 60°." },
            { misconceptionId: "lost_factor_2", wrongFormula: "v^2*sin(theta*pi/180)*cos(theta*pi/180)/g", text: null, why: "That lost the 2." },
            { misconceptionId: "doubled_range", wrongFormula: "2*v^2*sin(2*theta*pi/180)/g", text: null, why: "That's double." }] } as any);
ok("q1 assembles", !!q1.question, q1.errors);
ok("q1 key typo flagged", q1.flags.some((f) => f.startsWith("answer_key_mismatch")), q1.flags);
ok("q1 launcher, speed locked", q1.question?.template === "projectile_launcher" && q1.question?.params.lock === "speed");
console.log("   q1 choices:", q1.question?.choices.map((c) => `${c.id}:${c.text}${c.correct ? "✓" : ""}`).join("  "));

const rx = { reactants: [{ formula: "Pb(NO3)2", name: "lead(II) nitrate", state: "aq" }, { formula: "KI", name: "potassium iodide", state: "aq" }],
  products: [{ formula: "PbI2", name: "lead(II) iodide", state: "s" }, { formula: "KNO3", name: "potassium nitrate", state: "aq" }],
  equation: "Pb(NO₃)₂ + 2KI → PbI₂ + 2KNO₃", type: "precipitation", observation: "A bright yellow solid forms",
  visual: { bubbles: false, colorFrom: "#F5F5F5", colorTo: "#F5F5F5", precipitateColor: "#FFD21F", heat: "none", flame: null }, hazard: "Lead compounds are toxic" } as any;
ok("PbI2 reaction passes checks", checkReaction(rx).length === 0, checkReaction(rx));
ok("missing hazard caught", checkReaction({ ...rx, hazard: null }).some((e) => /hazard/.test(e)));
ok("soluble 'precipitate' caught", checkReaction({ ...rx, products: [{ ...rx.products[0], formula: "PbI2" }, { ...rx.products[1], state: "s" }] }).some((e) => /KNO3 is soluble/.test(e)));
ok("bubbles without gas caught", checkReaction({ ...rx, visual: { ...rx.visual, bubbles: true } }).some((e) => /no gas/.test(e)));
const misC = [{ id: "gas_vs_precipitate", label: "Confused gas with solid", why: "x", concept: "precipitation" }, { id: "no_reaction_assumed", label: "Assumed nothing happens", why: "x", concept: "precipitation" }, { id: "wrong_precipitate_color", label: "Wrong color", why: "x", concept: "precipitation" }];
const q3 = assemble({ ...base, id: "q3", subject: "chemistry", topic: "reaction_prediction", concept: "precipitation", given: {}, unit: null, formula: null, printedAnswer: null, answerText: "Bright yellow solid forms", reaction: rx },
  { id: "q3", template: "mix_lab", templateReason: "mixing", params: {}, misconceptions: misC, correctWhy: "PbI₂ is insoluble and yellow.",
    wrong: [{ misconceptionId: "gas_vs_precipitate", wrongFormula: null, text: "Bubbles of gas", why: "No gas forms." }, { misconceptionId: "no_reaction_assumed", wrongFormula: null, text: "Nothing happens", why: "A solid forms." }, { misconceptionId: "wrong_precipitate_color", wrongFormula: null, text: "White solid forms", why: "PbI₂ is yellow." }] } as any);
ok("q3 mix lab assembles", q3.question?.template === "mix_lab", q3.errors);

const misB = [{ id: "unbalanced_oxygen", label: "O atoms don't match", why: "x", concept: "balancing" }, { id: "unbalanced_hydrogen", label: "H atoms don't match", why: "x", concept: "balancing" }, { id: "changed_subscripts", label: "Changed subscripts", why: "x", concept: "balancing" }, { id: "fake", label: "f", why: "x", concept: "balancing" }];
const q4 = assemble({ ...base, id: "q4", subject: "chemistry", topic: "balancing_equations", concept: "balancing", given: {}, unit: null, formula: null, printedAnswer: null, answerText: "", equation: "2H2 + O2 -> 2H2O" },
  { id: "q4", template: "equation_balancer", templateReason: "balance", params: {}, misconceptions: misB, correctWhy: "4 H and 2 O each side.",
    wrong: [{ misconceptionId: "unbalanced_oxygen", wrongFormula: null, text: "1, 1, 1", why: "O off" }, { misconceptionId: "unbalanced_hydrogen", wrongFormula: null, text: "1, 1, 2", why: "H off" },
            { misconceptionId: "fake", wrongFormula: null, text: "4, 2, 4", why: "x" }, { misconceptionId: "changed_subscripts", wrongFormula: null, text: "H2 + O2 -> H2O2", why: "different chemical" }] } as any);
ok("q4 balancer assembles; balanced '4, 2, 4' rejected as a wrong option", q4.question?.template === "equation_balancer" && !q4.question?.choices.some((c) => c.text === "4, 2, 4"), q4.errors);
console.log("   q4 choices:", q4.question?.choices.map((c) => `${c.id}:${c.text}${c.correct ? "✓" : ""}`).join("  "));
const bad = assemble({ ...base, id: "q9", given: G, unit: "m", formula: "v^2*sin(2*theta)/g", printedAnswer: null, answerText: "" }, { id: "q9", template: "projectile_launcher", templateReason: "", params: {}, misconceptions: mis, correctWhy: "", wrong: [] } as any);
ok("degree bug in the main formula goes to repair, not auto-correct", !bad.question && /degrees/.test(bad.errors[0]), bad.errors);
console.log(fails ? `${fails} FAILED` : "all assemble checks passed");
