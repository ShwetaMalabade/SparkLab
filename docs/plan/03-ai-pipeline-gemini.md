# 03 · AI Agents + Verification (AI writes, code checks)
**Owner:** C (AI/Backend) · **Prompts:** D writes and tests them in AI Studio first · **Depends on:** 02

Every code block in this file was type-checked (`tsc --strict`) and run against tests on Sat Nov 14 (see `09 §2`). Copy them as they are.

---

## 1. The agents at a glance

| # | Agent | Input | Output (schema) | Then code does | Calls | Target time |
|---|---|---|---|---|---|---|
| 1 | Reader-Solver | Photo (JPEG) | `ReadOut` | lint + compute formulas, check reactions and equations, compare with printed key | 1 per scan | 5–10 s |
| 2 | Mistake Modeler + Level Designer | `ReadOut` + registry | `DesignOut` | compute each wrong value, reject near-duplicates, gate templates, shuffle choices, assemble `Question` | 1 per scan | 4–8 s |
| — | Repair (agent 1 or 2 again) | failing questions + code's error list | same schema | re-verify | 0–2 | +4 s each |
| 3 | Critic | assembled worksheet | `CriticOut` | `block` → hide question; `warn` → ⚠️ on Review | 1, background | 3–6 s |
| 4 | Director (coach) | session context + last attempt traces | `DirectorOut` | enforce limits; verify any new question with the same code; fallback at 6 s | 1 per answer | ≤ 5.5 s |
| 5 | Classmate Simulator | worksheet | `ClassmatesOut` | look up correct/misconception per choice, write simulated attempts | 1 per class | 5–10 s |
| 6 | Teacher Insight | computed stats | `InsightOut` | reject any number not in the stats | ≤ 1 per 20 s | 2–4 s |
| 7 | Warm-up Writer | top mistakes + sample questions | `ReadOut` | → Agent 2 → assemble, like a scan | 1 per tap | 8–15 s |

**Call budget for one 2-minute demo:** scan 2–4 (vision 1) · critic 1 · classmates 1 · coach ~4 · insights ~3 · warm-up 2 ≈ **13–15 calls**, of which only 1–2 use the vision model. At ~20 demos on judging day: ~300 calls. **Check the real quota on Saturday morning (`12` K2).**

**Scan latency:** Agent 1 + Agent 2 run in sequence (≈ 10–18 s). The Review screen opens as soon as Agent 2's output passes code; the Critic and the Classmates run in the background while the student reviews and calibrates. If Agent 1 takes > 45 s, abort and offer "Use last scan".

## 2. Browser resize (before upload)

```ts
// src/lib/resizeImage.ts
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s));
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.convertToBlob({ type: "image/jpeg", quality });      // typically 300–600 KB; server cap 1.5 MB
}
```
- HEIC (iPhone) fails in Chrome → "Please send a JPG/PNG (iPhone: Settings → Camera → Formats → Most Compatible)" + offer the webcam snapshot.
- PDF: MVP = ask for a screenshot.
- The server hashes the JPEG (`imageHash`) and stores it on the worksheet.

## 3. The wrapper every agent uses (`src/lib/ai.ts`)

Provider switch, per-agent model and temperature, timeout, one retry on 429 (not for the coach, which has a 6 s budget), Zod check, logging of **every** call to `aiCalls` (this powers the AI trace drawer and the replay file), and replay in offline mode.

