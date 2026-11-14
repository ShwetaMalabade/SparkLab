# 09 · Paper Tests (before code) + Run-Time Checklist (after code)
**Owner:** all · **Rule:** every part is walked through on paper (or with a short script) *before* it's coded, and the run-time checks pass before the 3 AM freeze.

---

## 1. How to paper-test
For each part: write the inputs, walk the rules by hand or with a short script, write the expected output, and compare with what the plan says. If they disagree, fix the **plan file first**, then code. The results below were run by Claude on Sat Nov 14 with Node 22, TypeScript strict, Zod 3, mathjs, using the exact code in `02` and `03`. The three test files are in §8; copy them into `tests/`.

## 2. Code checks already run (73 passing, 0 failing)

### 2.1 Chemistry (`chem.ts`), 39 checks
| Test | Result |
|---|---|
| 14 classic reactions (baking soda + vinegar … Ba(OH)₂·8H₂O + NH₄Cl) | all balance ✅ |
| `Fe2(SO4)3`, `Ba(OH)2·8H2O`, `CuSO4.5H2O` | {Fe:2,S:3,O:12} · {Ba:1,O:10,H:18} · {Cu:1,S:1,O:9,H:10} ✅ |
| Unicode `H₂O` | {H:2, O:1} ✅ (v2 read {H:1, O:1}) |
| Arrows `→ => ⇌ <=> <-> = --> ⟶` | all parse and balance ✅ (v2 **crashed** on `⇌`) |
| `H2 + O2` (no arrow) | returns an error, no crash ✅ |
| `H2 + O2 -> H2O` / `H2 + O2 -> 2H2O` | O off [2,1] / H off [2,4] ✅ |
| `4H2 + 2O2 -> 4H2O` | balanced but not simplest ✅ |
| `H2 + O2 -> H2O2` | balanced **and** a different species → Balancer trap works ✅ |
| Solubility rules on 19 compounds (AgCl, PbI₂, Cu(OH)₂, BaSO₄, CaCO₃ … NaNO₃, KI, Ba(OH)₂) | all as expected ✅ |

### 2.2 Physics (`verifyPhysics.ts`), 14 checks
| Test | Result |
|---|---|
| Lint accepts `sin(2*theta*pi/180)`, `sin(pi/180*2*theta)`, `sin((2*theta)*pi/180)`, `v**2*sin(2*θ*pi/180)` | ✅ (v2 regex wrongly flagged the 2nd and 3rd) |
| Lint rejects `sin(2*theta)` (degrees), unknown symbol `angle`, missing `)` | ✅ |
| q1 (20 m/s, 30°): correct + wrong formulas → `35.3 m`, `20.4 m`, `17.7 m`, `70.6 m` | ✅ code wrote every number |
| q1 printed key `34.0 m` | flag `answer_key_mismatch:34->35.3` ✅ |
| A wrong formula with the degree bug | rejected as a spare, not used ✅ |
| q5 (20 m drop): `h/g` = 2.04 s vs correct 2.02 s | rejected: within 5% ✅ |
| q5 choices | `2.02 s`, `4.08 s`, `1.43 s`, `19.8 s` ✅ |
| `fmt` | `1235 J`, `0.310 m/s²` (no exponent notation) ✅ |

### 2.3 Schemas, 2 checks (+ 1 Attempt check run separately)
| Test | Result |
|---|---|
| Reader draft vs `ReadOut` | passes ✅ |
| Reader draft vs final `Question` | **fails** (as it should). This is v2's bug: the old plan validated drafts with the final schema, so every scan would have failed ✅ |
| Attempt with hover trace + experiments | passes ✅ |

