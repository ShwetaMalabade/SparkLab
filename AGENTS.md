# AGENTS.md — Read this first (every coding LLM, every session)

> Put this file at the **repo root** as `AGENTS.md` (Cursor and most coding agents load it automatically). Also copy it to `CLAUDE.md` if you use Claude Code. Everything else lives in `docs/`.

You are a coding LLM on a **2-person HackPrinceton team** building **Homework Arena** (snap a physics/chemistry worksheet → AI agents turn it into a 3D lab played seated with your hands via the webcam → an AI coach picks the next step → the teacher watches live on their phone; **AI writes, code checks every number**).

> **Who's who:** **Dharm** = BRAIN (task IDs `P2-xx`, `docs/build/P2-TASKS.md`, `PROGRESS-P2.md`, branches `p2/*`) · **Shweta** = PLAY (task IDs `P1-xx`, `docs/build/P1-TASKS.md`, `PROGRESS-P1.md`, branches `p1/*`). Address work by name; the `P1`/`P2` prefixes are just stable IDs.

## Step 1 · Find out who you are
The human will start the session with **"You are Dharm"** or **"You are Shweta"** (or "I'm Dharm" / "I'm Shweta"). If they didn't, **ask before doing anything.**

| | Shweta · **PLAY** | Dharm · **BRAIN** |
|---|---|---|
| Builds | Motion tracking, 3D scene, game loop, templates, Play page | AI agents, verification, API routes, MongoDB, Landing/Scan/Review/Results/Live pages, offline replay, deploy |
| Your task list | `docs/build/P1-TASKS.md` | `docs/build/P2-TASKS.md` |
| **Your** progress file (you write it) | `docs/build/PROGRESS-P1.md` | `docs/build/PROGRESS-P2.md` |
| **Other** progress file (read only) | `docs/build/PROGRESS-P2.md` | `docs/build/PROGRESS-P1.md` |

## Step 2 · At the start of every session (and every new task)
1. `git pull origin main` (and your own branch).
2. Read, in order: `docs/build/RULES.md` → `docs/build/CONTRACTS.md` → **your** task file → **both** progress files.
3. From the **other** person's progress file, note: what's done, what they're doing, any **Requests to you**, any **contract changes**. Tell the human in 3 lines: *"Partner is on X. Done since last time: Y. They need from us: Z."*
4. Pick the next task in your task file whose **Waits on** items are all ✅ in the right progress file. If a dependency isn't done, say so and pick the next unblocked task (or use the mock/fixture the task names).

## Step 3 · While working a task
- Touch **only** the paths your task file allows (`RULES.md §2`). Need a change elsewhere? Add it to **Requests to the other person** in **your** progress file and code against the current version.
- Before writing code, tell the human: task ID, files you'll create/edit, how you'll test it.
- Follow the plan section the task cites (`docs/plan/NN-*.md §n`). The plan is the spec; don't invent features. Never build anything marked **CUT**.

## Step 4 · When a task is done
1. Run its **Done when** test (and `npx tsx tests/*.test.ts` if you touched `src/lib`).
2. Commit: `P1-07: arena stage + bloom` (task ID first).
3. Update **your** progress file: status ✅, commit hash, 1-line note, anything the partner should know.
4. Commit the progress file, push your branch. At merge points, follow `docs/build/MERGE-CHECKLISTS.md`.

## Never
- Edit the other person's files or their progress file.
- Change a signature in `src/lib/schema.ts` or `src/lib/client/api.ts` (Dharm only, and only additively, logged in `PROGRESS-P2.md → Contract changes`).
- Show a number that code didn't compute. Commit `.env.local`. Add a paid service.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
