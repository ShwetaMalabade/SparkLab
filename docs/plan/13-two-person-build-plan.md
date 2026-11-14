# 13 · Two-Person Build Plan (phases, parallel work, merge points)
**Owner:** Claude · **Replaces the 4-person split in `08`** (keep `08` for reference only) · **Depends on:** 00–07, 09

> Team = **2 people**, each driving their own coding LLM.
> **Shweta = "PLAY"**: motion + 3D + game (everything that runs on the camera and the 3D canvas).
> **Dharm = "BRAIN"**: AI agents + backend + database + all the non-3D web pages + Devpost/business work.
> Each person gives their LLM **their brief** (`PERSON-1-PLAY-BRIEF.md` or `PERSON-2-BRAIN-BRIEF.md`) plus the plan files that brief lists.

---

## 1. Scope for 2 people (decision D14, final)

Four people could build 7 agents; two people can't, not safely in ~18 build hours. **AI writes, code checks** stays the core story.

| Item | 2-person decision |
|---|---|
| Agent 1 Reader-Solver (vision) | ✅ **Must** |
| Agent 2 Mistake Modeler + Level Designer | ✅ **Must** |
| Code verification (`assemble`, `verifyPhysics`, `chem`) | ✅ **Must** (already written + tested, 86/86) |
| Agent 4 Director / coach + live variant (Wow #2) | ✅ **Must**, with the code fallback |
| Agent 6 Teacher Insight (+ number guard) | ✅ **Must** (1 small call, big phone payoff) |
| Live Teacher View on the phone (Wow #1) | ✅ **Must** |
| Agent 5 Classmate Simulator | 🟡 **Phase 3, only if Merge 2 is green**. Without it the phone shows only real players (the judge can join as a 2nd player) |
| Agent 3 Critic | ❌ **Cut.** Code checks + the Review screen cover it. Say "4 AI agents + code checks" |
| Agent 7 Warm-up Writer (Wow #3) | ❌ **Cut** (mention as "next") |
| Templates | Answer Balloons + **Projectile Launcher** + **Mix Lab** = must. **Equation Balancer** = Phase 3 |
| Standing mode, stretch S1–S6 | ❌ Cut |
| Offline replay mode | ✅ Must (Phase 4), it's the demo safety net |

Pitch line: *"Four AI agents read the worksheet, model each student's mistakes, coach them live, and brief the teacher, and code checks every number before anyone sees it."*

## 2. Who owns what (no two people edit the same file)

| Area | Owner | Paths |
|---|---|---|
| Motion | **Shweta** | `src/motion/**`, `public/mediapipe-wasm/`, `public/models/`, `tests/fixtures/`, `tests/gestures.test.ts` |
| 3D + game | **Shweta** | `src/three/**`, `src/game/**` (incl. `GameRunner.tsx`, `store.ts`, `templates/**`), `public/sfx/` |
| Play page | **Shweta** | `src/app/play/[wsId]/page.tsx` (Calibrate + game) |
| Shared contracts | **Dharm** (Shweta reads only; ask in chat to change) | `src/lib/schema.ts`, `src/lib/client/api.ts`, `src/lib/client/types.ts` |
| AI + verification | **Dharm** | `src/lib/ai.ts`, `src/lib/agents/**`, `src/lib/prompts.ts`, `src/lib/assemble.ts`, `verifyPhysics.ts`, `chem.ts`, `ingest.ts`, `replay.ts`, `db.ts`, `memoryDb.ts`, `classCode.ts`, `resizeImage.ts`, `speak.ts` |
| API routes | **Dharm** | `src/app/api/**` |
| Non-3D pages | **Dharm** | `src/app/page.tsx` (Landing), `scan/`, `review/`, `results/`, `live/[code]/` |
| Design tokens | **Dharm** sets in Phase 0, then frozen | `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx` |
| Data + scripts | **Dharm** | `data/**`, `scripts/**`, `tests/verify|assemble|director.test.ts` |
| `package.json` | Either, but **one tiny commit per install**, pull first | — |

**Golden rule for both LLMs:** never edit a file outside your paths. If you need a change there, write a one-line request in #hack-project (or to your teammate) and code against the current version.

## 3. The contract between Shweta and Dharm (written by Dharm in Phase 0)

> **Source of truth for coding: `build/CONTRACTS.md`** (it adds `getMode()`, `timeBudgetSec` in `createSession`'s result, and the helper imports). Task-by-task coding instructions: `build/P1-TASKS.md`, `build/P2-TASKS.md`; progress tracking: `build/PROGRESS-P1.md` / `PROGRESS-P2.md`.

Shweta's game only talks to Dharm's backend through **one file**: `src/lib/client/api.ts`. Dharm ships it in Phase 0 with a **mock** implementation (returns a fixture worksheet, accepts attempts, uses the code fallback for "next"), and switches it to real `fetch` calls later. Shweta never calls `fetch` directly.

```ts
// src/lib/client/api.ts  (Dharm owns. Signatures are FROZEN after Phase 0)
import type { TWorksheet, TQuestion, TAttempt } from "@/lib/schema";

export type IngestStep = { step: string; status: "running" | "done" | "error"; ms?: number; detail?: string };
export type NextStep = {
  action: "play" | "finish"; question?: TQuestion; feedback: string | null;
  reason: string; source: "coach" | "fallback"; ms?: number; rejected?: string[];
};

export async function createClass(opts?: { timeBudgetSec?: number; worksheetId?: string }): Promise<{ code: string }>;
export async function ingest(file: Blob, classCode: string, onStep: (s: IngestStep) => void): Promise<TWorksheet>;
export async function getWorksheet(wsId: string): Promise<TWorksheet>;
export async function createSession(s: { classCode: string; worksheetId: string; nickname: string; mode?: "seated"; timeBudgetSec?: number }): Promise<{ sessionId: string }>;
export async function postAttempt(a: Omit<TAttempt, "simulated">): Promise<{ attemptId: string | null }>;   // never throws: queues in localStorage + retries every 5 s
export async function nextStep(req: { sessionId: string; attemptId?: string | null; attempt?: Omit<TAttempt, "simulated"> }): Promise<NextStep>; // never throws: 6 s abort → code fallback
export async function endSession(sessionId: string): Promise<void>;
export function getClassCode(): string | null;        // from sessionStorage, set by Landing
```

**Fixture for Shweta (Phase 0):** Dharm runs `scripts/make-fixture.ts`, which feeds the reader/designer drafts from `tests/assemble.test.ts` through the real `assemble()` and writes `data/fixtures/worksheet.json` (≥ 1 launcher, 1 mix_lab, 1 balloons, 1 balancer question). This is **code-assembled, not hand-written**, and matches the real schema exactly. Shweta develops against it until Merge 1.

**Gesture → game contract (Shweta internal):** `src/motion/types.ts` event bus `{ type: "hover"|"dwell"|"bothUp"|"clap"|"lean"|"fire"|"lost"|"found", side?, targetId?, t }` (04 §6). Templates subscribe; Dharm never touches it.

## 4. Git workflow

- Repo is **public**, created by Dharm in Phase 0. `main` deploys to Vercel automatically.
- Branches: `p1/<thing>` and `p2/<thing>`. Commit small and often. **Pull `main` at least every 2 hours.**
- **Merge points** (below): both stop, Dharm merges `p2/*`, then Shweta merges `p1/*` (Shweta rebases on `main` first), run the merge checklist, deploy, continue.
- Conflicts should be near zero because paths don't overlap. The only shared files are `package.json` / lockfile: if they conflict, take both dependency lists and run `npm i`.
- Never commit `.env.local`. Both use `.env.example` as the list of keys.

## 5. Phases (all times ET, Saturday → Sunday)

> **Sleep first.** It's ~2 AM Saturday. Phase 0 starts **Sat 9:00 AM**. Starting now on no sleep pushes the worst fatigue onto 3–7 AM Sunday, when you freeze, record and submit.

| Phase | Time | **Shweta · PLAY** (in parallel) | **Dharm · BRAIN** (in parallel) | Ends with |
|---|---|---|---|---|
| **0 · Setup + contracts** | Sat 9:00–10:00 | Read `00, 04, 05`. Prototype MediaPipe on a scratch page `src/app/play/dev/page.tsx` (camera + landmarks + debug overlay) — **only after Dharm pushes the scaffold** (~9:30); until then read files and prepare fixtures plan | Create repo + Next.js scaffold + all deps (02 §3), design tokens, folder skeleton, `schema.ts` + tested code pasted from `tested-code/`, run tests (86 pass), **`client/api.ts` mock + `data/fixtures/worksheet.json`**, push by 9:30. Then: AI Studio quota check, Atlas cluster, Vercel project, `test-ai.ts` | **Sync 0 (10:00, 10 min):** Shweta can import `api.ts` + fixture; quota numbers posted; K2 decision flagged for Dharm by 11 AM |
| **1 · Foundations** | 10:00–14:00 | Gesture engine (pixel space, reach box, hover/dwell/bothUp/clap/lean + keyboard twins), seated calibration, arena (floor, lights, bloom), upper-body avatar, **Answer Balloons**, `GameRunner` loop driven by the fixture + mock `nextStep` | `ai.ts` (Gemini + log), Agent 1 + 2 prompts tested on 3 real photos in AI Studio, `/api/ingest` (NDJSON steps, repair loop), `db.ts` + `memoryDb.ts`, `/api/class`, `/api/session`, `/api/attempt`, `/api/worksheet/[id]`; Landing (create class + QR), Scan screen (live steps). **10 AM: call/email 3 Peri businesses.** Print the demo worksheet with the key typo | **MERGE 1 (14:00, 30 min)** |
| **2 · Core features** | 14:30–19:00 | **Projectile Launcher** (forearm θ, power, lock, hold-steady fire, trail, ghost trail), **Mix Lab** (beakers, attach, clap armed only with 2 beakers, reaction visual from the worksheet's AI reaction, hazard card) | **`/api/next` coach** (Agent 4 + `applyDirector` + variant verify + logging), switch `api.ts` `nextStep` to real with 6 s abort + fallback; Review screen (flags, editable numbers → PATCH); **`/api/class/[code]` stats aggregation + Live phone page** (polling, toasts, coach feed) | **MERGE 2 (19:00, 30 min)** |
| **3 · Complete** | 19:30–23:30 | **Equation Balancer** (if Merge 2 green; else polish Launcher/Mix Lab), AI trace drawer (`T`), Results hand-off, reveal polish, sounds, tracking-lost pause, recorded-landmark tests | **Agent 6 insights** + `numbersAllowed` guard on the phone, Results page, TTL indexes, **Agent 5 classmates only if Merge 2 was green**; Peri visit/call (quote, photo, 1 change) | **MERGE 3 (23:30, 30 min):** full demo on the Vercel URL |
| **4 · Harden** | Sun 0:00–3:00 | Perf pass (≥ 30 fps), lighting test with 2 lamps, 3-person gesture test (`09 §3`), bug fixes from the demo run | **Offline mode** (`OFFLINE=1`, memory DB, replay), play 1 full demo live → `scripts/export-replay.ts`, test with Wi-Fi off; **record 2-min backup video**; Devpost draft | **3:00 AM FEATURE FREEZE** |
| **5 · Ship** | 3:00–7:30 | Bug fixes only; rehearse 3× (Shweta drives keyboard backup) | Bug fixes; final Devpost, README, `PERI.md`, prize selections; **submit by 7:30** | Submitted |
| Judging | 9:30 AM | Present | Present + Q&A | 🏆 |

## 6. Merge checklists (both people, together)

**MERGE 1 · Sat 14:00** — "a real worksheet becomes a playable level"
- [ ] Dharm: switch `api.ts` `ingest`, `createClass`, `createSession`, `postAttempt`, `getWorksheet` to real calls (keep `nextStep` mocked)
- [ ] Scan the printed worksheet → verified worksheet saved (key typo flagged) → Play page loads it by `wsId`
- [ ] Calibrate seated → play Answer Balloons **by gesture** → attempt appears in Mongo `attempts`
- [ ] Keyboard twins work for the whole flow
- [ ] Deployed to Vercel; works in incognito
- **If red:** Shweta keeps building on the fixture; Dharm fixes ingest first. Don't block Shweta.

**MERGE 2 · Sat 19:00** — "the coach and the phone work"
- [ ] Coach picks the next question after each answer (trace shows `source: coach`), and falls back within 6 s when the network is throttled (Chrome DevTools "Slow 3G")
- [ ] A wrong answer can produce a **🧠 variant** that passed code checks (or a visible "code rejected" entry)
- [ ] Launcher + Mix Lab playable with the real worksheet
- [ ] Judge's phone (real phone, venue Wi-Fi and cellular) updates ≤ 3 s after each answer
- **Green → Phase 3 includes Balancer + classmates. Red → Phase 3 = fix + polish only.**

**MERGE 3 · Sat 23:30** — "the full 2-minute demo works on the deploy"
- [ ] Run `11 §2` script end to end with a stopwatch (≤ 2:00), 2 times in a row
- [ ] Insights bullets show "✓ numbers checked"; an injected fake number is replaced
- [ ] Every number on screen came from code (spot-check 5)
- [ ] fps ≥ 30 in Mix Lab with pose running

## 7. Cut order (if behind) — no debate
1. Agent 5 classmates → 2. Equation Balancer → 3. AI trace drawer polish (plain list) → 4. Mix Lab decoys (2 beakers only) → 5. Launcher ghost trail → 6. Coach personal feedback line (keep the option's `why`).
**Never cut:** code verification, coach + fallback, keyboard twins, offline replay, live phone view, backup video.

## 8. How to drive your LLM (both people)

1. Start a fresh session. Paste your **brief** as the first message, and attach the plan files it lists.
2. Work **one task at a time** from your brief's phase list. Ask the LLM for: the files it will touch (must be inside your paths), the code, and how to test it.
3. After each task: run it, commit, tick it in the brief.
4. When the LLM wants to change a contract file (`schema.ts`, `api.ts`), stop. Shweta asks Dharm; Dharm decides and bumps it.
5. At each merge: stop coding, run the checklist together, post the result in #hack-project.
6. Every 2 hours: pull `main`, re-run tests (`npx tsx tests/*.test.ts`).