```ts
// src/lib/ai.ts — the ONE wrapper every agent goes through.
import { createHash } from "node:crypto";
import type { ZodType } from "zod";
import { GoogleGenAI } from "@google/genai";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { db } from "./db";
import { replayLookup } from "./replay";

export type Agent = "reader" | "designer" | "critic" | "director" | "classmates" | "insight" | "warmup";
const TEMP: Record<Agent, number> = { reader: 0, designer: 0.2, critic: 0, director: 0.4, classmates: 0.9, insight: 0.2, warmup: 0.7 };
const TIMEOUT: Record<Agent, number> = { reader: 30000, designer: 20000, critic: 20000, director: 5500, classmates: 20000, insight: 10000, warmup: 25000 };

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const modelFor = (a: Agent) => process.env.AI_PROVIDER === "bedrock"
  ? (a === "reader" ? process.env.BEDROCK_MODEL_VISION : process.env.BEDROCK_MODEL_FAST)!
  : (a === "reader" ? process.env.GEMINI_MODEL_VISION : process.env.GEMINI_MODEL_FAST)!;

async function callGemini(model: string, prompt: string, temperature: number, image?: Uint8Array) {
  const parts: any[] = [];
  if (image) parts.push({ inlineData: { mimeType: "image/jpeg", data: Buffer.from(image).toString("base64") } });
  parts.push({ text: prompt });
  const res = await gemini.models.generateContent({
    model, contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json", temperature },
  });
  return res.text ?? "";
}

async function callBedrock(model: string, prompt: string, temperature: number, image?: Uint8Array) {
  const content: any[] = [];
  if (image) content.push({ image: { format: "jpeg", source: { bytes: image } } });
  content.push({ text: prompt + "\nReturn ONLY JSON." });
  const res = await bedrock.send(new ConverseCommand({
    modelId: model, messages: [{ role: "user", content }],
    inferenceConfig: { maxTokens: 6000, temperature },
  }));
  return res.output?.message?.content?.map((c: any) => ("text" in c ? c.text : "")).join("") ?? "";
}

export function extractJson(s: string) {
  const cleaned = s.replace(/`{3}(json)?/g, "").trim();   // strip markdown fences
  const a = cleaned.search(/[[{]/), b = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(a, b + 1));
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms} ms`)), ms))]);

export type AskResult<T> = { ok: true; data: T; ms: number; cached: boolean } | { ok: false; error: string; issues: string[]; raw?: string; ms: number };

export async function askJSON<T>(agent: Agent, schema: ZodType<T>, prompt: string,
  opts: { image?: Uint8Array; ctx?: { classCode?: string; sessionId?: string; reason?: string } } = {}): Promise<AskResult<T>> {
  const model = modelFor(agent);
  const inputHash = createHash("sha256").update(agent + model + prompt)
    .update(opts.image ? Buffer.from(opts.image) : Buffer.alloc(0)).digest("hex").slice(0, 32);
  const t0 = Date.now();

  if (process.env.OFFLINE === "1") {                       // replay of recorded real outputs
    const hit = replayLookup(agent, inputHash);
    if (!hit) return { ok: false, error: "no recorded output", issues: [], ms: 0 };
    const p = schema.safeParse(hit);
    return p.success ? { ok: true, data: p.data, ms: 0, cached: true } : { ok: false, error: "replay schema", issues: [], ms: 0 };
  }

  let raw = ""; let error = ""; let issues: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const call = process.env.AI_PROVIDER === "bedrock" ? callBedrock : callGemini;
      raw = await withTimeout(call(model, prompt, TEMP[agent], opts.image), TIMEOUT[agent]);
      error = ""; break;
    } catch (e: any) {
      error = String(e?.message ?? e);
      const is429 = e?.status === 429 || /429|RESOURCE_EXHAUSTED|Throttling/i.test(error);
      if (is429 && attempt === 0 && agent !== "director") { await new Promise((r) => setTimeout(r, 2000)); continue; }
      break;
    }
  }
  let data: T | undefined;
  if (!error) {
    try {
      const p = schema.safeParse(extractJson(raw));
      if (p.success) data = p.data; else { error = "schema"; issues = p.error.issues.slice(0, 12).map((i) => `${i.path.join(".")}: ${i.message}`); }
    } catch { error = "not JSON"; }
  }
  const ms = Date.now() - t0;
  await db.log({ agent, model, inputHash, ms, ok: !error, error: error || null, outputJson: data ?? null,
    classCode: opts.ctx?.classCode ?? null, sessionId: opts.ctx?.sessionId ?? null, reason: opts.ctx?.reason ?? null }).catch(() => {});
  return data !== undefined ? { ok: true, data, ms, cached: false } : { ok: false, error, issues, raw: raw.slice(0, 4000), ms };
}
```

```ts
// src/lib/replay.ts — offline mode: recorded real outputs, keyed by agent + input hash
import fs from "node:fs"; import path from "node:path";
let cache: Record<string, unknown> | null = null;
export function replayLookup(agent: string, inputHash: string): unknown | null {
  if (!cache) { try { cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/replay/aiCalls.json"), "utf8")); } catch { cache = {}; } }
  return (cache as Record<string, unknown>)[`${agent}:${inputHash}`] ?? null;
}
```
`db.log(...)` inserts into `aiCalls` with `createdAt: new Date()` (02 §6.3).

**Smoke test (person C, first 30 min):** `scripts/test-ai.ts` calls `askJSON("insight", z.object({ok: z.boolean()}), 'Return {"ok":true}')` and prints it. Run: `npx tsx --env-file=.env.local scripts/test-ai.ts`.

## 4. Prompts (`src/lib/prompts.ts`)

D drafts and tests these in AI Studio with 3 real worksheet photos before C wires them. Keep the JSON field names exactly as the schemas in `02 §6.1`.

```ts
const TOPICS = `["projectile_motion","newtons_second_law","free_fall","kinematics","energy","reaction_prediction","balancing_equations","acid_base_ph","stoichiometry","other_physics","other_chemistry"]`;
const SAFETY = `Never write real-world lab instructions, amounts or procedures. Dangers appear only as a short "hazard" warning.`;

export const READER_PROMPT = () => `
You are Agent 1, Reader-Solver. Turn this photo of a high-school PHYSICS or CHEMISTRY worksheet into data, and solve each question.
Return ONLY JSON: {"title": string, "questions": [ ... ]}. Each question:
{ "id": "q1", "q2", ... in page order,
  "subject": "physics"|"chemistry", "topic": one of ${TOPICS},
  "concept": the skill tested, ≤ 60 chars (e.g. "range depends on sin 2θ"),
  "prompt": clean question text,
  "given": {"<symbol>": {"value": number, "unit": string}},
  "unknown": string|null, "unit": unit of the answer or null,
  "formula": a mathjs expression for the answer using ONLY keys in "given" (null if not numeric),
  "printedAnswer": the answer exactly as printed in any answer key on the page, else null,
  "printedChoices": the page's own multiple-choice options, else null,
  "answerText": the correct answer in ≤ 40 chars for non-numeric questions, "" for numeric ones,
  "reaction": for "what happens when A and B are mixed" questions: {"reactants":[{"formula","name","state"}],
     "products":[{"formula","name","state"}], "equation": balanced with the smallest whole numbers,
     "type": "precipitation"|"gas_evolution"|"neutralization"|"single_replacement"|"decomposition"|"combustion"|"endothermic"|"other",
     "observation": what you would see, ≤ 120 chars,
     "visual": {"bubbles": bool, "colorFrom": "#RRGGBB", "colorTo": "#RRGGBB", "precipitateColor": "#RRGGBB"|null, "heat": "exo"|"endo"|"none", "flame": "#RRGGBB"|null},
     "hazard": string|null}; otherwise null,
  "equation": for balancing questions, the balanced equation; otherwise null,
  "confidence": 0–1, how sure you are that you read the page correctly }
