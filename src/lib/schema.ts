// src/lib/schema.ts — two layers: what each AI agent returns (drafts), and the final playable Question.
import { z } from "zod";

export const Topic = z.enum([
  "projectile_motion", "newtons_second_law", "free_fall", "kinematics", "energy",
  "reaction_prediction", "balancing_equations", "acid_base_ph", "stoichiometry",
  "other_physics", "other_chemistry",
]);
export const Template = z.enum(["projectile_launcher", "mix_lab", "equation_balancer", "answer_balloons", "titration_lab", "mystery_sample", "stoich_lab"]);
const Quantity = z.object({ value: z.number(), unit: z.string() });
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// ---------- AI-generated reaction (replaces the old hand-written reactions.json) ----------
export const Species = z.object({ formula: z.string(), name: z.string(), state: z.enum(["s", "l", "g", "aq"]) });
export const Reaction = z.object({
  reactants: z.array(Species).min(1).max(3),
  products: z.array(Species).min(1).max(4),
  equation: z.string(),                                   // balanced, with coefficients
  type: z.enum(["precipitation", "gas_evolution", "neutralization", "single_replacement", "decomposition", "combustion", "endothermic", "other"]),
  observation: z.string().max(120),                       // "A bright yellow solid forms"
  visual: z.object({
    bubbles: z.boolean(), colorFrom: Hex, colorTo: Hex,
    precipitateColor: Hex.nullable(), heat: z.enum(["exo", "endo", "none"]), flame: Hex.nullable(),
  }),
  hazard: z.string().max(100).nullable(),                 // "Lead compounds are toxic" — a warning, never a procedure
});

// ---------- Chemistry labs (added for the chemistry-only build; all optional, so older data stays valid) ----------
export const Indicator = z.enum(["phenolphthalein", "methyl_orange", "bromothymol_blue"]);
/** Reader draft for a titration question. Exactly one of analyte.molarity / endpointML is given on the page. */
export const TitrationDraft = z.object({
  analyte: z.object({ formula: z.string(), name: z.string(), volumeML: z.number(), molarity: z.number().nullable() }), // in the flask
  titrant: z.object({ formula: z.string(), name: z.string(), molarity: z.number() }),                                  // in the burette
  indicator: Indicator,
  endpointML: z.number().nullable(),                      // the measured end point, when the question asks for the analyte's molarity
});
/** Reader draft for an "identify the unknown" question: just the answer compound (formula or name, from code's table). */
export const MysteryDraft = z.object({ compound: z.string() });
/** Final Titration Lab data: every number below is computed by code (src/lib/acidBase.ts). */
export const TitrationLab = z.object({
  ask: z.enum(["endpoint_ml", "analyte_molarity"]),
  analyte: z.object({ formula: z.string(), name: z.string(), volumeML: z.number(), molarity: z.number() }),
  titrant: z.object({ formula: z.string(), name: z.string(), molarity: z.number() }),
  indicator: Indicator,
  indicatorInfo: z.object({ name: z.string(), low: z.number(), high: z.number(), acid: Hex, base: Hex, acidLabel: z.string(), baseLabel: z.string() }),
  equivalenceML: z.number(),
  startPH: z.number(), endPH: z.number(),                 // pH at 0 mL and at the end point
  curve: z.array(z.object({ ml: z.number(), pH: z.number() })).max(200),
});
/** Reader draft for a stoichiometry question (Reaction Yield Lab). */
export const StoichDraft = z.object({
  equation: z.string(),                                   // balanced
  known: z.object({ formula: z.string(), name: z.string(), massG: z.number() }), // the reactant the student weighs
  target: z.object({ formula: z.string(), name: z.string() }),
  ask: z.enum(["mass_g", "gas_volume_ml", "moles"]),
  gasMolarVolumeL: z.number().nullable(),                 // 22.4 / 22.7 / 24.0 / 24.5, only for gas volumes
});
/** Final Reaction Yield Lab data: every number below is computed by code (src/lib/stoich.ts). */
export const StoichLab = StoichDraft.extend({
  coefKnown: z.number(), coefTarget: z.number(),
  mmKnown: z.number(), mmTarget: z.number(),              // g/mol from the periodic table
  molesKnown: z.number(), molesTarget: z.number(),
  answer: z.number(),                                     // in the asked unit (g, mL or mol)
  targetIsGas: z.boolean(),
  gasVolumeML: z.number().nullable(),                     // for the gas syringe (at gasMolarVolumeL, or 24.0 L/mol if not given)
});
export const TestId = z.enum(["flame", "naoh", "agno3", "bacl2", "hcl"]);
/** Final Mystery Sample data: every observation and color comes from code (src/lib/ions.ts). */
export const MysteryLab = z.object({
  compound: z.object({ formula: z.string(), name: z.string() }),
  tests: z.array(z.object({
    test: TestId, label: z.string(), detail: z.string(),
    effect: z.enum(["flame", "precipitate", "bubbles", "none"]), color: Hex.nullable(), text: z.string(),
  })).length(5),
});

