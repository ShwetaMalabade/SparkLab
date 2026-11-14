# PERSON 2 · BRAIN — Brief for your coding LLM
*(Paste this whole file as the first message to your LLM. Attach: `00`, `02`, `03`, `06`, `07`, `09`, `10`, `11`, `13`, and the `tested-code/` folder.)*

---

## Who you are and what we're building
You are the coding partner of **Dharm (BRAIN)** on a 2-person HackPrinceton team (Nov 13–15, 2026, main track: Best Education Hack; sponsor targets: Amazon Best Practical AI, MLH Gemini, MLH MongoDB, Peri, GoDaddy domain).

**Homework Arena:** a student snaps a physics/chemistry worksheet; **AI agents write the game, code checks every number**; the student plays seated with their hands in 3D (Shweta builds that); an AI coach picks the next step after each answer and can write a brand-new question aimed at the student's mistake; the teacher (the judge) watches it live on their phone.

**Your half:** AI agents, verification, backend routes, MongoDB, the contract file Shweta uses, every non-3D page (Landing, Scan, Review, Results, Live phone view), offline replay mode, and the deploy. Plus the non-code jobs: quota check, Peri business, demo worksheet, Devpost.

**2-person scope (`13 §1`, final):** Agents **1** Reader-Solver, **2** Mistake Modeler + Level Designer, **4** Director/coach, **6** Teacher Insight. Agent **5** classmates only if Merge 2 is green. Agents **3** Critic and **7** Warm-up are **cut**: don't build them.

**Stack:** Next.js App Router + TypeScript on Vercel (Hobby), `@google/genai` (Gemini; two models: `GEMINI_MODEL_VISION` for Agent 1, `GEMINI_MODEL_FAST` for the rest), Bedrock switch kept (`AI_PROVIDER`), MongoDB Atlas Free (`mongodb` driver), Zod 3, mathjs, `qrcode`, Tailwind.