Rules:
- Max 10 questions. Skip anything that is not physics or chemistry.
- Use these symbols when they apply: v (launch speed, m/s), theta (launch angle, deg), g, h (height, m), m (mass, kg), F (force, N), mu (friction coefficient), t (time, s).
- If gravity matters, add "g": {"value": 9.81, "unit": "m/s^2"} to "given".
- Angles stay in degrees in "given". Inside sin/cos/tan ALWAYS write theta*pi/180.
- Write the formula; do NOT put the final number in "formula". Code computes it.
- Chemical formulas as plain text: "Pb(NO3)2", "Ba(OH)2·8H2O". No charges. States: s, l, g, aq.
- If a value is unreadable, make your best guess, put it in [brackets] in "prompt", and lower "confidence".
- ${SAFETY}`;

export const DESIGNER_PROMPT = (questionsJson: string, registryJson: string) => `
You are Agent 2, Mistake Modeler and Level Designer for a 3D physics/chemistry game played with hand gestures.
For EACH question, return:
{ "id",
  "template": "projectile_launcher"|"mix_lab"|"equation_balancer"|"answer_balloons", "templateReason": ≤ 100 chars,
  "params": {"lock": "speed"|"angle"|"none" (launcher only: the fixed control, so the student explores the other one),
             "decoys": up to 2 extra chemicals for the Mix Lab bench, as {"formula","name","state"}},
  "misconceptions": 1–4 mistakes real students make on THIS question: {"id": snake_case, "label": ≤ 60 chars, "why": ≤ 140 chars, "concept"},
  "wrong": 4–5 wrong options, each tied to one misconception id:
      numeric question → "wrongFormula": the mathjs formula a student WITH THAT MISTAKE would use (same "given" keys), "text": null. Code computes the value.
      other question   → "wrongFormula": null, "text": the wrong option, ≤ 40 chars.
      "why": one kid-friendly sentence on what went wrong, ≤ 140 chars,
  "correctWhy": one sentence explaining the right answer, ≤ 140 chars }
Return ONLY JSON: {"questions": [ ... ]}.
Rules:
- Reuse ids from this registry when the mistake is the same: ${registryJson}
- Each wrong formula must model one real, specific mistake and give a value more than 5% away from the right answer and from the other wrong ones.
  Watch special angles: at 30° and 60°, sin θ and sin 2θ tricks can give the same number. Give a 5th spare option in case code rejects one.
- Template guide: projectile question with v or theta → projectile_launcher; "what happens when you mix" with exactly 2 reactants → mix_lab;
  balancing with ≤ 4 species → equation_balancer; anything else → answer_balloons.
- Decoys: common, safe classroom chemicals that do not react with either reactant.
- ${SAFETY}
Questions: ${questionsJson}`;

export const CRITIC_PROMPT = (worksheetJson: string) => `
You are Agent 3, a strict high-school science teacher reviewing a game built from a worksheet.
Code has already checked every number and atom count. Do NOT redo arithmetic. Check:
(1) chemistry observations and colors are true, (2) exactly one option is correct and the others are clearly wrong,
(3) every "why" is true and kid-friendly, (4) the question text is clear, (5) nothing gives real-world dangerous instructions.
Return ONLY JSON {"issues": [{"questionId", "severity": "block"|"warn", "message": ≤ 140 chars}]}.
Use "block" only for a false science claim, two correct options, or a safety problem. Return an empty list if all is good.
Worksheet: ${worksheetJson}`;

export const DIRECTOR_PROMPT = (ctxJson: string) => `
You are Agent 4, an expert physics and chemistry coach inside a game the student plays with hand gestures.
After each answer you decide what the student does next, to fix their mistakes as fast as possible within the session time.
You get: the worksheet (ids, concepts, templates, which are played), the mistake registry, the student model, raw counts,
the time left, and the LAST ATTEMPT with behavior traces:
- hoverTrace: options their hand rested on before choosing, with ms (a long hover on the right answer, then a wrong pick = unsure, not ignorant)
- experiments: launcher shots (angle, speed, landing distance); mixTries: beaker pairs tried; balancerSteps: coefficient sequences; msToAnswer.
Choose ONE action:
- "next": an unplayed worksheet question (set nextQuestionId). Prefer one that tests a weak concept, or a different template for variety.
- "variant": a NEW question on the SAME concept with NEW numbers or substances, aimed at targetMisconceptionId.
   Put it in "newQuestion" as {"read": <Agent 1 question format>, "design": <Agent 2 question format>}.
   Choose numbers where every listed mistake gives a clearly different value (avoid 30°/60° and 45° for range questions).
