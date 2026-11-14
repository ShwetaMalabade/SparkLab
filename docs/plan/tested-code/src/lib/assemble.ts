// src/lib/assemble.ts — code turns agent drafts into a playable, verified Question.
import { z } from "zod";
import { ReadQuestion, DesignQuestion, Question, Reaction, type TQuestion } from "./schema";
import { buildNumericChoices } from "./verifyPhysics";
import { isBalanced, splitEquation, sameSpecies, solubility, normalizeChem, withCoefficients } from "./chem";

type R = z.infer<typeof ReadQuestion>; type D = z.infer<typeof DesignQuestion>; type Rx = z.infer<typeof Reaction>;
const HEAVY = /(Pb|Hg|Ba|Cr|Cd|As|Tl)/;
const BLOCK = /explosiv|detonat|weapon|nitroglycerin|TATP|thermite|nerve agent|chlorine gas at home/i;

/** Deterministic shuffle (same question id → same order), so replays match live runs. */
function shuffle<T>(xs: T[], seed: string): T[] {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1274126177); const j = Math.abs(h) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function checkReaction(rx: Rx): string[] {
  const e: string[] = [];
  const b = isBalanced(rx.equation);
  if (b.error) return [b.error];
  if (!b.balanced) e.push(`equation not balanced: ${JSON.stringify(b.diff)}`);
  if (!b.minimal) e.push(`use the smallest whole-number coefficients`);
  const s = splitEquation(rx.equation)!;
  const set = (xs: string[]) => [...xs].map((x) => normalizeChem(x)).sort().join("|");
  if (set([...s.left, ...s.right].map((t) => t.formula)) !== set([...rx.reactants, ...rx.products].map((x) => x.formula)))
    e.push(`equation species don't match the reactants/products lists`);
  for (const p of rx.products) {
    const sol = solubility(p.formula);
    if (p.state === "s" && sol === "soluble") e.push(`${p.formula} is soluble by the solubility rules, so it can't be the precipitate`);
    if (p.state === "aq" && sol === "insoluble") e.push(`${p.formula} is insoluble by the solubility rules; it should be (s)`);
  }
  const solid = rx.products.some((p) => p.state === "s"), gas = rx.products.some((p) => p.state === "g");
  if (solid !== (rx.visual.precipitateColor !== null)) e.push(`precipitateColor must be set if and only if a product is (s)`);
  if (rx.visual.bubbles && !gas) e.push(`bubbles shown but no gas product`);
  if (gas && !rx.visual.bubbles && rx.type !== "combustion") e.push(`a gas forms, so bubbles must be true`);
  if ([...rx.reactants, ...rx.products].some((x) => HEAVY.test(x.formula)) && !rx.hazard) e.push(`add a short hazard warning (heavy metal)`);
  return e;
}