## Hard rules
1. **Only edit your paths:** `src/lib/**` (incl. `client/`), `src/app/api/**`, `src/app/page.tsx`, `src/app/{scan,review,results,live}/**`, `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `data/**`, `scripts/**`, `tests/{verify,assemble,director}.test.ts`. Shweta owns `src/motion`, `src/three`, `src/game`, `src/app/play`.
2. **`src/lib/schema.ts` and `src/lib/client/api.ts` are the contract.** Ship them in Phase 0. After that, **signatures are frozen**: adding optional fields is fine; renaming or removing needs Shweta's OK.
3. **Paste the tested code, don't rewrite it:** `schema.ts, chem.ts, verifyPhysics.ts, assemble.ts, ai.ts, replay.ts, agents/director.ts` from `tested-code/`. Run its tests in hour 1: **86 must pass** (`verify` 63, `assemble` 10, `director` 13).
4. **AI writes, code checks.** No number reaches a student or teacher unless code computed or checked it. AI drafts are validated with the *draft* schemas (`ReadOut`, `DesignOut`), never the final `Question` schema; `assemble()` builds the final question.
5. **Zero spend.** No card on any account unless Dharm approves (`12` K2). Each teammate uses their own AI Studio key for dev.
6. **Server sets `createdAt: new Date()`** (BSON Date) on every insert; TTL indexes need Dates.
7. Simulated data is always labelled. No real-world chemistry procedures anywhere.
8. Work one task at a time: list the files, write the code, give a < 2-minute test.

## Tasks by phase (times ET; see `13 §5`)

### Phase 0 · Sat 9:00–10:00 — scaffold + contracts (Shweta waits on you: push by 9:30)
- [ ] P0.1 Public GitHub repo; `create-next-app` with TS, Tailwind, App Router, `src/`; install deps (`02 §3`); `.env.example`; folder skeleton (`02 §5`, minus the cut agents).
- [ ] P0.2 Design tokens in Tailwind + `globals.css` (`07 §1`: navy `#0B1020`, cyan `#22D3EE`, magenta `#E879F9`, lime `#A3E635`, coral `#FB7185`); Space Grotesk + Inter in `layout.tsx`; LIVE / OFFLINE pill.
- [ ] P0.3 Paste the `tested-code/` files; `npx tsx tests/*.test.ts` → **86 pass**.
- [ ] P0.4 Run `scripts/make-fixture.ts` → `data/fixtures/worksheet.json` (already generated in `tested-code/`, regenerate to be sure).
- [ ] P0.5 **`src/lib/client/api.ts` with mock implementations** (signatures in `13 §3`): `getWorksheet` returns the fixture; `createClass` returns a random 4-char code; `postAttempt` stores in `localStorage`; `nextStep` uses `fallbackNext` (next unplayed question). **Push. Tell Shweta.**
- [ ] P0.6 **AI Studio quota check** for both models (RPM / RPD). Post the numbers in #hack-project. If ~15 calls/demo × ~20 demos won't fit, **flag Dharm by 11 AM** (K2: Amazon credits or billing with a hard cap).
- [ ] P0.7 Atlas Free cluster + user + IP access; Vercel project linked to `main`; env vars on Vercel; `scripts/test-ai.ts` returns `{"ok":true}`.

### Phase 1 · 10:00–14:00 — scan pipeline + core routes
- [ ] Shweta.1 **10:00: contact 3 Peri businesses** (tutoring centers / STEM programs / a teacher), script in `10 §3`. Get a real worksheet with an answer key if you can. **Print the demo worksheet with one deliberate key typo (34.0 instead of 35.3).**
- [ ] Shweta.2 `db.ts` (cached `MongoClient` on `globalThis`) + `memoryDb.ts` (same interface, for `OFFLINE=1`); `aiCalls` logging; indexes.
- [ ] Shweta.3 Prompts for Agents 1 + 2 (`03 §4`): test them in AI Studio on 3 real photos first, then in code.
- [ ] Shweta.4 `src/lib/ingest.ts` + `/api/ingest` (`03 §5`): browser resize (`resizeImage.ts`, ≤ 1600 px JPEG) → Agent 1 → code verify → Agent 2 → `assemble()` → repair loop (max 2) → save; **NDJSON step stream**; `maxDuration = 60`; links the class to the worksheet.
- [ ] Shweta.5 Routes: `/api/class` (POST), `/api/session` (POST), `/api/session/[id]/end`, `/api/attempt` (Zod, ≤ 10 KB, pushes to `session.played`), `/api/worksheet/[id]` (GET; PATCH re-runs code checks only, no AI).
- [ ] Shweta.6 Pages: **Landing** (creates the class → QR ≥ 220 px + class code, time budget choice, "Scan" / "Use last scan"); **Scan** (drag-drop / webcam snapshot / phone upload; live agent steps from the NDJSON stream; ≥ 0.6 s per step on screen).
- **Done when:** the printed worksheet photo → verified worksheet in Mongo with the `answer_key_mismatch` flag, in ≤ 25 s.

### ⛳ MERGE 1 · 14:00 (with Shweta, checklist `13 §6`)
Switch `api.ts` to real calls for everything except `nextStep`. Deploy.

### Phase 2 · 14:30–19:00 — coach + Live Teacher View
- [ ] Dharm.1 Agent 4 prompt (`03 §9`) tested on recorded good/bad attempts in AI Studio.
- [ ] Dharm.2 `/api/next` (`03 §9`): build context (worksheet, played, last attempt incl. hover trace) → Agent 4 → `applyDirector` (limits + **variant goes through `assemble()`**) → log to `aiCalls` → return `NextStep`. First call (no attempt): coach may only choose `next`.
- [ ] Dharm.3 Switch `api.ts` `nextStep` to real: **AbortController 6 s → `fallbackNext`**, never throws; sends `attempt` inline if the attempt POST is still queued.
- [ ] Dharm.4 **Review** page: one card per question, flags (⚠️ "key says 34.0, code says 35.3"), editable numbers → PATCH (code recompute), delete, "Play" → `/play/[wsId]`.
- [ ] Dharm.5 `/api/class/[code]` `ClassStats` aggregation (`06 §4`, `$facet`, first attempt per student per question, join sessions; `ofStudents` counts only students who answered).
- [ ] Dharm.6 **Live phone page** `/live/[code]` (`06 §2–3`): mobile-first 390 px; polls every 2 s; **first poll records the time, no toasts**; toasts + `navigator.vibrate(80)` for new non-simulated attempts; student grid; top mistakes; per-question bars; **coach feed** (latest `reason`s).
- **Done when:** on a real phone, each answer shows up in ≤ 3 s, and a coach decision appears in the feed.

### ⛳ MERGE 2 · 19:00 (checklist `13 §6`; green → Phase 3 includes classmates)

### Phase 3 · 19:30–23:30 — insights, results, business
- [ ] P3.1 Agent 6 `/api/class/[code]/insights` (`03 §11`): computed stats only; **`numbersAllowed` on every bullet** (failures replaced by the code-built line); cached 20 s; "✓ numbers checked" tag on the phone.
- [ ] P3.2 **Results** page: score, accuracy per topic, top mistake, time played.
- [ ] P3.3 TTL indexes (24 h) on `classes`, `sessions`, `attempts`, `aiCalls`.
- [ ] P3.4 **If Merge 2 green:** Agent 5 classmates `/api/class/[code]/simulate` (`03 §10`, `06 §5`): 4 students, AI badge, "Hide simulated" toggle, spread timestamps, no toasts.
- [ ] P3.5 Peri visit/call: quote, photo (with permission), **one change we made because of them** → `PERI.md`.
- [ ] P3.6 Register the GoDaddy domain (MLH code).

### ⛳ MERGE 3 · 23:30 — full 2-minute demo on the Vercel URL, twice

### Phase 4 · Sun 0:00–3:00 — safety nets
- [ ] P4.1 Offline mode (`02 §4`): `OFFLINE=1` → `memoryDb` + `askJSON` serves `data/replay/*.json`; coach with no recorded match → code fallback.
- [ ] P4.2 Play one full demo in live mode → `scripts/export-replay.ts` → test the whole flow with **Wi-Fi off** on the demo laptop (`next start`), live view in a second window.
- [ ] P4.3 **Record the 2-minute backup video.**
- [ ] P4.4 Devpost draft (`10 §4`, updated: "4 AI agents + code checks").
- **3:00 AM: FEATURE FREEZE.**

### Phase 5 · 3:00–7:30 — ship
- [ ] Bug fixes only; final Devpost, README (setup, `.env.example`, architecture, the `$facet` aggregation and `aiCalls` log for MLH MongoDB), `PERI.md`, prize selections; **submit by 7:30 AM** (deadline 8:15). Rotate keys after the event.

## When you're unsure
Simplest safe version first: code fallback, cached result, mock/replay. Don't build cut items. If Shweta asks for a contract change, prefer adding an optional field over changing an existing one.