- "probe": a NEW quick question on a related concept, to find out WHY they are stuck (same "newQuestion" format).
- "finish": only when everything is played or time is nearly up.
Also return:
- "feedback": ONE spoken sentence (≤ 25 words) about what THIS student did, citing their own trace when it helps
  (e.g. "You tried 30° and 60° and they landed together. That's sin 2θ at work."). Warm and specific.
- "reason": ≤ 160 chars for the teacher: what you saw and why you chose this action.
- "studentModel": {"concepts": {"<concept>": {"mastery": 0–1, "evidence": ≤ 80 chars}}, "notes": ≤ 200 chars}.
- "newMisconceptions": [] unless the student showed a mistake that is not in the registry.
Rules: at most one variant in a row; never repeat a question; ${SAFETY}
Return ONLY JSON: {"action","nextQuestionId","targetMisconceptionId","newQuestion","newMisconceptions","feedback","reason","studentModel"}.
Context: ${ctxJson}`;

export const CLASSMATES_PROMPT = (worksheetJson: string) => `
You are Agent 5. Simulate 4 different, realistic high-school students taking this worksheet, for a teacher-dashboard demo.
Give each a different profile (e.g. strong but rushes; mixes up sin θ and sin 2θ; good at chemistry, weak at physics; careful but slow).
Their answers must follow from their profile: a student who holds a mistake picks the option tagged with it.
Return ONLY JSON {"students": [{"nickname": first name ≤ 16 chars, "profile": ≤ 100 chars,
  "answers": [{"questionId", "choice": "A"|"B"|"C"|"D", "ms": 3000–30000}]}]}: exactly 4 students, each answering every question.