// ---------- Agent 1 (Reader+Solver, vision) draft ----------
export const ReadQuestion = z.object({
  id: z.string(),
  subject: z.enum(["physics", "chemistry"]),
  topic: Topic,
  concept: z.string().max(60),                            // short skill name, e.g. "range depends on sin 2θ"
  prompt: z.string(),
  given: z.record(z.string(), Quantity).default({}),
  unknown: z.string().nullable(),
  unit: z.string().nullable(),                            // unit of the answer
  formula: z.string().nullable(),                         // mathjs, keys from given only
  printedAnswer: z.string().nullable(),                   // what the page's answer key says, verbatim, if any
  printedChoices: z.array(z.string()).nullable(),         // if the page already has multiple choice
  answerText: z.string(),                                 // for non-numeric answers
  reaction: Reaction.nullable(),                          // chemistry "what happens" questions
  equation: z.string().nullable(),                        // balancing questions: the balanced answer
  titration: TitrationDraft.nullable().optional(),        // titration questions (Titration Lab)
  mystery: MysteryDraft.nullable().optional(),            // "identify the unknown" questions (Mystery Sample)
  stoich: StoichDraft.nullable().optional(),              // stoichiometry questions (Reaction Yield Lab)
  confidence: z.number().min(0).max(1),
});
export const ReadOut = z.object({ title: z.string(), questions: z.array(ReadQuestion).min(1).max(10) });

// ---------- Agent 2 (Mistake Modeler + Level Designer) draft ----------
export const Misconception = z.object({
  id: z.string().regex(/^[a-z0-9_]{3,40}$/), label: z.string().max(60), why: z.string().max(140), concept: z.string().max(60),
});
export const DesignQuestion = z.object({
  id: z.string(),
  template: Template,
  templateReason: z.string().max(100),
  params: z.object({                                      // template knobs the AI may set
    lock: z.enum(["speed", "angle", "none"]).optional(),  // launcher
    decoys: z.array(Species).max(2).optional(),           // mix lab
  }).default({}),
  misconceptions: z.array(Misconception).min(1).max(4),
  wrong: z.array(z.object({
    misconceptionId: z.string(),
    wrongFormula: z.string().nullable(),                  // numeric questions: code computes the value
    text: z.string().max(40).nullable(),                  // non-numeric questions: the wrong option text
    why: z.string().max(140),
  })).min(3).max(5),                                      // spares, in case code rejects one
  correctWhy: z.string().max(140),
});
export const DesignOut = z.object({ questions: z.array(DesignQuestion) });

