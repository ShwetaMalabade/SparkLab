# RULES.md — How both LLMs work together

> **Who's who:** **Dharm** = BRAIN (task IDs `P2-xx`, `docs/build/P2-TASKS.md`, `PROGRESS-P2.md`, branches `p2/*`) · **Shweta** = PLAY (task IDs `P1-xx`, `docs/build/P1-TASKS.md`, `PROGRESS-P1.md`, branches `p1/*`). Address work by name; the `P1`/`P2` prefixes are just stable IDs.

## 1. Repo layout for docs
```
AGENTS.md                 # entry point (also copy as CLAUDE.md)
docs/
  plan/                   # the full plan set v3.2 (00–13 + PERSON briefs). The SPEC. Read-only for both
  build/
    RULES.md              # this file
    CONTRACTS.md          # shared interfaces (owned by Dharm)
    P1-TASKS.md           # Shweta tasks, in order
    P2-TASKS.md           # Dharm tasks, in order
    PROGRESS-P1.md        # written ONLY by Shweta's LLM
    PROGRESS-P2.md        # written ONLY by Dharm's LLM
    MERGE-CHECKLISTS.md   # done together at 14:00, 19:00, 23:30
```

## 2. File ownership (no overlap)
| Owner | Paths |
|---|---|
| **Shweta** | `src/motion/**`, `src/three/**`, `src/game/**`, `src/app/play/**`, `public/mediapipe-wasm/**`, `public/models/**`, `public/sfx/**`, `tests/fixtures/**`, `tests/gestures.test.ts`, `docs/build/PROGRESS-P1.md` |
| **Dharm** | everything in `src/lib/**` (incl. `client/`), `src/app/api/**`, `src/app/page.tsx`, `src/app/{scan,review,results,live}/**`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `next.config.*`, `data/**`, `scripts/**`, `tests/{verify,assemble,director}.test.ts`, `.env.example`, `README.md`, `PERI.md`, `docs/build/PROGRESS-P2.md`, `docs/build/CONTRACTS.md` |
| **Shared (careful)** | `package.json` + lockfile: one dependency per commit, pull first. On conflict, keep both lists and run `npm i` |

Shweta may **import** (never edit) from Dharm: `@/lib/schema`, `@/lib/client/api`, `@/lib/client/types`, `@/lib/speak`, `@/lib/chem`.

## 3. Git
- `main` auto-deploys to Vercel. Work on branches `p1/<task-id>` or `p2/<task-id>`.
- Merge your own branch into `main` whenever a task is ✅ and the app still builds (`npm run build`). Small and often beats big merges.
- **Pull `main` before every task.** If the other person's progress shows a contract change, pull before coding against it.
- Commit message: `<TASK-ID>: <what>` e.g. `P2-09: ingest NDJSON stream + repair loop`.

## 4. Progress file protocol
Each person's LLM updates **its own** progress file after every task (and when blocked). The format is fixed (see the files). Statuses: `⬜ todo` · `🟦 doing` · `✅ done` · `⛔ blocked` · `✂️ cut`.
- **Requests to the other person** go in your own file, never theirs. The other LLM reads them at the start of every task.
- When you fulfil a request from the other person, mark it in **your** file under "Answered requests" with the commit hash.
- Keep notes to 1 line. Put the *why* in the commit message.

## 5. Dependencies
Every task lists **Waits on** (task IDs, either person) and **Unblocks**. If you're waiting:
1. Check the other progress file. 2. If not done, use the named fallback (fixture, mock, stub). 3. Never wait idle; take the next unblocked task.

## 6. Quality bar
- TypeScript strict, no `any` in exported signatures.
- Every gesture has a keyboard twin. The demo never blocks on the camera or the network.
- AI output is validated with Zod draft schemas and built with `assemble()`. Numbers come from code.
- After touching `src/lib/**`: `npx tsx tests/verify.test.ts && npx tsx tests/assemble.test.ts && npx tsx tests/director.test.ts` must stay **86/86**.

## 7. Time rules (ET)
Merge 1 **Sat 14:00** · Merge 2 **19:00** · Merge 3 **23:30** · **FEATURE FREEZE Sun 3:00 AM** (bug fixes only after) · Devpost submit by **7:30 AM**.
If a task runs > 1.5× its estimate, tell the human and propose the cut in `docs/plan/13 §7`.
