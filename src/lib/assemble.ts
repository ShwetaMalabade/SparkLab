// src/lib/assemble.ts — code turns agent drafts into a playable, verified Question.
import { z } from "zod";
import { ReadQuestion, DesignQuestion, Question, Reaction, Misconception, type TQuestion, type TTitrationLab, type TMysteryLab } from "./schema";
import { buildNumericChoices, relDiff } from "./verifyPhysics";
import { isBalanced, splitEquation, sameSpecies, solubility, normalizeChem, withCoefficients } from "./chem";
import { analyteMolarityFrom, checkScenario, curve, equivalenceML, INDICATORS, indicatorFits, phAt, type Scenario } from "./acidBase";
import { COMPOUNDS, lookupCompound, mysteryDistractors, MYSTERY_MISCONCEPTIONS, observeAll, TESTS } from "./ions";

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

type M = z.infer<typeof Misconception>;
const UNIT_ML = /^(ml|mL|cm3|cm\^3|cm³)$/;
const UNIT_M = /^(M|mol\/L|mol\/dm3|mol\/dm\^3|mol L-1|mol dm-3)$/i;

/** Titration Lab: code re-derives the answer from stoichiometry (n·M·V on both sides) and checks the AI's formula
 *  agrees, then computes the end point, the curve and the indicator range. Errors go back to the reader. */
export function buildTitration(r: R, answer: number | null): { lab?: TTitrationLab; errors: string[]; flags: string[] } {
  // The numbers in "given" win (Ma, Va, Mt, Vt): a Review edit or a coach variant changes those, and the lab must follow.
  const g = (k: string) => (r.given[k] ? r.given[k].value : undefined);
  const t0 = r.titration!;
  // What's being asked comes from the answer's unit, not from which fields are filled: real reads copied the answer
  // key's volume into endpointML even when the question asks for that volume.
  const ask = UNIT_M.test(r.unit ?? "") ? "analyte_molarity" : "endpoint_ml";
  const t = {
    ...t0,
    analyte: { ...t0.analyte, volumeML: g("Va") ?? t0.analyte.volumeML, molarity: ask === "analyte_molarity" ? null : (g("Ma") ?? t0.analyte.molarity) },
    titrant: { ...t0.titrant, molarity: g("Mt") ?? t0.titrant.molarity },
    endpointML: ask === "analyte_molarity" ? (g("Vt") ?? t0.endpointML) : null,
  };
  let molarity = t.analyte.molarity;
  if (ask === "analyte_molarity") {
    try { molarity = analyteMolarityFrom({ analyte: t.analyte, titrant: t.titrant }, t.endpointML!); } catch { molarity = null; }
  }
  if (molarity == null) return { errors: [`${r.id}: titration needs the analyte's molarity (or the measured end point if the question asks for the molarity)`], flags: [] };
  const sc: Scenario = { analyte: { formula: t.analyte.formula, molarity, volumeML: t.analyte.volumeML }, titrant: t.titrant };
  const c = checkScenario(sc);
  if (!c.ok) return { errors: [`${r.id}: titration: ${c.error}`], flags: [] };
  const eq = equivalenceML(sc);
  const expected = ask === "endpoint_ml" ? eq : molarity;
  const unitOk = ask === "endpoint_ml" ? UNIT_ML.test(r.unit ?? "") : UNIT_M.test(r.unit ?? "");
  if (!unitOk) return { errors: [`${r.id}: titration answer unit must be ${ask === "endpoint_ml" ? "mL" : "M"} (got ${r.unit})`], flags: [] };
  if (answer == null || relDiff(answer, expected) > 0.02)
    return { errors: [`${r.id}: titration formula gives ${answer} but stoichiometry (${c.analyte.n}·M·V of ${c.analyte.formula} = ${c.titrant.n}·M·V of ${c.titrant.formula}) gives ${+expected.toPrecision(4)}; fix the formula (mind the mole ratio)`], flags: [] };
  const I = INDICATORS[t.indicator];
  return {
    errors: [],
    flags: indicatorFits(sc, t.indicator) ? [] : [`indicator_mismatch:${t.indicator}`],
    lab: {
      ask, analyte: { ...t.analyte, molarity }, titrant: t.titrant, indicator: t.indicator,
      indicatorInfo: { name: I.name, low: I.low, high: I.high, acid: I.acid, base: I.base, acidLabel: I.acidLabel, baseLabel: I.baseLabel },
      equivalenceML: +eq.toFixed(3), startPH: +phAt(sc, 0).toFixed(2), endPH: +phAt(sc, eq).toFixed(2), curve: curve(sc),
    },
  };
}

/** Mystery Sample: code decides every observation and picks the wrong answers (compounds that look alike on most tests). */
export function buildMystery(r: R): { lab?: TMysteryLab; correct?: string; wrong?: { misconceptionId: string; text: string; why: string }[]; added?: M[]; errors: string[] } {
  const c = lookupCompound(r.mystery!.compound);
  if (!c) return { errors: [`${r.id}: mystery compound "${r.mystery!.compound}" isn't in the test table; use one of ${COMPOUNDS.map((x) => x.formula).join(", ")}`] };
  const label = (x: { name: string; formula: string }) => `${x.name} (${x.formula})`;
  const ds = mysteryDistractors(c);
  const added = [...new Set(ds.map((x) => x.misconceptionId))].map((id) => ({ id, ...MYSTERY_MISCONCEPTIONS[id] }));
  return {
    errors: [], correct: label(c), added,
    wrong: ds.map((x) => ({ misconceptionId: x.misconceptionId, text: label(x.compound), why: MYSTERY_MISCONCEPTIONS[x.misconceptionId].why })),
    lab: { compound: { formula: c.formula, name: c.name }, tests: observeAll(c).map((o) => ({ ...o, detail: TESTS[o.test].detail })) },
  };
}

