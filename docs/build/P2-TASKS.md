# P2-TASKS.md — Person 2 · BRAIN (AI, backend, pages, ship)
**You are Person 2's coding LLM.** Do these in order. Before each task: pull, read `PROGRESS-P1.md` (especially **Requests to Person 2**), check **Waits on**. After each: test, commit `P2-xx: …`, update `PROGRESS-P2.md`.
Spec: `docs/plan/02` (architecture), `03` (AI + verification), `06` (live view), `07` (UI), `10` (prizes), `11` (demo). Contracts you own: `docs/build/CONTRACTS.md`.
**2-person scope:** Agents 1, 2, 4, 6. Agent 5 only if Merge 2 is green. **Agents 3 (Critic) and 7 (Warm-up) are CUT.**

Allowed paths: `src/lib/**`, `src/app/api/**`, `src/app/page.tsx`, `src/app/{scan,review,results,live}/**`, `src/app/layout.tsx`, `src/app/globals.css`, `tailwind.config.ts`, `next.config.*`, `data/**`, `scripts/**`, `tests/{verify,assemble,director}.test.ts`, `.env.example`, `README.md`, `PERI.md`.

---

## PHASE 0 · Sat 9:00–10:00 — Person 1 is waiting on you: push P2-01…P2-04 by ~9:30

### P2-01 · Repo + scaffold (15 min) · Unblocks: P1-01
- Public GitHub repo (created after Fri 8 PM ✓). **Run `npx create-next-app@latest homework-arena --ts --tailwind --eslint --app --src-dir --import-alias "@/*"` in an EMPTY folder first** (it refuses to run in a folder that already has files), **then** unzip `homework-arena-repo-start.zip` into `homework-arena/` (adds `AGENTS.md`, `CLAUDE.md`, `docs/`).
- Deps (`docs/plan/02 §3`): `three @react-three/fiber @react-three/drei @react-three/postprocessing zustand zod@3 mathjs framer-motion qrcode @mediapipe/tasks-vision @google/genai mongodb @aws-sdk/client-bedrock-runtime`; dev: `@types/three @types/qrcode tsx typescript @types/node`.
- Check `AGENTS.md`, `CLAUDE.md`, `docs/plan/`, `docs/build/` are at the root. `.env.example` with every key from `02 §3` (blank). `.gitignore` has `.env.local`.
- Empty folders with `.gitkeep` for P1's paths so imports resolve.
- **Done when:** `npm run build` passes; pushed to `main`.

### P2-02 · Design tokens + layout (15 min)
- Tailwind colors (`docs/plan/07 §1`): navy `#0B1020`, cyan `#22D3EE`, magenta `#E879F9`, lime `#A3E635`, coral `#FB7185`, text `#E5E7EB`, muted `#94A3B8`. Space Grotesk + Inter via `next/font/google` in `layout.tsx`. Mode pill (LIVE / MOCK / OFFLINE · REPLAY) top-left, reading `getMode()`.

### P2-03 · Paste the tested code (15 min)
- Copy from `docs/plan/tested-code/`: `src/lib/{schema,chem,verifyPhysics,assemble,ai,replay}.ts`, `src/lib/agents/director.ts`, `tests/*.test.ts`, `scripts/make-fixture.ts`.
- Temporary `src/lib/db.ts` stub (exports `db` with no-op `log`) so `ai.ts` compiles; the real one is P2-07.
- **Done when:** `npx tsx tests/verify.test.ts && npx tsx tests/assemble.test.ts && npx tsx tests/director.test.ts` → **86 pass**.

### P2-04 · Contracts + fixture + mocks (20 min) · Unblocks: P1-09 and everything after
- `npx tsx scripts/make-fixture.ts` → `data/fixtures/worksheet.json` (q1 launcher, q2 balloons, q3 mix lab, q4 balancer).
- `src/lib/client/types.ts` + `src/lib/client/api.ts` **exactly** as `CONTRACTS.md §2`, with the **mock** behaviour. `nextStep` mock uses `fallbackNext`. `postAttempt` writes to `localStorage["ha:attempts"]`.
- `src/lib/speak.ts`: `speak(text)` + `warmVoices()` (`docs/plan/03 §13`).
- Stub `src/app/results/[sessionId]/page.tsx` ("Results coming soon" + score from localStorage).
- **Push, then post in `PROGRESS-P2.md`: "Contracts frozen at <hash>".**