### 2.4 Assembly (`assemble.ts`), 10 checks
| Test | Result |
|---|---|
| q1 launcher draft → verified question, speed locked, key typo flagged; choices shuffled (`A 17.7 · B 35.3 ✓ · C 70.6 · D 20.4`) | ✅ |
| Pb(NO₃)₂ + KI → PbI₂(s) reaction (Unicode input) | passes `checkReaction` ✅ |
| Same reaction without a hazard note / with KNO₃ as the "precipitate" / bubbles with no gas | each caught ✅ |
| Mix Lab question assembles | ✅ |
| Balancer: AI offered "4, 2, 4" as a *wrong* option | code drops it (it's balanced), keeps the question ✅ |
| Main formula with the degree bug | goes to repair, never "auto-corrected" ✅ |

### 2.5 Coach (`director.ts`), 8 checks
| Test | Result |
|---|---|
| Insight number guard: real "3 of 5 … 40%" allowed; invented "4 of 5" rejected | ✅ |
| Fallback picks the next unplayed question | ✅ |
| Coach tries to finish early / names an unknown question / exceeds the variant limit | each overruled by code ✅ |
| **Coach writes a variant at 60°** | **rejected by code**: at 60°, `v²·sin θ/g` = `v²·sin 2θ/g` = 55.2 m (sin 60° = sin 120°), so the "sin θ" mistake can't be told apart from the right answer. Game falls back. ✅ This is why the coach prompt now says "avoid 30°/60°" |
| Coach writes a variant at 50° | accepted: `62.7 m ✓`, `31.4`, `48.8`, `125` ✅ |

### 2.6 Type check + round trip
The code blocks were then **extracted back out of these markdown files** into a fresh project and re-run: 73/73 pass. That round trip caught one bug: `extractJson`'s regex contained three backticks, which ended the markdown code block early (v1 and v2 had it too). It now uses `` /`{3}(json)?/g ``.

`tsc --noEmit --strict` on all of `schema.ts`, `chem.ts`, `verifyPhysics.ts`, `assemble.ts`, `ai.ts` (against `@google/genai` 3.3 and `@aws-sdk/client-bedrock-runtime`), `replay.ts`, `director.ts`: **0 errors**.

## 3. Run-time checklist (definition of done, before the 3 AM freeze)

**Motion: 3 different people, 2 lighting setups (bright + one lamp behind), seated 0.6–1.2 m:**
- [ ] Calibration (incl. aim test) passes in ≤ 5 s
- [ ] Forearm angle within ±5° of a phone protractor at 30°, 45°, 60°; the wrist never leaves the frame
- [ ] Dwell selects the intended target ≥ 9/10
- [ ] Clap ≥ 9/10; 0 false claps in the "drinking water" and "scratching head" fixtures
- [ ] Both-hands-up ≥ 9/10; 0 false triggers in 1 minute of talking with hand gestures
- [ ] Hold-steady fires ≥ 9/10, never while the arm rests on the table, and ignores the locked control
- [ ] Hover trace records the right balloon and time (fixture "hover A then pick B")
- [ ] Tracking lost → pause within 1 s; resumes by itself
- [ ] Every gesture works by keyboard
- [ ] `tests/gestures.test.ts` passes on all fixtures

**AI agents (live mode):**
- [ ] Real worksheet photo → Review in ≤ 20 s; ≥ 4 of 5 questions right with no edits (5 tries, 2 lighting setups)
- [ ] Printed answer-key typo (34.0 m) → flagged on Review and in the scan steps
- [ ] Editing a number on Review recomputes all 4 choices with no AI call
- [ ] Critic: a planted wrong color (e.g. "white" PbI₂ in a test draft) gets a block or warn
- [ ] Coach: responds in ≤ 5.5 s on 9/10 answers; on a forced timeout the game continues with the fallback
- [ ] Coach writes at least one variant in a 2-min tour after a wrong answer, and it passes code
- [ ] Classmates: 4 appear with AI badges; their `correct` values match the worksheet's choices
- [ ] Insights: no number outside the stats ever shows (inject a fake one in a test)
- [ ] Gemini 429 → retry once, then fallback + toast; no crash
- [ ] Warm-up (if built): 4 verified questions, printable, and the printout scans back in

**Offline:** `OFFLINE=1 npm start` with Wi-Fi off runs the recorded session end to end, including the second-window live view.

**Live Teacher View:** the checks in `06 §9`.

**Performance and UX:**
- [ ] ≥ 30 fps in Mix Lab with pose running on the demo laptop
- [ ] Speech starts < 1 s after the reveal; captions always on
- [ ] HUD readable from 2 m

## 4. Gesture conflicts (walked on paper ✅)
| Situation | Risk | Rule that prevents it |
|---|---|---|
| Launcher: aim arm up, power hand held high | Both wrists above nose → `bothUp` → skips the question | `bothUp` ignored in the experiment phase |
| Launcher: arm resting on the desk | Hold-steady fires by accident | Needs θ ≥ 10° when angle is free; resting arm reads ≤ 5° |
| Launcher: speed locked, power hand moving | Hold-steady never fires | Locked control is ignored by hold-steady |
| Mix Lab: hand 2 reaches toward hand 1's beaker | Wrists close → clap → pours with one beaker | Clap armed only when both hands hold a beaker |
| Balloons: raising both hands to pop | Cursors sweep through balloons | Dwell needs 800 ms still; balloons sit at 35–75% of screen height. Both-hands-up threshold maps to ~27% of the reach box, above the balloons |
| Balloons float | Target drifts from under the hand | Balloons freeze while hovered |
| Talking with hands | False clap | Clap needs a > 1.2·sw → < 0.35·sw swing within 600 ms; fixture-tested |
| Left-handed student | Wrong arm aims | Left-handed toggle |
| Extended arm at 45° | Wrist leaves the frame → pause | Forearm aiming by default + aim test in calibration |

## 5. Live view math (✅)
- `ofStudents` counts sessions with ≥ 1 attempt. Before the live student answers: N simulated students. After: N + 1. The toast and top-mistake numbers come only from the aggregation, so whatever Agent 5 produced, the phone is internally consistent.
- Simulated attempts are older than page load and flagged `simulated`, so they never toast.

## 6. Load and quota math (confirm in AI Studio, `12` K2)
| Item | Demo load | Note |
|---|---|---|
| Phone polling | 3 phones × 0.5 req/s = 1.5 req/s | Tiny for Vercel + Atlas Free |
| AI calls per 2-min demo | ≈ 13–15 (1–2 vision, rest fast model) | Coach ≈ 1 call per 15–20 s → ~4 per minute at most |
| AI calls per judging day | ~20 demos ≈ 300 | Must fit the fast model's daily limit. If tight: "Use last scan" for repeat demos (saves 3–4 calls), warm-up only when a judge asks |

## 7. Demo walk-through on paper (at the 12 AM sync)
Read the `11` script aloud with a stopwatch, clicking through the app with the keyboard only. Every line must match what's on screen, or be phrased to read the screen ("the top mistake is…"). Total ≤ 2:00.

## 8. Test files (copy into `tests/`, run with `npx tsx tests/<file>`)

### `tests/verify.test.ts` (55 checks)
```ts
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
```

### `tests/assemble.test.ts` (10 checks)
```ts
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
```

### `tests/director.test.ts` (8 checks)
```ts
import { numbersAllowed, fallbackNext, applyDirector } from "../src/lib/agents/director";
let fails = 0; const ok = (n: string, c: boolean, x?: unknown) => { if (!c) fails++; console.log(c ? "PASS" : "FAIL", n, x === undefined ? "" : JSON.stringify(x)); };
const stats = { topMistakes: [{ label: "Used sin θ instead of sin 2θ", students: 3, ofStudents: 5 }], questions: [{ id: "q1", correctPct: 40 }] };
ok("real numbers allowed", numbersAllowed("3 of 5 students used sin θ instead of sin 2θ on q1 (40% correct).", stats) === true);
ok("invented number rejected", numbersAllowed("4 of 5 students struggled.", stats) === false);
const ws: any = { questions: [{ id: "q1", origin: "worksheet" }, { id: "q2", origin: "worksheet" }], misconceptions: [] };
const s = { id: "s", played: ["q1"], variants: [], startedAt: Date.now() - 30000, timeBudgetSec: 120 };
ok("fallback picks next unplayed", fallbackNext(ws, s, "timeout").question?.id === "q2");
const base: any = { feedback: "Nice", reason: "r", studentModel: { concepts: {}, notes: "" }, nextQuestionId: null, targetMisconceptionId: null, newQuestion: null, newMisconceptions: [] };
ok("early finish blocked", applyDirector(ws, s, { questionId: "q1" } as any, { ...base, action: "finish" }).source === "fallback");
ok("bad id → fallback", applyDirector(ws, s, { questionId: "q1" } as any, { ...base, action: "next", nextQuestionId: "q9" }).question?.id === "q2");
ok("variant limit", applyDirector(ws, { ...s, variants: [{ id: "a", target: "x" }, { id: "b", target: "y" }, { id: "c", target: "z" }] }, { questionId: "q1" } as any, { ...base, action: "variant" }).reason.includes("limit"));

function variantAt(TH: number) {
  const ws: any = { questions: [{ id: "q1", origin: "worksheet" }, { id: "q2", origin: "worksheet" }], misconceptions: [{ id: "sin_theta_not_sin_2theta", label: "Used sin θ instead of sin 2θ", why: "Range uses sin(2θ).", concept: "range" }] };
  const s = { id: "s", played: ["q1"], variants: [], startedAt: Date.now() - 30000, timeBudgetSec: 120 };
  const G = { v: { value: 25, unit: "m/s" }, theta: { value: TH, unit: "deg" }, g: { value: 9.81, unit: "m/s^2" } };
  const out: any = { action: "variant", nextQuestionId: null, targetMisconceptionId: "sin_theta_not_sin_2theta", newMisconceptions: [], feedback: "You tried 30° and 60° and they landed together. That's sin 2θ.", reason: "Hovered 20.4 m for 2 s, picked it: targets sin θ vs sin 2θ", studentModel: { concepts: {}, notes: "" },
  newQuestion: { read: { id: "x", subject: "physics", topic: "projectile_motion", concept: "range uses sin 2θ", prompt: "A ball is launched at 25 m/s at TH°. How far does it go?", given: G, unknown: "R", unit: "m", formula: "v^2*sin(2*theta*pi/180)/g", printedAnswer: null, printedChoices: null, answerText: "", reaction: null, equation: null, confidence: 1 },
    design: { id: "x", template: "projectile_launcher", templateReason: "same skill, new numbers", params: { lock: "speed" }, correctWhy: "R = v² sin 2θ / g.",
      misconceptions: [{ id: "doubled_range", label: "Doubled the range", why: "Lands once.", concept: "range" }, { id: "lost_factor_2", label: "Dropped the 2", why: "sin 2θ = 2 sinθ cosθ.", concept: "range" }],
      wrong: [{ misconceptionId: "sin_theta_not_sin_2theta", wrongFormula: "v^2*sin(theta*pi/180)/g", text: null, why: "sin 60° instead of sin 120°." },
              { misconceptionId: "lost_factor_2", wrongFormula: "v^2*sin(theta*pi/180)*cos(theta*pi/180)/g", text: null, why: "Lost the 2." },
              { misconceptionId: "doubled_range", wrongFormula: "2*v^2*sin(2*theta*pi/180)/g", text: null, why: "Double." }] } } };
  return applyDirector(ws, s, { questionId: "q1" } as any, out);
}

const v60 = variantAt(60), v50 = variantAt(50);
ok("coach variant at 60° rejected by code (sin θ trick = right answer there)", v60.source === "fallback" && !!v60.rejected?.some((e) => /within 5%/.test(e)), v60.rejected);
ok("coach variant at 50° accepted and verified", v50.source === "coach" && v50.question?.id === "q1v1" && v50.question?.origin === "variant", v50.question?.choices.map((c) => c.text));
console.log(fails ? `${fails} FAILED` : "all coach checks passed");
```

## Addendum: Claude review of v3, Sat 1:45 AM
Re-ran all tested code from scratch, then probed edge cases. 3 bugs found and fixed (00 §7, F19–F21). 13 regression checks added to `tested-code/tests`. **86/86 pass, `tsc --strict` clean.**
