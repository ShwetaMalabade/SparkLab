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

// --- Regression checks added Sat 1:45 AM (Claude review of v3) ---
{
  const st = { updatedAt: "2026-11-14T05:30:00Z", sessionId: "6736a1f0c2b9e41d8f0a1b2c", topMistakes: [{ label: "Used sin θ instead of sin 2θ", students: 3, ofStudents: 5 }] };
  const checks: [string, boolean][] = [
    ["dates don't whitelist numbers (14 students rejected)", numbersAllowed("14 students missed it", st) === false],
    ["mongo ids don't whitelist numbers", numbersAllowed("736 tries", st) === false],
    ["percent of real counts allowed (60%)", numbersAllowed("60% made the sin θ mistake", st) === true],
    ["label numbers allowed (sin 2θ)", numbersAllowed("3 of 5 used sin θ, not sin 2θ", st) === true],
    ["invented percent rejected (70%)", numbersAllowed("70% struggled", st) === false],
  ];
  for (const [n, c] of checks) { console.log(c ? "PASS" : "FAIL", n); if (!c) process.exitCode = 1; }
}