export function assemble(r: R, d: D, origin: "worksheet" | "variant" = "worksheet", parentId: string | null = null):
  { question?: TQuestion; errors: string[]; flags: string[]; notes: string[]; added?: M[] } {
  const errors: string[] = []; const flags: string[] = []; const notes: string[] = []; // notes = rejected spares, shown in the AI trace
  if (BLOCK.test(JSON.stringify([r.prompt, r.reaction, d.wrong]))) return { errors: [`${r.id}: unsupported content (safety)`], flags, notes };
  const misIds = new Set(d.misconceptions.map((m) => m.id));
  for (const w of d.wrong) if (!misIds.has(w.misconceptionId)) errors.push(`${r.id}: wrong option uses unknown misconceptionId ${w.misconceptionId}`);
  const whyOf = (id: string) => d.wrong.find((w) => w.misconceptionId === id)?.why ?? "";

  let correctText = ""; let wrong: { misconceptionId: string; text: string; why: string }[] = [];
  let answer = { value: null as number | null, unit: r.unit, text: r.answerText };
  let formula: string | null = null; let template = d.template; let equation = r.equation; let reaction = r.reaction;
  let titration: TTitrationLab | null = null; let mystery: TMysteryLab | null = null; let added: M[] = [];

  if (r.formula) {                                                  // ---- numeric
    const key = r.printedAnswer ? parseFloat(r.printedAnswer.replace(/[^\d.eE+-]/g, "")) : null;
    const out = buildNumericChoices({ id: r.id, given: r.given, unit: r.unit, formula: r.formula, printedKey: Number.isFinite(key as number) ? key : null,
      wrong: d.wrong.filter((w) => w.wrongFormula).map((w) => ({ misconceptionId: w.misconceptionId, wrongFormula: w.wrongFormula! })) });
    flags.push(...out.flags); notes.push(...out.errors);
    if (!out.correct || out.wrong!.length < 3) return { errors: [...errors, ...out.errors], flags, notes };
    formula = out.formula!; correctText = out.correct.text; answer = { value: out.correct.value, unit: r.unit, text: out.correct.text };
    wrong = out.wrong!.map((w) => ({ misconceptionId: w.misconceptionId, text: w.text, why: whyOf(w.misconceptionId) }));
    if (r.titration) {                                              // ---- titration: same numeric choices + code's lab data
      const t = buildTitration(r, out.correct.value);
      if (t.errors.length) return { errors: [...errors, ...t.errors], flags, notes };
      titration = t.lab!; flags.push(...t.flags); template = "titration_lab";
    }
  } else if (r.mystery) {                                           // ---- identify the unknown: code builds every choice
    const m = buildMystery(r);
    if (m.errors.length) return { errors: [...errors, ...m.errors], flags, notes };
    mystery = m.lab!; correctText = m.correct!; wrong = m.wrong!; added = m.added!; template = "mystery_sample";
    answer = { value: null, unit: null, text: m.correct! };
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
  if ((template === "titration_lab" && !titration) || (template === "mystery_sample" && !mystery)) { template = "answer_balloons"; flags.push("template_fallback"); }
  let lock = d.params.lock ?? "none";
  if (template === "projectile_launcher") lock = "v" in r.given && "theta" in r.given ? (lock === "angle" ? "angle" : "speed") : "v" in r.given ? "speed" : "angle";

  const uniq = wrong.filter((w, i) => w.text !== correctText && wrong.findIndex((x) => x.text === w.text) === i).slice(0, 3);
  if (uniq.length < 3) return { errors: [...errors, ...notes, `${r.id}: need 3 distinct valid wrong options, have ${uniq.length}`], flags, notes };
  if (errors.length && !mystery) return { errors, flags, notes };  // mystery choices come from code, not the designer's ids

  const ordered = shuffle([{ text: correctText, correct: true, misconceptionId: null as string | null, why: d.correctWhy }, ...uniq.map((w) => ({ ...w, correct: false }))], r.id);
  const q = Question.safeParse({
    id: r.id, origin, parentId, subject: r.subject, topic: r.topic, concept: r.concept, template,
    params: { lock, decoys: d.params.decoys }, prompt: r.prompt, given: r.given, formula, answer, reaction, equation, titration, mystery,
    choices: ordered.map((c, i) => ({ id: "ABCD"[i], text: c.text, correct: c.correct, misconceptionId: c.misconceptionId, why: c.why })),
    flags: [...flags, ...(r.confidence < 0.6 ? ["low_confidence_read"] : [])],
  });
  return q.success ? { question: q.data, errors: [], flags, notes, added } : { errors: q.error.issues.map((i) => `${r.id}: ${i.path.join(".")} ${i.message}`), flags, notes };
}
