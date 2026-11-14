# PROGRESS-P2.md — Dharm · BRAIN
**Written ONLY by Dharm's LLM.** Shweta's LLM reads this at the start of every task.
Statuses: ⬜ todo · 🟦 doing · ✅ done · ⛔ blocked · ✂️ cut

**Last updated:** Sat 15:22 · **Now working on:** — (labs-only server side done; waiting for Dharm's go: README/Devpost rewrite) · **Branch:** main

## ⚠️ Alerts (top-priority things the partner or Dharm must see)
- **Chemistry-only, labs-only (Dharm's call, Sat ~14:00 and ~15:30):** every question is a hands-on lab, **no answer balloons**, clean modern lab look. Labs: Titration, Mystery Sample, Reaction Yield, Mix Lab, Balancer. Spec: `docs/build/LAB-SPEC.md`. Contract additive (ea3f6e9, e4b2099). Requests R-P2-1..3 below.

## Tasks
| ID | Task | Status | Commit | Note (1 line) |
|---|---|---|---|---|
| P2-01 | Repo + scaffold | ✅ | 51f045a | Next 16.4 + Tailwind v4 (no tailwind.config; tokens go in globals.css @theme). Build + lint green. Pushed to github.com/ShwetaMalabade/SparkLab `main` |
| P2-02 | Design tokens + layout | ✅ | 2d04bbf | Tokens in globals.css @theme (bg-cyan, text-muted, bg-panel…); Space Grotesk + Inter; mode pill reads getMode() from src/lib/client/mode.ts |
| P2-03 | Paste the tested code | ✅ | 4abe446 | 86/86 PASS lines (verify's own summary prints "55 passed": its 8 regression checks log separately). db.ts = no-op stub until P2-07 |
| P2-04 | Contracts + fixture + mocks | ✅ | 5407174 | api.ts + types.ts exactly as CONTRACTS §2, mock mode; fixture q1 launcher · q2 balloons · q3 mix lab · q4 balancer; speak.ts; results stub |
| P2-05 | Accounts + quota | ⛔ | 080fcad | Atlas ✓ (Network Access 0.0.0.0/0). Gemini ✓: vision + fast = gemini-3.5-flash-lite, backup gemini-3.1-flash-lite (3.5/3.8-flash timed out or 503'd today). Still waiting on Dharm: real RPM/RPD from AI Studio, Vercel env vars (+ GEMINI_MODEL_BACKUP) |
| P2-06 | Business + demo worksheet | ⛔ | 4ecb6bf | Drafts in PERI.md. Waiting on Dharm: contact 3 targets, get a real worksheet, print ×3 with the 34.0 key typo |
| P2-07 | Database | ✅ | 0809611 | db.ts (Mongo, cached client, indexes) + memoryDb.ts (OFFLINE=1), same Store interface; classCode.ts. 32 checks vs local Mongo + memory. aggregateClass comes with P2-15 |
| P2-08 | Agents 1 + 2 | 🟦 | b3f1ee4 | Real model ✓ on a generated printed sheet: reader 3–9 s, all 4 questions, key typo read. Designer prompt/validation fixed for real output (b3f1ee4). Still to do: 3 real worksheet photos |
| P2-09 | Scan pipeline + `/api/ingest` | ✅ | b3f1ee4 | Done-when ✓ with real Gemini + Atlas: printed sheet → 4 verified questions + answer_key_mismatch:34->35.3 in 15.7–26 s (4 runs, nothing dropped) |
| P2-10 | Core routes | ✅ | 6d147bd | class, session, session/[id]/end, attempt, worksheet/[id] GET+PATCH (code-only re-check from saved drafts). 32 HTTP checks on Mongo |
| P2-11 | Landing + Scan pages | ✅ | e981eee | Landing: class on load, QR → /live/<code>, budget picker, Use last scan. Scan: drop/webcam/phone, live steps ≥ 0.6 s, → /play/<wsId>. Checked in Chrome |
| P2-12 | Coach `/api/next` | ✅ | b3f1ee4 | Real model ✓: 1–4.5 s; after a wrong answer it writes a code-verified new question 6/6 (fixed: it never saw the draft format). Timeouts fall back as designed |
| P2-13 | Real `nextStep` in `api.ts` | ✅ | f157cd0 | All api.ts calls have a live path (NEXT_PUBLIC_MOCK=0); nextStep 6 s abort → browser fallback; postAttempt queue + 5 s retry. 19 live checks |
| P2-14 | Review page | ✅ | 6bc7a64 | /review/[wsId]: cards, plain-words flags, AI-named mistakes, edit → code recompute (PATCH), remove (PATCH remove:true). Scan + Use last scan now go here. Checked in Chrome |
| P2-15 | Class stats `GET /api/class/[code]` | ✅ | ed3f5d9 | ClassStats via $facet (Mongo) / JS (memory), first attempt per student per question; coachFeed from decision rows. 15 checks per store + identical output |
| P2-16 | Live phone page `/live/[code]` | 🟦 | 61cc03a | Polls 2 s, no toasts on first load, toast + vibrate for real answers only (0.8 s locally), grid/mistakes/bars/coach feed. Done-when needs a deploy: real phone on venue Wi-Fi + cellular |
| P2-17 | Teacher insight | ✅ | 15421cf | insight.ts + POST /api/class/[code]/insights + phone card "✓ numbers checked". numbersAllowed on bullets, nextMove and groups; unknown nicknames dropped; cache 20 s (longer if the class is unchanged). 21 scripted checks. Real model ✓ (1–2 s, labels not ids) |
| P2-18 | Results page | ✅ | 23aa53c | Score (first answer per question), accuracy by topic, top mistake + why, time played, coach note + its questions, Play again. GET /api/session/[id]/results; mock/offline-network → this device's record. 19 checks + Chrome (mock) |
| P2-19 | TTL indexes | ✅ | dd7ab13 | 24 h TTL on createdAt for classes, sessions, attempts, aiCalls (worksheets kept for "Use last scan"). Confirmed on Atlas: all 4 TTL indexes + the query indexes exist |
| P2-20 | Classmates | ⬜ | | Deferred by Dharm: do later (gated on Merge 2). DEVPOST.md adds it as a 5th agent only if it ships |
| P2-21 | Peri + domain | ⬜ | | |
| P2-22 | Offline mode | ✅ | 4401929 | OFFLINE=1: memory store seeded from data/replay/seed.json (worksheet + "replay" alias); unrecorded photo → recorded scan (labelled); coach reuses the recorded decision for the same answer, code-checked, else fallback. 17 checks + OFFLINE build/start. Wi-Fi-off run is P2-23 |
| P2-23 | Record a replay | 🟦 | afb0a2a | scripts/export-replay.ts <CLASS> → data/replay/aiCalls.json + seed.json; 14 round-trip checks (live run → export → offline coach follows it). Still to do: play one demo in live mode, export, Wi-Fi-off test (needs Atlas network access fixed) |
| P2-24 | Backup video + Devpost draft | 🟦 | ff27ff5 | DEVPOST.md drafted from 10 §4, "4 AI agents + code checks", only built features claimed; [TODO]s for links/GIFs/Peri. Still to do by Dharm: record the 2-min backup video (11 §2) |
| P2-25 | Ship | ⬜ | | |
| P2-26 | Chemistry labs: chemistry code | ✅ | 519404f | Chemistry-only pivot (plan agreed with Dharm). acidBase.ts (titration pH by charge balance, end point, curve, indicator colors) + ions.ts (20 compounds × 5 tests, look-alike distractors). 52 textbook checks |
| P2-27 | Chemistry labs: contract + assemble | ✅ | ea3f6e9 | Templates titration_lab / mystery_sample; optional titration/mystery on questions, titrationLog/testsUsed on attempts; code cross-checks the AI's titration formula (mole ratio). 66 checks in tests/chem-labs.test.ts |
| P2-28 | Chemistry labs: prompts + chemistry fixture | ✅ | a0f46fe | Chemistry-only prompts with titration/mystery fields; fixture q1 titration · q2 mystery · q3 mix · q4 balancer · q5 stoichiometry. Real scan of a printed chemistry sheet: 3/3 in 10–14 s, all labs built, key typo 31→30.0 mL flagged. Coach titration variant verified by code (24.0 mL) |
| P2-29 | Labs only + Reaction Yield Lab + lab spec | ✅ | e4b2099 | No balloons: no-lab questions get one reader repair, then dropped; coach can't serve one. stoich.ts (molar masses, g→mol→ratio→g/mol/mL) + stoich_lab; code writes heavy-metal warnings. Real scan: 5/5 labs in ~11 s. docs/build/LAB-SPEC.md for Shweta (62a6103) |

## Requests to Shweta
<!-- Things you need changed in THEIR files. Format: - [ ] R-P2-1 · what you need · why · which task waits on it -->
- [ ] R-P2-1 · **Read `docs/build/LAB-SPEC.md` first** (Dharm's decision: chemistry only, every question a lab, **no answer balloons**, clean modern lab look). Then build the **lab bench + Titration Lab** (§1–3). · The showcase · by ~20:30
- [ ] R-P2-2 · **Mystery Sample** (LAB-SPEC §4) · second deep lab · by ~23:00 (Merge 3)
- [ ] R-P2-3 · **Reaction Yield Lab** (§5) + move Mix Lab / Balancer onto the bench (§6) · stoichiometry needs a lab now · before the 3 AM freeze
- Fixture `/play/fixture` has one question per lab: q1 titration · q2 mystery · q3 mix · q4 balancer · q5 reaction yield (`stoich`).

## Answered requests (from Shweta)
<!-- - R-P1-1 → done in <commit> -->
- (none)

## Contract changes (schema.ts / api.ts) — additive only
- **e4b2099 (additive):** Template += `stoich_lab`; `TQuestion.stoich?` (Reaction Yield Lab). The server no longer sends `answer_balloons`.
- **ea3f6e9 (additive):** Template += `titration_lab`, `mystery_sample`; `TQuestion.titration?` / `TQuestion.mystery?` (optional, nullable); `Attempt.titrationLog?` / `Attempt.testsUsed?` (optional). New importable helpers: `@/lib/acidBase` (`phAt`, `indicatorColor`, `INDICATORS`), `@/lib/ions` (`TESTS`). Details in CONTRACTS §1, §4, §6. Nothing existing changed.
- **Contracts frozen at 5407174.** `src/lib/client/{api,types}.ts` match CONTRACTS §2. Any later change is additive and listed here.

## Notes for the partner
- **Fixture changed (P2-28):** q1 is now a titration and q2 a mystery (no more launcher/friction); q3 Mix Lab and q4 Balancer are identical (your 71 gesture tests pass), q5 is stoichiometry balloons. `/play/dev/variant` copies q1, so it now shows a titration variant.
- **Real coach questions now arrive (b3f1ee4).** With the real model, a wrong answer usually gets a coach-written question: `origin: "variant"`, ids like `q1v1`, `q4v2`; it can be any template (seen: launcher and balancer). Your P1-15 badge path is the one that runs.
- **Results page is real (P2-18).** Keep navigating to `/results/<sessionId>` after `endSession()`; it reads the server in live mode and this device's record in mock mode. "Play again" goes to `/play/<the wsId you played>`.
- **Live mode is ready, still off by default.** `NEXT_PUBLIC_MOCK=0` (at build time) switches api.ts to the real routes. Signatures unchanged. `/play/fixture` still loads the fixture in live mode; a real scan's `/play/<wsId>` loads from the server. We flip it at Merge 1.
- **Merged your p1/P1-11 into main** (Dharm asked), plus a lint ignore for `public/mediapipe-wasm/**` (MediaPipe's generated JS caused 532 lint problems). Your bundle concern: checked the real Next build, and mathjs is in **no** client chunk.
- **/api/next skip handling:** the server remembers the last question it served; a call with no attempt after it marks that question skipped, so it won't be offered again.
- **Coach variants** live on the session (`session.variants`), not in `worksheet.questions`, so `getWorksheet()` never includes them; they only arrive through `nextStep()`.
- **Landing → Review → Play:** Landing stores the class code (`getClassCode()`) and the time budget; `createSession()` picks the budget up automatically if you don't pass one. Scan and "Use last scan" now open `/review/<wsId>`, whose ▶ Play button goes to `/play/<wsId>`.
- **Real routes exist** (`/api/class`, `/api/session`, `/api/session/[id]/end`, `/api/attempt`, `/api/worksheet/[id]`, `/api/ingest`), but `api.ts` still runs the mocks until Merge 1. Nothing changes for you.
- **Using the mock API:** open `/play/fixture` (any wsId returns the fixture). On every lock-in call `postAttempt(a)` **and** `nextStep({ sessionId, attemptId: null, attempt: a })` together; `nextStep` works out what's played from saved attempts plus the inline one. Both never throw. `source` is always `"fallback"` until the real coach (P2-13).
- **`/play/[wsId]` with Cache Components:** the dynamic param is runtime data. Read it inside `<Suspense>` (server `page.tsx` wraps a client child that calls `useParams()`), or the build fails. See `src/app/results/[sessionId]/`.
- **Repo is live: https://github.com/ShwetaMalabade/SparkLab** (`main`). Scaffold + tokens + tested code are in → **P1-01 is unblocked**. **P2-04 is done (5407174) → P1-09 is unblocked** once this is pushed.
- Scaffold is **Next.js 16.4** (not 15). Read `node_modules/next/dist/docs/` before Next-specific code; `cacheComponents: true` is on. Empty `.gitkeep` folders exist for all your paths.

## Merge log
| Merge | Time | Result | Notes |
|---|---|---|---|
| Merge 1 | Sat 14:00 | | |
| Merge 2 | Sat 19:00 | | |
| Merge 3 | Sat 23:30 | | |