// ---------- Final playable question (assembled by code, never by the model alone) ----------
const ChoiceBase = z.object({
  id: z.enum(["A", "B", "C", "D"]),
  text: z.string().max(40),
  correct: z.boolean(),
  misconceptionId: z.string().nullable(),
  why: z.string().max(160),
});
const QuestionBase = z.object({
  id: z.string(),
  origin: z.enum(["worksheet", "variant"]),               // variant = written by the Director mid-game
  parentId: z.string().nullable(),
  subject: z.enum(["physics", "chemistry"]),
  topic: Topic,
  concept: z.string(),
  template: Template,
  params: z.object({ lock: z.enum(["speed", "angle", "none"]).optional(), decoys: z.array(Species).optional() }).default({}),
  prompt: z.string(),
  given: z.record(z.string(), Quantity).default({}),
  formula: z.string().nullable(),
  answer: z.object({ value: z.number().nullable(), unit: z.string().nullable(), text: z.string() }),
  reaction: Reaction.nullable(),
  equation: z.string().nullable(),
  titration: TitrationLab.nullable().optional(),          // template "titration_lab"
  mystery: MysteryLab.nullable().optional(),              // template "mystery_sample"
  stoich: StoichLab.nullable().optional(),                // template "stoich_lab"
  choices: z.array(ChoiceBase).length(4),
  flags: z.array(z.string()).default([]),
});
export const Question = QuestionBase.superRefine((q, ctx) => {
  if (q.choices.filter((c) => c.correct).length !== 1) ctx.addIssue({ code: "custom", message: `${q.id}: needs exactly one correct choice` });
  for (const c of q.choices) if (c.correct !== (c.misconceptionId === null))
    ctx.addIssue({ code: "custom", message: `${q.id}/${c.id}: misconceptionId must be null iff correct` });
  if (new Set(q.choices.map((c) => c.text)).size !== 4) ctx.addIssue({ code: "custom", message: `${q.id}: duplicate choice text` });
});
export const Worksheet = z.object({
  id: z.string(), title: z.string(), source: z.enum(["upload", "generated"]),
  imageHash: z.string().nullable(),
  questions: z.array(Question).min(1).max(10),
  misconceptions: z.array(Misconception),                 // the worksheet's registry; variants reuse these ids
  createdAt: z.string(),
});
export type TQuestion = z.infer<typeof Question>;
export type TTitrationLab = z.infer<typeof TitrationLab>;
export type TMysteryLab = z.infer<typeof MysteryLab>;
export type TStoichLab = z.infer<typeof StoichLab>;
export type TWorksheet = z.infer<typeof Worksheet>;

// ---------- Runtime records (server sets createdAt: new Date() on insert; never trust the client clock) ----------
export const Attempt = z.object({
  classCode: z.string().length(4),
  sessionId: z.string(),
  worksheetId: z.string(),
  questionId: z.string(),
  questionOrigin: z.enum(["worksheet", "variant"]),
  chosen: z.enum(["A", "B", "C", "D", "X"]),            // "X" = Balancer answer matching no listed choice
  chosenText: z.string().max(60),                       // stored so the phone never has to join by letter
  correct: z.boolean(),
  misconceptionId: z.string().nullable(),
  msToAnswer: z.number().int().nonnegative(),
  input: z.enum(["gesture", "keyboard", "mouse"]),
  hoverTrace: z.array(z.object({ choice: z.enum(["A", "B", "C", "D"]), ms: z.number().int() })).max(20).default([]),
  experiments: z.array(z.object({ thetaDeg: z.number(), speed: z.number(), landedM: z.number() })).max(5).default([]),
  mixTries: z.array(z.tuple([z.string(), z.string()])).max(4).default([]),
  balancerSteps: z.array(z.array(z.number().int())).max(30).default([]),
  titrationLog: z.object({                                // Titration Lab: what the student actually did (optional, additive)
    finalReadingML: z.number(), drops: z.number().int().nonnegative(), overshootML: z.number(),
  }).nullable().optional(),
  testsUsed: z.array(TestId).max(10).optional(),          // Mystery Sample: tests run, in order (optional, additive)
  simulated: z.boolean().default(false),
});
export const NewSession = z.object({
  classCode: z.string().length(4), worksheetId: z.string(), nickname: z.string().min(1).max(16),
  mode: z.enum(["seated", "standing"]).default("seated"), timeBudgetSec: z.number().int().min(60).max(3600).default(600),
});
export type TAttempt = z.infer<typeof Attempt>;
