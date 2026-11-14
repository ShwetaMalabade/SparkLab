# 02 · Architecture & Data Contracts
**Owner:** C (AI/Backend) · **Reads:** everyone (all code is written against this) · **Depends on:** 00

---

## 1. Architecture

```
┌──────────────────────────── Student laptop (Chrome) ─────────────────────────────┐
│ Webcam ─► MediaPipe Pose (WASM/GPU) ─► Gesture Engine ─► Zustand event bus       │
│                                                │  (hover trace, experiments)      │
│ UI screens (Next.js) ◄── GameRunner ──────────┴──► R3F 3D scene                  │
│   │ resized photo │ attempt │ "what next?" │ speechSynthesis (local voice)        │
└───┼───────────────┼─────────┼────────────────────────────────────────────────────┘
    ▼               ▼         ▼
┌───────────────────────── Next.js API routes (Vercel Hobby) ──────────────────────┐
│ /api/ingest  ─► Agent 1 Reader-Solver (vision) ─► code verify ─► Agent 2 Mistake │
│                 Modeler + Level Designer ─► code verify ─► repair loop ─► save   │
│                 └► (background) Agent 3 Critic ─► flags                           │
│ /api/next    ─► Agent 4 Director (coach) ─► variant? ─► code verify ─► next step │
│ /api/class/[code]/simulate ─► Agent 5 Classmates                                 │
│ /api/class/[code]/insights ─► Agent 6 Insight over COMPUTED stats ─► number check│
│ /api/class/[code]/warmup   ─► Agent 7 Warm-up Writer ─► Agent 2 ─► code verify   │
│ askJSON(): one wrapper for every agent: provider switch, timeout, 429 retry,      │
│            Zod check, log to Mongo `aiCalls`, replay in offline mode              │
└──────────────────────────────────────────┬────────────────────────────────────────┘
                                           ▼
                         MongoDB Atlas Free: worksheets, classes, sessions,
                         attempts, aiCalls (TTL 24 h)  ·  OFFLINE=1 → in-memory
    ▲
┌───┴──────── Teacher / judge phone ────────┐
│ /live/[code] polls /api/class/[code] / 2 s│
└───────────────────────────────────────────┘
```

**One answer, end to end:** student locks in → `POST /api/attempt` (saved, phone sees it ≤ 2 s) and `POST /api/next` (coach thinks while the reveal plays, 4–6 s) → next question, possibly a new variant → repeat.

## 2. Tech stack (all free)

| Tech | Purpose |
|---|---|
| Next.js (App Router, TypeScript) | Site + API routes in one repo |
| React Three Fiber + drei + postprocessing | 3D scene, text, bloom |
| @mediapipe/tasks-vision (Pose Landmarker lite) | Body/hand points in the browser |
| Zustand | Shared game + gesture state |
| Zod | Validate every AI output and API body |
| mathjs | Compute every physics number |
| Framer Motion, Tailwind | UI animation, styling |
| @google/genai | Gemini (default for all 7 agents) |
| @aws-sdk/client-bedrock-runtime | Only if credits (`AI_PROVIDER=bedrock`) |
| MongoDB Atlas Free + `mongodb` driver | Data + AI call log |
| `qrcode` | QR for the Live Teacher View |
| Web Speech API | Spoken feedback (built into Chrome) |
| Vercel Hobby | Hosting + public URL |

## 3. Setup (run only when Dharm says "start coding")