### P2-05 · Accounts + quota (25 min)
- AI Studio: each person makes their own key. Note the **real RPM/RPD for the vision and fast models**. Estimated need: ~15 calls/demo × ~20 demos. If it won't fit → write `⚠️ K2 DECISION NEEDED` at the top of `PROGRESS-P2.md` and tell Dharm (decide by 11 AM: Amazon credits, or billing with a hard cap; don't add a card without his OK).
- Atlas Free cluster + DB user + network access; Vercel project from `main`; env vars on Vercel (`AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL_VISION`, `GEMINI_MODEL_FAST`, `MONGODB_URI`, `MONGODB_DB`).
- `scripts/test-ai.ts` → `{"ok":true}` (`docs/plan/03 §3`).

---

## PHASE 1 · 10:00–14:00

### P2-06 · Business + demo worksheet (30 min, non-code, the human does it; LLM drafts messages)
- 10:00: contact 3 Peri targets with the `docs/plan/10 §3` script. Ask for a real worksheet with an answer key.
- Print the demo worksheet with **one deliberate key typo** (34.0 instead of 35.3) ×3.

### P2-07 · Database (40 min)
- `src/lib/db.ts`: `MongoClient` cached on `globalThis`; collections `worksheets, classes, sessions, attempts, aiCalls` (`docs/plan/02 §6.3`); `db.log()` for `aiCalls`; indexes `attempts {classCode:1, createdAt:1}`, `sessions {classCode:1}`. **Server sets `createdAt: new Date()`.**
- `src/lib/memoryDb.ts`: same interface in memory, used when `OFFLINE=1`.
- `src/lib/classCode.ts`: 4 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.

### P2-08 · Agents 1 + 2 (60 min)
- Test the Reader-Solver and Mistake Modeler + Level Designer prompts (`docs/plan/03 §4`) in AI Studio on **3 real photos** first.
- `src/lib/prompts.ts`, `src/lib/agents/reader.ts` (vision model → `ReadOut`), `src/lib/agents/designer.ts` (fast model → `DesignOut`). Validate with the **draft** schemas, never the final `Question`.

### P2-09 · Scan pipeline + `/api/ingest` (75 min)
- `src/lib/resizeImage.ts` (client: ≤ 1600 px JPEG q 0.85; HEIC message) (`03 §2`).
- `src/lib/ingest.ts` (`03 §5`): Agent 1 → Agent 2 → `assemble()` per question → repair loop (max 2) → keep valid, drop the rest with a note → save worksheet → link class.
- `/api/ingest/route.ts`: multipart `file` (≤ 1.5 MB) + `classCode`; **NDJSON stream** of `{step,status,ms,detail}` then `{worksheet}`; `export const maxDuration = 60`. Critic step: **skip (cut)**.
- **Done when:** the printed worksheet → verified worksheet with `answer_key_mismatch` flag in ≤ 25 s.

### P2-10 · Core routes (40 min)
`/api/class` (POST), `/api/session` (POST → `{sessionId, timeBudgetSec}`), `/api/session/[id]/end` (POST), `/api/attempt` (POST, Zod, ≤ 10 KB, push `questionId` to `session.played`), `/api/worksheet/[id]` (GET; PATCH = edit `prompt`/`given` → re-run code checks only, no AI) (`docs/plan/02 §6.4`).

### P2-11 · Landing + Scan pages (50 min)
- **Landing** `src/app/page.tsx`: `createClass()` on load → store code in sessionStorage; **QR ≥ 220 px** to `/live/<code>` + the code; time budget picker ("2-min tour" / "10 min" / "Full worksheet"); buttons "Scan a worksheet" / "Use last scan".
- **Scan** `src/app/scan/page.tsx`: drag-drop, webcam snapshot, phone upload (`capture="environment"`); live agent steps from the NDJSON stream (each ≥ 0.6 s on screen); on done → `/review/<wsId>` (until P2-14: → `/play/<wsId>`).

**⛳ MERGE 1 · 14:00** → `MERGE-CHECKLISTS.md §1`. Before it: switch `api.ts` to **real** calls for everything except `nextStep`; deploy.

---

## PHASE 2 · 14:30–19:00

### P2-12 · Coach `/api/next` (75 min)
- Test the Director prompt (`docs/plan/03 §9`) in AI Studio on 2 recorded attempts (one with a hover switch).
- `/api/next/route.ts`: load session + worksheet + attempts; first call (no attempt) → coach may only choose `next`; call Agent 4 (fast model); `applyDirector` (limits; a variant goes through `assemble()`); log to `aiCalls` with `classCode`, `ms`, `rejected`; return `NextStep`.