Worksheet (ids, prompts, choices with misconception ids): ${worksheetJson}`;

export const INSIGHT_PROMPT = (statsJson: string) => `
You are Agent 6, writing for a busy high-school science teacher watching the class live.
Use ONLY numbers that appear in these computed stats. Never invent or estimate a number; code rejects any number not in the stats.
Return ONLY JSON {"bullets": [3 strings ≤ 25 words: (1) what the class does well, (2) the top mistake with its exact count,
  (3) the most useful pattern in the coach's decisions or the behavior traces],
  "groups": [{"name": ≤ 30 chars, "students": [nicknames], "mistake": label}] (students who share a mistake, max 3),
  "nextMove": one concrete thing to do in tomorrow's first 5 minutes, ≤ 30 words}.
Stats: ${statsJson}`;

export const WARMUP_PROMPT = (mistakesJson: string, styleJson: string) => `
You are Agent 7. Write tomorrow's 4-question warm-up for a high-school class.
Target these mistakes, most common first: ${mistakesJson}
Match the level and style of these questions from today's worksheet: ${styleJson}
Each question must directly test one target mistake, with new numbers or substances.
Return ONLY JSON in the Agent 1 format {"title", "questions": [...]}, with printedAnswer null, printedChoices null, confidence 1.
Same rules as Agent 1 for symbols, formulas, reactions and safety.`;

export const REPAIR_PROMPT = (badJson: string, errors: string[]) => `
Code checked your previous JSON and found these problems:
${errors.map((e) => "- " + e).join("\n")}
Fix ONLY these problems. Return the full corrected JSON in exactly the same format.
Previous JSON: ${badJson}`;
```

## 5. Scan flow (`src/lib/ingest.ts`, called by `/api/ingest`)

The route streams one NDJSON line per step (`{step, status:"run"|"ok"|"warn"|"fail", ms, detail}`), so the Scan screen shows the **real** agent steps live, then the final `{worksheet}` line.

```
step "photo"    : read file (reject > 1.5 MB or not an image), hash it
step "reader"   : r1 = askJSON("reader", ReadOut, READER_PROMPT(), {image})
                  if !ok and issues → one repair: askJSON("reader", ReadOut, REPAIR_PROMPT(raw, issues), {image})
step "designer" : d = askJSON("designer", DesignOut, DESIGNER_PROMPT(JSON(r1.questions), JSON(registry=[])))
step "verify"   : for each question: out = assemble(read[i], design[i])      // §6 — code computes every value
                  detail = "Checking answers with code ✓ (n checked, k answer-key mismatches)"
step "repair"   : failing = questions with out.errors (max 2 rounds, failing questions only):
                    reader-level errors (formula, equation, reaction)  → REPAIR to Agent 1 (text only, with its draft)
                    designer-level errors (wrong options, ids, spares) → REPAIR to Agent 2
                  still failing → drop with note "dropped: <reason>" for the Review screen
step "save"     : worksheet {source:"upload", imageHash, questions, misconceptions: union of all design misconceptions}
                  link class: classes.update({_id: classCode}, {worksheetId})
                  background (don't await): POST /api/ingest/critic, POST /api/class/[code]/simulate
if 0 questions survive → 422 "Couldn't read this worksheet. Try a sharper photo, or use the last scan."
```
**Answer-key check:** if the page printed an answer and code's value differs by > 2%, the flag `answer_key_mismatch:34->35.3` is added and Review shows "Answer key says 34.0 m. Code computes 35.3 m. Using 35.3 m." The AI's own number is never trusted over code.

**Critic result:** `block` → question marked hidden (`flags: ["critic_block: …"]`, GameRunner skips it); `warn` → ⚠️ with the message on Review. If the Critic fails or times out, nothing changes.

## 6. Assembly: code turns drafts into a verified question (`src/lib/assemble.ts`)

Numeric questions: code computes the correct value and every wrong value from the AI's formulas, writes all choice texts, flags answer-key mismatches, and drops wrong options that are invalid or within 5% of another (spares fill in). Balancing: code checks the answer is balanced and simplest, and drops "wrong" options that are actually balanced. Reactions: `checkReaction` (balance, species match, solubility rules, gas ↔ bubbles, heavy-metal hazard note). Templates: code gates what the 3D scene can honestly simulate. Choice order: deterministic shuffle by question id (so replays match).

```ts
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
```

## 7. Physics verification (`src/lib/verifyPhysics.ts`)

The lint parses with mathjs, so it accepts every correct way to write a formula (`sin(pi/180*2*theta)`, `sin((2*theta)*pi/180)`) and rejects unknown symbols, broken parentheses, and trig on degree values without `pi`. **No auto-correct of the AI's formula:** a bad main formula goes to repair, never gets "fixed" into a wrong number.

```ts
// src/lib/verifyPhysics.ts — the AI writes formulas; this code computes every number.
import { parse, evaluate } from "mathjs";

type Given = Record<string, { value: number; unit: string }>;
const ALLOWED = new Set(["pi", "e", "sin", "cos", "tan", "asin", "acos", "atan", "sqrt", "abs", "log", "exp", "min", "max"]);

/** Clean the formula, then check it. Returns the cleaned formula or an error the repair loop can send back. */
export function lintFormula(raw: string, given: Given): { formula: string; error: string | null } {
  const formula = raw.replace(/\*\*/g, "^").replace(/θ/g, "theta").replace(/μ/g, "mu")
    .replace(/×|·/g, "*").replace(/÷/g, "/").replace(/√\(/g, "sqrt(");
  let node;
  try { node = parse(formula); } catch (e) { return { formula, error: `formula "${formula}" doesn't parse: ${(e as Error).message}` }; }
  const unknown = new Set<string>();
  node.traverse((n: any) => { if (n.isSymbolNode && !ALLOWED.has(n.name) && !(n.name in given)) unknown.add(n.name); });
  if (unknown.size) return { formula, error: `formula uses ${[...unknown].join(", ")}, which are not in "given"` };
  // Check EACH sin/cos/tan call: if its argument uses a degree value, that same argument must contain pi.
  // (A "pi" elsewhere in the formula must not hide sin(2*theta).)
  const degKeys = new Set(Object.entries(given).filter(([, v]) => /deg|°/i.test(v.unit)).map(([k]) => k));
  let degBug = false;
  node.traverse((n: any) => {
    if (!n.isFunctionNode || !["sin", "cos", "tan"].includes(n.fn?.name)) return;
    const syms = new Set<string>();
    n.args.forEach((a: any) => a.traverse((m: any) => { if (m.isSymbolNode) syms.add(m.name); }));
    if ([...syms].some((s) => degKeys.has(s)) && !syms.has("pi")) degBug = true;
  });
  if (degBug) return { formula, error: `angle is in degrees; convert with *pi/180 inside sin/cos/tan` };
  return { formula, error: null };
}

export function compute(formula: string, given: Given): number {
  const scope: Record<string, number> = {};
  for (const [k, v] of Object.entries(given)) scope[k] = v.value;
  return Number(evaluate(formula, scope));
}

/** 3 significant figures; ≥ 1000 shown as a whole number (999.7 → "1000", never "1.00e+3"). Tiny values use ×10^n, never "e-7". */
export function fmt(x: number, unit: string | null) {
  const p = Number(x.toPrecision(3));
  let s: string;
  if (Math.abs(x) >= 999.5) s = String(Math.round(x));                       // 999.7 -> "1000", 1234.5 -> "1235"
  else if (p !== 0 && Math.abs(p) < 0.001) { const [m, e] = p.toExponential(2).split("e"); s = `${m}×10^${Number(e)}`; }
  else s = p.toPrecision(3);
  return unit ? `${s} ${unit}` : s;
}

export const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));

/**
 * Verify one numeric question. The AI supplied: the correct formula, and one WRONG formula per distractor
 * (each one models a named mistake). Code computes every value and writes every choice text.
 */
