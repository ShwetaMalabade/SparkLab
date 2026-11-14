# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are a coding LLM on a **2-person HackPrinceton team** building **Homework Arena**. A student snaps a photo of a physics or chemistry worksheet, and AI agents turn it into a 3D lab. The student plays it seated, using their hands through the webcam. An AI coach picks the next step, and the teacher watches live on their phone. The core rule is **AI writes, code checks every number**.

`AGENTS.md` holds the same workflow for other coding agents. The spec is in `docs/plan/` (read-only). Where `docs/plan/13-two-person-build-plan.md` disagrees with older plan files, `13` wins.

## Current repo state

The pre-tested code from `docs/plan/tested-code/` is in `src/lib`, `tests/` and `scripts/`, kept byte-identical to the reference. `src/lib/db.ts` is a no-op stub until the real Mongo version (P2-07). `src/lib/client/api.ts` currently runs **mock** behavior only: the fixture `data/fixtures/worksheet.json`, attempts in `localStorage["ha:attempts"]`, and `nextStep` = `fallbackNext`.

## Commands

```bash
npm run dev                      # local dev
npm run build                    # must pass before any merge into main (main auto-deploys to Vercel)
rm -rf .next && npm run build     # if globals.css/@theme edits don't show up (Turbopack + Tailwind loader caches stale CSS)
# Tests use a plain tsx harness (PASS/FAIL lines), not a test runner. Run one file at a time:
npx tsx tests/verify.test.ts && npx tsx tests/assemble.test.ts && npx tsx tests/director.test.ts   # must stay 86/86 after touching src/lib
npx tsx scripts/make-fixture.ts  # regenerates data/fixtures/worksheet.json through the real assemble()
npx tsx scripts/test-ai.ts       # AI key smoke test → {"ok":true}
OFFLINE=1 npm run build && OFFLINE=1 npm start   # offline demo: in-memory DB + recorded AI replays
# Mode pill / getMode() (src/lib/client/mode.ts): MOCK by default until Merge 1; NEXT_PUBLIC_MOCK=0 → LIVE; OFFLINE=1 at build → OFFLINE · REPLAY
```
Environment variables go in `.env.local` (never commit it) and are listed in `docs/plan/02 §3`: `AI_PROVIDER` (default `gemini`), `GEMINI_API_KEY`, `GEMINI_MODEL_VISION`, `GEMINI_MODEL_FAST`, `MONGODB_URI`, `MONGODB_DB`, `OFFLINE`, and the Bedrock vars (used only if Amazon credits arrive).

## Architecture (big picture; full spec in `docs/plan/02` and `03`)

