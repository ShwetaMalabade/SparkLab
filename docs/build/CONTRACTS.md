# CONTRACTS.md — The only interfaces between Shweta and Dharm
**Owner:** Dharm. **Frozen after task P2-04** (Sat ~9:30). Later changes must be **additive** (new optional fields/functions) and logged in `PROGRESS-P2.md → Contract changes`.

---

## 1. Types — `src/lib/schema.ts` (pasted from `docs/plan/tested-code/`)
Shweta imports: `TWorksheet`, `TQuestion`, `TAttempt`, `Template`, `Reaction`. Key fields Shweta reads:

| Field | Meaning for the game |
|---|---|
| `question.template` | `"answer_balloons" \| "projectile_launcher" \| "mix_lab" \| "equation_balancer"` (others → Balloons) |
| `question.origin` | `"worksheet"` or `"variant"` (variant → show "🧠 New question from your coach") |
| `question.params.lock` | Launcher: `"speed" \| "angle" \| "none"` |
| `question.params.decoys` | Mix Lab: up to 2 extra species for decoy beakers |
| `question.given` | e.g. `{ v: {value:20,unit:"m/s"}, theta: {value:30,unit:"deg"}, g: {...} }` |
| `question.answer.value / .text` | Correct value (code-computed) |
| `question.choices[4]` | `{ id: "A".."D", text, correct, misconceptionId, why }`. Show `text` exactly as is |
| `question.reaction` | Mix Lab: `reactants[]`, `products[]`, `equation`, `observation`, `visual{bubbles,colorFrom,colorTo,precipitateColor,heat,flame}`, `hazard` |
| `question.equation` | Balancer: the balanced answer, e.g. `"2H2 + O2 -> 2H2O"` |

## 2. Client API — `src/lib/client/api.ts` (Dharm owns; Shweta calls)
```ts
import type { TWorksheet, TQuestion, TAttempt } from "@/lib/schema";

export type IngestStep = { step: string; status: "running" | "done" | "error"; ms?: number; detail?: string };
export type NextStep = {
  action: "play" | "finish"; question?: TQuestion; feedback: string | null;
  reason: string; source: "coach" | "fallback"; ms?: number; rejected?: string[];
};
export type AttemptInput = Omit<TAttempt, "simulated">;

export function getMode(): "live" | "offline" | "mock";                       // mock until Merge 1
export function getClassCode(): string | null;                               // set by Landing in sessionStorage
export async function createClass(o?: { timeBudgetSec?: number; worksheetId?: string }): Promise<{ code: string }>;
export async function ingest(file: Blob, classCode: string, onStep: (s: IngestStep) => void): Promise<TWorksheet>;
export async function getWorksheet(wsId: string): Promise<TWorksheet>;
export async function createSession(s: { classCode: string; worksheetId: string; nickname: string; mode?: "seated"; timeBudgetSec?: number }): Promise<{ sessionId: string; timeBudgetSec: number }>;
export async function postAttempt(a: AttemptInput): Promise<{ attemptId: string | null }>;   // NEVER throws: queues in localStorage, retries every 5 s
export async function nextStep(r: { sessionId: string; attemptId?: string | null; attempt?: AttemptInput }): Promise<NextStep>; // NEVER throws: 6 s abort → code fallback
export async function endSession(sessionId: string): Promise<void>;
```
**Mock behaviour (until Merge 1):** `getWorksheet` → `data/fixtures/worksheet.json` for any id (also `wsId = "fixture"`); `createClass` → random 4-char code; `createSession` → `"s_mock"`; `postAttempt` → localStorage; `nextStep` → `fallbackNext` (next unplayed worksheet question, else finish), `source: "fallback"`.

## 3. Routes Shweta navigates to
| URL | Owner | Notes |
|---|---|---|
| `/play/[wsId]` | Shweta | `wsId = "fixture"` works in mock mode |
| `/results/[sessionId]` | Dharm | Shweta navigates here at the end. Until P2-18, it's a stub page |

## 4. Helpers Shweta may import
| Import | From | Use |
|---|---|---|
| `speak(text)`, `warmVoices()` | `@/lib/speak` | Spoken `why` + coach feedback (captions are Shweta's job) |
| `isBalanced`, `sameSpecies`, `withCoefficients`, `splitEquation` | `@/lib/chem` | Equation Balancer |

## 5. Motion event bus (Shweta internal; listed so Dharm knows it exists)
`src/motion/types.ts`: `{ type: "hover"|"dwell"|"bothUp"|"clap"|"lean"|"fire"|"lost"|"found", side?: "left"|"right", targetId?: string, t: number }`.

## 6. What Shweta sends at LOCK-IN (`AttemptInput`)
`classCode, sessionId, worksheetId, questionId, questionOrigin, chosen ("A".."D" or "X"), chosenText, correct, misconceptionId, msToAnswer, input ("gesture"|"keyboard"|"mouse"), hoverTrace[], experiments[] (Launcher: thetaDeg, speed, landedM), mixTries[] (Mix Lab pairs), balancerSteps[] (coefficient arrays)`.