export function buildNumericChoices(q: {
  id: string; given: Given; unit: string | null; formula: string; printedKey: number | null;
  wrong: { misconceptionId: string; wrongFormula: string }[];
}) {
  const errors: string[] = []; const flags: string[] = [];
  const main = lintFormula(q.formula, q.given);
  if (main.error) return { errors: [`${q.id}: ${main.error}`], flags };
  let correct: number;
  try { correct = compute(main.formula, q.given); } catch (e) { return { errors: [`${q.id}: formula failed: ${(e as Error).message}`], flags }; }
  if (!Number.isFinite(correct) || correct <= 0) return { errors: [`${q.id}: formula gives ${correct}; expected a positive magnitude`], flags };
  if (q.printedKey != null && relDiff(q.printedKey, correct) > 0.02) flags.push(`answer_key_mismatch:${q.printedKey}->${fmt(correct, null)}`);

  const values = [correct];
  const wrongOut: { misconceptionId: string; value: number; text: string }[] = [];
  for (const w of q.wrong) {
    const l = lintFormula(w.wrongFormula, q.given);
    if (l.error) { errors.push(`${q.id}/${w.misconceptionId}: ${l.error}`); continue; }
    let v: number;
    try { v = compute(l.formula, q.given); } catch { errors.push(`${q.id}/${w.misconceptionId}: wrong formula failed`); continue; }
    if (!Number.isFinite(v) || v <= 0) { errors.push(`${q.id}/${w.misconceptionId}: wrong value ${v} is not a positive number`); continue; }
    if (values.some((x) => relDiff(v, x) < 0.05)) { errors.push(`${q.id}/${w.misconceptionId}: wrong value ${fmt(v, null)} is within 5% of another choice; model a different mistake`); continue; }
    values.push(v); wrongOut.push({ misconceptionId: w.misconceptionId, value: v, text: fmt(v, q.unit) });
  }
  if (wrongOut.length < 3) errors.push(`${q.id}: need 3 valid wrong formulas, have ${wrongOut.length}`);
  return { errors, flags, formula: main.formula, correct: { value: correct, text: fmt(correct, q.unit) }, wrong: wrongOut.slice(0, 3) };
}
```

## 8. Chemistry verification (`src/lib/chem.ts`)

No reaction content lives in code. The solubility rules exist only to check the AI's claims ("PbI₂ is a precipitate": rules say insoluble ✓; "KNO₃ is a precipitate": rules say soluble → error back to the AI).

```ts
// src/lib/chem.ts — verification only. No reaction content lives here.
type Counts = Record<string, number>;
const add = (a: Counts, b: Counts, m = 1) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] ?? 0) + v * m; return a; };