### P2-13 · Real `nextStep` in `api.ts` (20 min) · Unblocks: P1-15 test with real variants
- `fetch('/api/next')` with **AbortController 6 s** → on timeout/error return `fallbackNext` locally; send `attempt` inline if the attempt POST is still queued. Never throws. Log contract unchanged.

### P2-14 · Review page (45 min)
`src/app/review/[wsId]/page.tsx`: card per question (template icon, prompt, editable given numbers → PATCH, ⚠️ flags in plain words e.g. "Key says 34.0 m, code says 35.3 m"), delete, **Play** → `/play/<wsId>`. Scan now routes here.

### P2-15 · Class stats `GET /api/class/[code]` (45 min)
`ClassStats` exactly as `docs/plan/06 §4` (`$facet`: first attempt per student per question; join sessions; `ofStudents` = students with ≥ 1 answer; `coachFeed` from `aiCalls` where `agent:"director"`); `Cache-Control: no-store`.

### P2-16 · Live phone page `/live/[code]` (75 min)
`docs/plan/06 §2–3`: mobile-first 390 px; poll every 2 s; **first poll records the time, no toasts**; later new non-simulated attempts → toast + `navigator.vibrate(80)`; student grid with ✓/✗; top mistakes with counts; per-question bars; coach decisions feed (reason + 🧠 when a variant was written or "code rejected").
- **Done when:** on a real phone over venue Wi-Fi *and* cellular, an answer shows up in ≤ 3 s.

**⛳ MERGE 2 · 19:00** → `MERGE-CHECKLISTS.md §2` (green → P2-20 is in).

---

## PHASE 3 · 19:30–23:30

### P2-17 · Teacher insight (Agent 6) (45 min)
`/api/class/[code]/insights` (`docs/plan/03 §11`): input = `ClassStats` + last 5 coach reasons; output `{bullets[3], groups[], nextMove}`; **`numbersAllowed` on every string** (fail → the code line `Top mistake: {label} ({n} of {N} students).`); cache 20 s per class; phone shows "✓ numbers checked".

### P2-18 · Results page (30 min)
Replace the stub: score, accuracy per topic, top mistake (label), time played, "Play again".

### P2-19 · TTL indexes (10 min)
24 h TTL on `createdAt` for `classes, sessions, attempts, aiCalls`.

### P2-20 · Classmates (Agent 5) (60 min) · **only if Merge 2 green**
`/api/class/[code]/simulate` (`docs/plan/03 §10`, `06 §5`): idempotent; 4 students; `simulated: true`; AI badge + "Hide simulated" toggle on the phone; timestamps spread over 20 min; no toasts.

### P2-21 · Peri + domain (non-code, 45 min)
Visit/call: demo, 1–2 quotes, photo with permission, **one change made because of them** → `PERI.md`. Register the GoDaddy domain (MLH code) and point it at Vercel.

**⛳ MERGE 3 · 23:30** → `MERGE-CHECKLISTS.md §3`

---

## PHASE 4 · Sun 0:00–3:00

### P2-22 · Offline mode (45 min)
`OFFLINE=1` → `memoryDb` + `askJSON` serves `data/replay/*.json`; coach with no recorded match → code fallback (`docs/plan/02 §4`). `getMode()` returns `"offline"`.

### P2-23 · Record a replay (30 min)
Play one full demo in live mode → `scripts/export-replay.ts` → `data/replay/`. Test the whole flow on the demo laptop with **Wi-Fi off** (`OFFLINE=1 npm run build && OFFLINE=1 npm start`), live view in a second window.

### P2-24 · Backup video + Devpost draft (45 min)
Record the 2-min video of the `docs/plan/11 §2` script. Devpost draft from `docs/plan/10 §4`, updated to "4 AI agents + code checks" (no Critic, no warm-up).

**3:00 AM · FEATURE FREEZE**

## PHASE 5 · 3:00–7:30
### P2-25 · Ship
Bug fixes only. README (setup, `.env.example`, architecture, the `$facet` aggregation + `aiCalls` log for MLH MongoDB), `PERI.md`, Devpost final with links (live URL, offline note, repo, video), prize selections (Education track; Amazon, MLH Gemini, MLH MongoDB, Peri, GoDaddy). **Submit by 7:30 AM.** Rotate keys after the event.