```bash
npx create-next-app@latest homework-arena --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd homework-arena
npm i three @react-three/fiber @react-three/drei @react-three/postprocessing zustand zod mathjs framer-motion qrcode
npm i -D @types/three @types/qrcode tsx vitest
npm i @mediapipe/tasks-vision @google/genai mongodb @aws-sdk/client-bedrock-runtime
mkdir -p public/mediapipe-wasm public/models
cp -r node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe-wasm/
curl -L -o public/models/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

`.env.local` (never commit; commit `.env.example` with blank values):
```bash
AI_PROVIDER=gemini                 # "gemini" | "bedrock"
GEMINI_API_KEY=...
GEMINI_MODEL_VISION=...            # a Flash model that reads images (check AI Studio for the current name)
GEMINI_MODEL_FAST=...              # a Flash-Lite model for agents 2–7 (check AI Studio)
MONGODB_URI=mongodb+srv://...
MONGODB_DB=homework_arena
OFFLINE=0                          # 1 = in-memory DB + replay of recorded AI outputs (demo laptop only)
# Only if Amazon credits arrive:
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_VISION=...
BEDROCK_MODEL_FAST=...
```
Each teammate uses their **own** AI Studio key while developing, so testing never eats the demo key's quota.

**Next.js 15+ note:** route `params` is a Promise. In route handlers and server pages write `const { code } = await params;`. In client pages use `useParams()`.

## 4. Modes

| Mode | How to turn on | What changes |
|---|---|---|
| **Live** (default) | Deployed URL | Real agents, Atlas, phone view over the internet |
| **Offline** | On the demo laptop: `OFFLINE=1 npm run build && OFFLINE=1 npm start`, open `localhost:3000` | `db.ts` uses an in-memory store; `askJSON` serves **recorded** outputs from `data/replay/*.json`; the live view runs in a second window on the same laptop (it polls localhost) |

**Recording a replay** (`scripts/export-replay.ts`, C, before the 3 AM freeze): play one full demo session in live mode, then export that session's `aiCalls` (keyed by agent + input hash) and its worksheet, class and attempts to `data/replay/`. These are real AI outputs, not hand-written ones. In offline mode, a coach request with no recorded match uses the code fallback (next unplayed question).

A small pill top-left shows **LIVE** or **OFFLINE · REPLAY**, so the team always knows which is on.

## 5. Folder structure

```
homework-arena/
├─ public/{mediapipe-wasm/, models/pose_landmarker_lite.task, sfx/*.mp3}
├─ data/replay/                 # recorded AI outputs for offline mode (generated by script, never hand-written)
├─ scripts/{test-ai.ts, export-replay.ts}
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                       # Landing: creates the class → QR is ready before the scan
│  │  ├─ scan/page.tsx
│  │  ├─ review/[wsId]/page.tsx
│  │  ├─ play/[wsId]/page.tsx           # Calibrate + game
│  │  ├─ results/[sessionId]/page.tsx
│  │  ├─ live/[code]/page.tsx           # Teacher/judge phone view
│  │  ├─ print/[wsId]/page.tsx          # Printable worksheet (warm-up)
│  │  └─ api/  ingest/ ingest/critic/ next/ attempt/ session/ session/[id]/end/
│  │           worksheet/[id]/ class/ class/[code]/ class/[code]/simulate/
│  │           class/[code]/insights/ class/[code]/warmup/            (each has route.ts)
│  ├─ lib/{schema.ts, ai.ts, agents/{reader.ts, designer.ts, critic.ts, director.ts, classmates.ts,
│  │       insight.ts, warmup.ts}, prompts.ts, assemble.ts, verifyPhysics.ts, chem.ts, ingest.ts,
│  │       db.ts, memoryDb.ts, replay.ts, resizeImage.ts, speak.ts, classCode.ts}
│  ├─ motion/{pose.ts, gestures.ts, smoothing.ts}
│  ├─ game/{store.ts, GameRunner.tsx, coach.ts, templates/{AnswerBalloons,ProjectileLauncher,MixLab,EquationBalancer}.tsx}
│  └─ three/{Arena.tsx, Avatar.tsx, HandCursor.tsx, effects/{Bubbles,Precipitate,Trail,Confetti}.tsx}
└─ tests/{chem.test.ts, physics.test.ts, assemble.test.ts, gestures.test.ts, fixtures/*.json}
```
There is no hand-written content anywhere in `data/`.

## 6. Data contracts

### 6.1 `src/lib/schema.ts` (ran with 55 passing checks, see `09 §2`)
Two layers. **Agent drafts** (`ReadOut`, `DesignOut`) are what the model returns, and they are checked with *their own* schemas. **The final `Question`** is assembled by code (`assemble.ts`, `03 §6`) from the drafts plus code-computed values, then checked again. Never validate a raw model reply against `Question`.

```ts
// src/lib/schema.ts — two layers: what each AI agent returns (drafts), and the final playable Question.
import { z } from "zod";

export const Topic = z.enum([
  "projectile_motion", "newtons_second_law", "free_fall", "kinematics", "energy",
  "reaction_prediction", "balancing_equations", "acid_base_ph", "stoichiometry",
  "other_physics", "other_chemistry",
]);
export const Template = z.enum(["projectile_launcher", "mix_lab", "equation_balancer", "answer_balloons"]);
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
  simulated: z.boolean().default(false),
});
export const NewSession = z.object({
  classCode: z.string().length(4), worksheetId: z.string(), nickname: z.string().min(1).max(16),
  mode: z.enum(["seated", "standing"]).default("seated"), timeBudgetSec: z.number().int().min(60).max(3600).default(600),
});
export type TAttempt = z.infer<typeof Attempt>;
```

### 6.2 Session student model (written by Agent 4, clamped by code)
```ts
type StudentModel = {
  concepts: Record<string, { mastery: number /* 0..1 */; evidence: string /* ≤ 80 chars */ }>;
  notes: string;                     // ≤ 200 chars, the coach's running read of this student
};
```
Code also keeps raw counts (`correct`, `wrong`, `misconceptionCounts`) itself. Teacher numbers always come from the raw counts, never from the model.

### 6.3 MongoDB collections (all `createdAt` are BSON **Date**, set by the server)
| Collection | Key fields | Indexes |
|---|---|---|
| `worksheets` | `_id, title, source, imageHash, questions[], misconceptions[], createdAt` | TTL 24 h on `createdAt` |
| `classes` | `_id (=code), worksheetId (null until scan), timeBudgetSec, createdAt` | TTL 24 h |
| `sessions` | `_id, classCode, nickname, worksheetId, mode, simulated, profile?, studentModel, played[], startedAt, endedAt, createdAt` | `{classCode:1}`, TTL 24 h |
| `attempts` | `Attempt` + `createdAt` | `{classCode:1, createdAt:1}`, TTL 24 h |
| `aiCalls` | `agent, model, inputHash, ms, ok, error?, outputJson, sessionId?, classCode?, reason?, createdAt` | `{classCode:1, createdAt:-1}`, `{agent:1, inputHash:1}`, TTL 24 h |

`db.ts` caches the `MongoClient` on `globalThis` (Atlas Free has a connection cap). `memoryDb.ts` implements the same 6 functions (`insert`, `find`, `findOne`, `update`, `aggregateClass`, `log`) on plain arrays for offline mode.

### 6.4 API routes
| Route | Method | Body / params | Returns | Notes |
|---|---|---|---|---|
| `/api/class` | POST | `{timeBudgetSec?, worksheetId?}` | `{code}` | Called on Landing. Code = 4 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. With `worksheetId` ("Use last scan"): links it at once and starts the classmates, no scan calls |
| `/api/ingest` | POST | multipart `file` (≤ 1.5 MB) + `classCode` | **NDJSON stream**: `{step, status, ms, detail}` lines, then `{worksheet}` | `export const maxDuration = 60`. Links the class to the worksheet, then starts the Critic and Classmates in the background |
| `/api/ingest/critic` | POST | `{wsId}` | `{flags}` | Background; Review screen polls the worksheet for new flags |
| `/api/worksheet/[id]` | GET / PATCH | PATCH: edited `prompt`/`given` of one question | updated worksheet | PATCH re-runs code verification only (no AI call) |
| `/api/session` | POST | `NewSession` | `{sessionId}` | Called at the end of Calibrate |
| `/api/session/[id]/end` | POST | — | `{ok}` | Sets `endedAt` |
| `/api/attempt` | POST | `Attempt` | `{ok, attemptId}` | Zod; reject > 10 KB; server sets `createdAt`; pushes `questionId` to `session.played` (attempts are the source of truth for what's played) |
| `/api/next` | POST | `{sessionId, attemptId?, attempt?}` | `{action, question?, feedback, reason, source, ms, rejected?}` | Agent 4. `attempt` inline if the attempt POST is still queued. No attempt (first question): the coach may only choose `next`. Client gives up at 6 s and uses the code fallback |
| `/api/class/[code]` | GET | — | `ClassStats` (`06 §4`) | `Cache-Control: no-store` |
| `/api/class/[code]/simulate` | POST | — | `{students: 4}` | Agent 5; idempotent (does nothing if classmates exist) |
| `/api/class/[code]/insights` | POST | — | `{bullets[3], groups[], nextMove, checked: true}` | Agent 6; cached 20 s per class |
| `/api/class/[code]/warmup` | POST | — | `{worksheetId, printUrl}` | Agent 7 → Agent 2 → code |