const SUB = "₀₁₂₃₄₅₆₇₈₉";
/** Run on EVERY formula and equation before any other chem function (they also call it themselves). */
export const normalizeChem = (s: string) => s
  .replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)))     // H₂O -> H2O
  .replace(/[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")                        // drop superscript charges
  .replace(/[•∙*]/g, "·")                                  // hydrate dots
  .replace(/\((s|l|g|aq)\)/g, "")                          // drop states
  .replace(/\s*(<=>|<->|⇌|⇄|=>|-->|⟶|→|->|=)\s*/g, " -> ") // every arrow -> " -> "
  .replace(/\s+/g, " ").trim();

export function parseFormula(raw: string): Counts {
  const f = normalizeChem(raw).replace(/\s/g, "");
  return f.split(/[·.]/).filter(Boolean).reduce((acc, part) => {
    const m = part.match(/^(\d+)(.*)$/);
    return add(acc, parseGroup(m ? m[2] : part), m ? parseInt(m[1]) : 1);
  }, {} as Counts);
}

function parseGroup(f: string): Counts {
  const stack: Counts[] = [{}]; let i = 0;
  const readNum = () => { let n = ""; while (i < f.length && /\d/.test(f[i])) n += f[i++]; return n ? parseInt(n) : 1; };
  while (i < f.length) {
    const ch = f[i];
    if (ch === "(" || ch === "[") { stack.push({}); i++; }
    else if (ch === ")" || ch === "]") { i++; const mult = readNum(); const top = stack.pop() ?? {}; add(stack[stack.length - 1] ?? (stack[0] = {}), top, mult); }
    else if (/[A-Z]/.test(ch)) { let el = ch; i++; while (i < f.length && /[a-z]/.test(f[i])) el += f[i++]; add(stack[stack.length - 1], { [el]: readNum() }); }
    else i++;
  }
  return stack[0];
}

export type Term = { coef: number; formula: string };
export function splitEquation(eq: string): { left: Term[]; right: Term[] } | null {
  const parts = normalizeChem(eq).split(" -> ");
  if (parts.length !== 2) return null;                     // never crash on odd arrows
  const terms = (s: string) => s.split(" + ").map((t) => t.trim()).filter(Boolean).map((t) => {
    const m = t.match(/^(\d+)\s*(.*)$/);
    return { coef: m ? parseInt(m[1]) : 1, formula: m ? m[2] : t };
  });
  return { left: terms(parts[0]), right: terms(parts[1]) };
}

const sideCounts = (ts: Term[]) => ts.reduce((acc, t) => add(acc, parseFormula(t.formula), t.coef), {} as Counts);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function isBalanced(eq: string) {
  const s = splitEquation(eq);
  if (!s || !s.left.length || !s.right.length) return { balanced: false, minimal: false, diff: {}, error: `can't read equation "${eq}"` };
  const L = sideCounts(s.left), R = sideCounts(s.right);
  const diff: Record<string, [number, number]> = {};
  for (const e of new Set([...Object.keys(L), ...Object.keys(R)]))
    if ((L[e] ?? 0) !== (R[e] ?? 0)) diff[e] = [L[e] ?? 0, R[e] ?? 0];
  const g = [...s.left, ...s.right].map((t) => t.coef).reduce(gcd);
  return { balanced: Object.keys(diff).length === 0, minimal: g === 1, diff, error: null as string | null };
}

export function withCoefficients(left: string[], right: string[], lc: number[], rc: number[]) {
  const side = (fs: string[], cs: number[]) => fs.map((f, i) => (cs[i] === 1 ? f : `${cs[i]}${f}`)).join(" + ");
  return `${side(left, lc)} -> ${side(right, rc)}`;
}

/** Same species, same order? (Balancer subscript trap: H2O -> H2O2 is balanced but a different chemical.) */
export function sameSpecies(a: string, b: string) {
  const A = splitEquation(a), B = splitEquation(b);
  if (!A || !B) return false;
  const key = (ts: Term[]) => ts.map((t) => t.formula).join("|");
  return key(A.left) === key(B.left) && key(A.right) === key(B.right);
}

// ---- Solubility rules: used ONLY to check the AI's "a precipitate forms" claims ----
const ALKALI = /^(Li|Na|K|Rb|Cs)/;
export function solubility(raw: string): "soluble" | "insoluble" | "unknown" {
  const f = normalizeChem(raw);
  const cat = f.startsWith("NH4") ? "NH4" : (f.match(/^[A-Z][a-z]?/)?.[0] ?? "");
  if (ALKALI.test(f) || cat === "NH4" || /NO3|CH3COO|ClO3|ClO4/.test(f)) return "soluble";
  if (/(Cl|Br|I)\d*$/.test(f) && !/O/.test(f)) return ["Ag", "Pb", "Hg"].includes(cat) ? "insoluble" : "soluble";
  if (/SO4/.test(f)) return ["Ba", "Pb", "Sr", "Ca", "Ag"].includes(cat) ? "insoluble" : "soluble";
  if (/\(OH\)\d*$|OH$/.test(f)) return ["Ba", "Sr"].includes(cat) ? "soluble" : "insoluble";
  if (/CO3|PO4|SO3|CrO4/.test(f) || /^[A-Z][a-z]?\d*S$/.test(f)) return "insoluble";
  return "unknown";
}
```

## 9. The coach (`src/lib/agents/director.ts` + `/api/next`)

```ts
// src/lib/agents/director.ts — Agent 4, the AI coach. Decides the next step after every answer.
import { z } from "zod";
import { ReadQuestion, DesignQuestion, Misconception, type TQuestion, type TWorksheet, type TAttempt } from "../schema";
import { assemble } from "../assemble";

export const StudentModel = z.object({
  concepts: z.record(z.string(), z.object({ mastery: z.number().min(0).max(1), evidence: z.string().max(80) })),
  notes: z.string().max(200),
});
export const DirectorOut = z.object({
  action: z.enum(["next", "variant", "probe", "finish"]),
  nextQuestionId: z.string().nullable(),
  targetMisconceptionId: z.string().nullable(),
  newQuestion: z.object({ read: ReadQuestion, design: DesignQuestion }).nullable(),
  newMisconceptions: z.array(Misconception).max(2).default([]),   // only if the student showed a mistake not in the registry
  feedback: z.string().max(160),                                  // spoken to the student, ≤ 25 words
  reason: z.string().max(160),                                    // shown in the AI trace + teacher phone
  studentModel: StudentModel,
});
export type TDirectorOut = z.infer<typeof DirectorOut>;

export type Session = { id: string; played: string[]; variants: { id: string; target: string | null }[]; startedAt: number; timeBudgetSec: number };
export type NextStep = { action: "play" | "finish"; question?: TQuestion; feedback: string | null; reason: string; source: "coach" | "fallback"; rejected?: string[] };

/** Code fallback: the next unplayed worksheet question, else finish. Used on timeout, error or an invalid choice. */
export function fallbackNext(ws: TWorksheet, s: Session, why: string): NextStep {
  const q = ws.questions.find((x) => x.origin === "worksheet" && !s.played.includes(x.id));
  return q ? { action: "play", question: q, feedback: null, reason: `fallback: ${why}`, source: "fallback" }
           : { action: "finish", feedback: null, reason: `fallback: ${why}; all questions played`, source: "fallback" };
}

/** Apply the coach's decision with hard limits. The coach proposes; code decides what is allowed. */
export function applyDirector(ws: TWorksheet, s: Session, last: TAttempt, out: TDirectorOut, now = Date.now()): NextStep {
  const elapsed = (now - s.startedAt) / 1000;
  const unplayed = ws.questions.filter((x) => x.origin === "worksheet" && !s.played.includes(x.id));
  const fb = out.feedback;
  if (out.action === "finish") {
    if (unplayed.length === 0 || elapsed >= 0.8 * s.timeBudgetSec) return { action: "finish", feedback: fb, reason: out.reason, source: "coach" };
    return { ...fallbackNext(ws, s, "coach tried to finish early"), feedback: fb };
  }
  if (out.action === "next") {
    const q = unplayed.find((x) => x.id === out.nextQuestionId);
    return q ? { action: "play", question: q, feedback: fb, reason: out.reason, source: "coach" } : { ...fallbackNext(ws, s, `unknown question ${out.nextQuestionId}`), feedback: fb };
  }
  // variant / probe: limits, then the SAME code checks as a scanned question
  const sameTarget = s.variants.filter((v) => v.target === out.targetMisconceptionId).length;
  if (s.variants.length >= 3 || sameTarget >= 2) return { ...fallbackNext(ws, s, "variant limit reached"), feedback: fb };
  if (elapsed > s.timeBudgetSec - 20) return { ...fallbackNext(ws, s, "no time for a variant"), feedback: fb };
  if (!out.newQuestion) return { ...fallbackNext(ws, s, "variant had no question"), feedback: fb };
  const id = `${last.questionId.split("v")[0]}v${s.variants.length + 1}`;
  const reg = [...ws.misconceptions, ...out.newMisconceptions];
  const design = { ...out.newQuestion.design, id, misconceptions: [...out.newQuestion.design.misconceptions, ...reg.filter((m) => !out.newQuestion!.design.misconceptions.some((x) => x.id === m.id))] };
  const built = assemble({ ...out.newQuestion.read, id, printedAnswer: null }, design, "variant", last.questionId);
  if (!built.question) return { ...fallbackNext(ws, s, "coach's question failed the code check"), feedback: fb, rejected: built.errors };
  return { action: "play", question: built.question, feedback: fb, reason: out.reason, source: "coach" };
}

/** Agent 6 guard: every number in the AI's teacher summary must exist in the computed stats or the label text.
 *  Dates/times and long ids are skipped (they'd allow almost any number), and simple percentages of real counts are allowed. */
export function numbersAllowed(text: string, statsAndLabels: unknown): boolean {
  const allowed = new Set<number>(); const ints: number[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "number") { allowed.add(v); if (Number.isInteger(v) && v >= 0 && v <= 500) ints.push(v); }
    else if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^[0-9a-f]{12,}$/i.test(v)) return;   // ISO dates, Mongo ids
      for (const m of v.match(/\d+(\.\d+)?/g) ?? []) allowed.add(Number(m));
    }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(statsAndLabels);
  for (const a of ints) for (const b of ints) if (b > 0 && a <= b) allowed.add(Math.round((100 * a) / b));
  return (text.match(/\d+(\.\d+)?/g) ?? []).every((n) => allowed.has(Number(n)));
}
```

**`/api/next` flow:**
1. Load the session, worksheet, this session's attempts, and the attempt by `attemptId` (or the inline `attempt`). **No attempt yet** (first question): only `next` is allowed; anything else → fallback.
2. Build the context (keep it under ~6 KB): worksheet questions as `{id, concept, template, played}`, registry `{id, label}`, student model, raw counts, `secondsLeft`, templates played, and the last attempt with `chosenText`, `correct`, `misconceptionId`, `msToAnswer`, `hoverTrace`, `experiments`, `mixTries`, `balancerSteps`.
3. `askJSON("director", DirectorOut, DIRECTOR_PROMPT(ctx), {ctx: {sessionId, classCode, reason: "next"}})`.
4. ok → `applyDirector(...)`; not ok → `fallbackNext(...)`.
5. If a variant passed: append it to `worksheet.questions` (origin `"variant"`), add any `newMisconceptions` to the registry, push to `session.variants`.
6. Save the clamped `studentModel`. (`session.played` is updated by `/api/attempt` on every insert, so a client-side fallback pick is never lost.)
7. Return `{action, question, feedback, reason, source, ms, rejected?}`. `rejected` (code's reasons a coach question failed) is shown in the AI trace: honest, and judges like seeing the checker work.

**Client side (`src/game/coach.ts`):** call `/api/next` at LOCK-IN with an `AbortController` at **6 s**. While the reveal plays, the coach is thinking. On timeout or error, compute `fallbackNext` locally from the worksheet already in memory. The game never waits on the AI.

## 10. Classmates (`/api/class/[code]/simulate`)

```ts
export const ClassmatesOut = z.object({ students: z.array(z.object({
  nickname: z.string().min(1).max(16), profile: z.string().max(100),
  answers: z.array(z.object({ questionId: z.string(), choice: z.enum(["A", "B", "C", "D"]), ms: z.number().int().min(1000).max(60000) })),
})).length(4) });
```
Code then: skip unknown question ids; for each answer look up the choice in the worksheet and set `correct`, `misconceptionId`, `chosenText` **from the worksheet, not the model**; create 4 sessions with `simulated: true`, `profile`, `endedAt` set; insert attempts with `simulated: true` and `createdAt` spread over the previous 20 minutes (so they don't toast). Idempotent: if simulated sessions exist for the class, do nothing.

## 11. Teacher insight (`/api/class/[code]/insights`)

```ts
export const InsightOut = z.object({
  bullets: z.array(z.string().max(200)).length(3),
  groups: z.array(z.object({ name: z.string().max(30), students: z.array(z.string()), mistake: z.string() })).max(3),
  nextMove: z.string().max(220),
});
```
Input: `ClassStats` (06 §4, computed by code) + the last 5 coach `reason`s. After the call, run `numbersAllowed(text, {stats, labels})` on every bullet and `nextMove`; replace any failing text with the code-built line `Top mistake: {label} ({n} of {N} students).` Cache the result per class for 20 s. Show a small "✓ numbers checked" tag.

## 12. Tomorrow's warm-up (`/api/class/[code]/warmup`)

1. Top 3 mistakes from `ClassStats`, plus 3 of today's questions as style examples.
2. `askJSON("warmup", ReadOut, WARMUP_PROMPT(...))` → `askJSON("designer", ...)` → `assemble` each (same repair loop as a scan).
3. Save as a worksheet with `source: "generated"`; return `/print/[wsId]`: a clean printable page (questions, a blank answer line, small QR to play it). Printing it and scanning it back in works like any other worksheet.

## 13. Speech (`src/lib/speak.ts`)
```ts
export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05; u.lang = "en-US";
  const v = speechSynthesis.getVoices().find((v) => /Google US English|Samantha/.test(v.name));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
```
- Call `speechSynthesis.getVoices()` once on Calibrate to warm up; the "Start" click unlocks audio.
- Reveal order: the option's `why` (from Agent 2) plays at once; the coach's `feedback` plays next if it has arrived. Captions always show both.
- "Google US English" is a network voice; offline Chrome falls back to a local voice. Fine.