export function assemble(r: R, d: D, origin: "worksheet" | "variant" = "worksheet", parentId: string | null = null):
  { question?: TQuestion; errors: string[]; flags: string[]; notes: string[] } {
  const errors: string[] = []; const flags: string[] = []; const notes: string[] = []; // notes = rejected spares, shown in the AI trace
  if (BLOCK.test(JSON.stringify([r.prompt, r.reaction, d.wrong]))) return { errors: [`${r.id}: unsupported content (safety)`], flags, notes };
  const misIds = new Set(d.misconceptions.map((m) => m.id));
  for (const w of d.wrong) if (!misIds.has(w.misconceptionId)) errors.push(`${r.id}: wrong option uses unknown misconceptionId ${w.misconceptionId}`);
  const whyOf = (id: string) => d.wrong.find((w) => w.misconceptionId === id)?.why ?? "";

  let correctText = ""; let wrong: { misconceptionId: string; text: string; why: string }[] = [];
  let answer = { value: null as number | null, unit: r.unit, text: r.answerText };
  let formula: string | null = null; let template = d.template; let equation = r.equation; let reaction = r.reaction;

  if (r.formula) {                                                  // ---- numeric
    const key = r.printedAnswer ? parseFloat(r.printedAnswer.replace(/[^\d.eE+-]/g, "")) : null;
    const out = buildNumericChoices({ id: r.id, given: r.given, unit: r.unit, formula: r.formula, printedKey: Number.isFinite(key as number) ? key : null,
      wrong: d.wrong.filter((w) => w.wrongFormula).map((w) => ({ misconceptionId: w.misconceptionId, wrongFormula: w.wrongFormula! })) });
    flags.push(...out.flags); notes.push(...out.errors);
    if (!out.correct || out.wrong!.length < 3) return { errors: [...errors, ...out.errors], flags, notes };
    formula = out.formula!; correctText = out.correct.text; answer = { value: out.correct.value, unit: r.unit, text: out.correct.text };
    wrong = out.wrong!.map((w) => ({ misconceptionId: w.misconceptionId, text: w.text, why: whyOf(w.misconceptionId) }));
  } else if (r.equation) {                                          // ---- balancing
    const b = isBalanced(r.equation);
    if (b.error || !b.balanced || !b.minimal) return { errors: [...errors, `${r.id}: balanced answer is wrong: ${b.error ?? JSON.stringify(b.diff)}${b.minimal ? "" : " (not simplest)"}`], flags, notes };
    const s = splitEquation(r.equation)!; const coefs = [...s.left, ...s.right].map((t) => t.coef);
    correctText = coefs.join(", "); answer.text = normalizeChem(r.equation);
    for (const w of d.wrong) {
      if (!w.text) continue;
      const nums = w.text.split(/\s*,\s*/).map(Number);
      if (nums.length === coefs.length && nums.every((n) => Number.isInteger(n) && n >= 1)) {
        const eq = withCoefficients(s.left.map((t) => t.formula), s.right.map((t) => t.formula), nums.slice(0, s.left.length), nums.slice(s.left.length));
        if (isBalanced(eq).balanced) { notes.push(`${r.id}: dropped wrong option "${w.text}": it is actually balanced`); continue; }
      } else if (sameSpecies(normalizeChem(w.text), r.equation)) { notes.push(`${r.id}: dropped wrong option "${w.text}": same equation`); continue; }
      wrong.push({ misconceptionId: w.misconceptionId, text: w.text, why: w.why });
    }
    const allOnes = withCoefficients(s.left.map((t) => t.formula), s.right.map((t) => t.formula), s.left.map(() => 1), s.right.map(() => 1));
    const fitsBalancer = coefs.length <= 4 && Math.max(...coefs) <= 9 && !isBalanced(allOnes).balanced;
    if (template === "equation_balancer" && !fitsBalancer) { template = "answer_balloons"; flags.push("template_fallback"); }
  } else {                                                          // ---- reaction / conceptual
    if (reaction) { const rxErr = checkReaction(reaction); if (rxErr.length) return { errors: [...errors, ...rxErr.map((x) => `${r.id}: ${x}`)], flags, notes }; }
    correctText = r.answerText;
    wrong = d.wrong.filter((w) => w.text).map((w) => ({ misconceptionId: w.misconceptionId, text: w.text!, why: w.why }));
  }

  // template gates (code decides what the 3D scene can honestly simulate)
  const launcherOk = r.topic === "projectile_motion" && !!formula && ("v" in r.given || "theta" in r.given);
  const mixOk = !!reaction && reaction.reactants.length === 2;
  if ((template === "projectile_launcher" && !launcherOk) || (template === "mix_lab" && !mixOk)) { template = "answer_balloons"; flags.push("template_fallback"); }
  if (template === "equation_balancer" && !equation) { template = "answer_balloons"; flags.push("template_fallback"); }
  let lock = d.params.lock ?? "none";
  if (template === "projectile_launcher") lock = "v" in r.given && "theta" in r.given ? (lock === "angle" ? "angle" : "speed") : "v" in r.given ? "speed" : "angle";

  const uniq = wrong.filter((w, i) => w.text !== correctText && wrong.findIndex((x) => x.text === w.text) === i).slice(0, 3);
  if (uniq.length < 3) return { errors: [...errors, ...notes, `${r.id}: need 3 distinct valid wrong options, have ${uniq.length}`], flags, notes };
  if (errors.length) return { errors, flags, notes };

  const ordered = shuffle([{ text: correctText, correct: true, misconceptionId: null as string | null, why: d.correctWhy }, ...uniq.map((w) => ({ ...w, correct: false }))], r.id);
  const q = Question.safeParse({
    id: r.id, origin, parentId, subject: r.subject, topic: r.topic, concept: r.concept, template,
    params: { lock, decoys: d.params.decoys }, prompt: r.prompt, given: r.given, formula, answer, reaction, equation,
    choices: ordered.map((c, i) => ({ id: "ABCD"[i], text: c.text, correct: c.correct, misconceptionId: c.misconceptionId, why: c.why })),
    flags: [...flags, ...(r.confidence < 0.6 ? ["low_confidence_read"] : [])],
  });
  return q.success ? { question: q.data, errors: [], flags, notes } : { errors: q.error.issues.map((i) => `${r.id}: ${i.path.join(".")} ${i.message}`), flags, notes };
}