- **Stack:** Next.js App Router with TypeScript strict, Tailwind, React Three Fiber, drei and postprocessing, MediaPipe Pose (WASM served from `public/mediapipe-wasm`), Zustand, Zod, mathjs, MongoDB Atlas Free, and Vercel Hobby. Everything runs on free tiers; never add a paid service.
- **Two schema layers:** agent output is validated against *draft* Zod schemas (`ReadOut`, `DesignOut`). Then `assemble()` (`src/lib/assemble.ts`) builds the final `Question` in code, which means it computes answers, wrong-choice numbers (from the AI's *wrong formulas*), reaction checks and `fmt()`. The AI never supplies a number that a student sees.
- **Verification:** `verifyPhysics.ts` lints formulas with mathjs, rejecting unknown symbols and trig on degree values without a `pi` conversion. `chem.ts` normalizes every arrow style, balances atoms, and applies solubility rules. Bad input returns errors and never throws.
- **`askJSON()` (`src/lib/ai.ts`):** the single wrapper for every agent. It handles the Gemini/Bedrock switch, timeout, 429 retry, Zod validation, and logging to the Mongo `aiCalls` collection. When `OFFLINE=1` it serves recorded outputs from `data/replay/` instead (`replayLookup`, keyed by agent and input hash).
- **Agents in scope:** 1 Reader-Solver (vision), 2 Mistake Modeler + Level Designer, 4 Director/coach, and 6 Teacher Insight. Agent 5 (Classmates) is built only if Merge 2 is green. **Agents 3 (Critic) and 7 (Warm-up) are CUT.**
- **Request flow:** `/api/ingest` streams NDJSON step lines and then the `{worksheet}` (`maxDuration = 60`). On lock-in, the client calls `POST /api/attempt` and `POST /api/next` in parallel. The coach result goes through `applyDirector()`, and any variant it writes is re-verified by code. The client aborts after 6 s and uses `fallbackNext()` (the next unplayed question). Insight text must pass `numbersAllowed()`, so invented numbers are rejected.
- **Live teacher view:** `/live/[code]` polls `GET /api/class/[code]` every 2 s. There are no change streams or websockets.
- **Mongo:** cache the client on `globalThis`. `createdAt` is a server-set BSON `Date` with a 24 h TTL. `memoryDb.ts` mirrors the same functions for offline mode.
- **Client boundary:** Shweta calls only `src/lib/client/api.ts` (signatures in `docs/build/CONTRACTS.md §2`). `getMode()` returns `mock`, `live` or `offline`. In mock mode, `getWorksheet` returns the fixture (`wsId = "fixture"`). `postAttempt` and `nextStep` **never throw**.
- **Next.js 16.4** (scaffolded with `cacheComponents: true` in `next.config.ts`), so the plan's Next 15 notes may be stale. Before writing route or page code, read the relevant guide in `node_modules/next/dist/docs/`. Route `params` is a Promise: use `const { code } = await params;` on the server and `useParams()` on the client. With Cache Components, a dynamic segment (`[wsId]`, `[code]`, `[sessionId]`) is runtime data, so read it inside a `<Suspense>` boundary, or the build fails. `src/app/results/[sessionId]/` shows the pattern: a server `page.tsx` wraps a client child in `<Suspense>`, and the child calls `useParams()`. Tailwind is v4, which uses CSS `@theme` in `globals.css` instead of a `tailwind.config.ts`.
- **Motion:** gestures are published on the bus defined in `src/motion/types.ts` (hover, dwell, bothUp, clap, lean, fire, lost, found). The default is seated, aiming with the forearm (elbow to wrist). Every gesture has a keyboard twin, and the demo must never block on the camera or the network. Camera frames never leave the browser.

> **Who's who:** **Dharm** = BRAIN (task IDs `P2-xx`, `docs/build/P2-TASKS.md`, `PROGRESS-P2.md`, branches `p2/*`) · **Shweta** = PLAY (task IDs `P1-xx`, `docs/build/P1-TASKS.md`, `PROGRESS-P1.md`, branches `p1/*`). Address work by name; the `P1`/`P2` prefixes are just stable IDs.

## Team workflow (mandatory)

### Step 1 · Find out who you are
The human will start the session with **"You are Dharm"** or **"You are Shweta"** (or "I'm Dharm" / "I'm Shweta"). If they didn't, **ask before doing anything.**

| | Shweta · **PLAY** | Dharm · **BRAIN** |
|---|---|---|
| Builds | Motion tracking, 3D scene, game loop, templates, Play page | AI agents, verification, API routes, MongoDB, Landing/Scan/Review/Results/Live pages, offline replay, deploy |
| Your task list | `docs/build/P1-TASKS.md` | `docs/build/P2-TASKS.md` |
| **Your** progress file (you write it) | `docs/build/PROGRESS-P1.md` | `docs/build/PROGRESS-P2.md` |
| **Other** progress file (read only) | `docs/build/PROGRESS-P2.md` | `docs/build/PROGRESS-P1.md` |

File ownership is in `docs/build/RULES.md §2`. Shweta owns `src/{motion,three,game}/**` and `src/app/play/**`. Dharm owns `src/lib/**`, `src/app/api/**` and the other pages. Shweta may **import** (never edit) `@/lib/schema`, `@/lib/client/api`, `@/lib/client/types`, `@/lib/speak` and `@/lib/chem`. `package.json` is shared: add one dependency per commit and pull first.

### Step 2 · At the start of every session (and every new task)
1. `git pull origin main` (and your own branch).
2. Read, in order: `docs/build/RULES.md` → `docs/build/CONTRACTS.md` → **your** task file → **both** progress files.
3. From the **other** person's progress file, note what's done, what they're doing, any **Requests to you**, and any **contract changes**. Tell the human in 3 lines: *"Partner is on X. Done since last time: Y. They need from us: Z."*
4. Pick the next task in your task file whose **Waits on** items are all ✅ in the right progress file. If a dependency isn't done, say so and pick the next unblocked task (or use the mock or fixture the task names).

### Step 3 · While working a task
- Touch **only** the paths your task file allows. Need a change elsewhere? Add it to **Requests to the other person** in **your** progress file and code against the current version.
- Before writing code, tell the human the task ID, the files you'll create or edit, and how you'll test it.
- Follow the plan section the task cites (`docs/plan/NN-*.md §n`). The plan is the spec, so don't invent features. Never build anything marked **CUT**. If a task runs more than 1.5× its estimate, tell the human and propose the cut from `docs/plan/13 §7`.

### Step 4 · When a task is done
1. Run its **Done when** test, plus the three `src/lib` tests if you touched `src/lib`.
2. Work on branches named `p1/<task-id>` or `p2/<task-id>`. Commit with the task ID first, e.g. `P1-07: arena stage + bloom`.
3. Update **your** progress file: status ✅, commit hash, a 1-line note, and anything the partner should know. Statuses are `⬜ todo`, `🟦 doing`, `✅ done`, `⛔ blocked` and `✂️ cut`.
4. Commit the progress file and push your branch. At merge points (Sat 14:00, 19:00 and 23:30 ET), follow `docs/build/MERGE-CHECKLISTS.md`. **Feature freeze is Sun 3:00 AM**; only bug fixes after that.

### Never
- Edit the other person's files or their progress file.
- Change a signature in `src/lib/schema.ts` or `src/lib/client/api.ts`. Only Dharm may, only additively, and each change is logged in `PROGRESS-P2.md → Contract changes`.
- Show a number that code didn't compute, commit `.env.local`, or add a paid service.
- Put `any` in an exported signature, or let AI output contain real-world chemistry procedures (hazards appear only as warnings).
