# PROGRESS-P2.md — Dharm · BRAIN
**Written ONLY by Dharm's LLM.** Shweta's LLM reads this at the start of every task.
Statuses: ⬜ todo · 🟦 doing · ✅ done · ⛔ blocked · ✂️ cut

**Last updated:** Sat 13:20 · **Now working on:** — (Phase 4 code done; waiting for Dharm: Atlas network access, live replay recording, backup video, P2-20 decision) · **Branch:** main

## ⚠️ Alerts (top-priority things the partner or Dharm must see)
- (none)

## Tasks
| ID | Task | Status | Commit | Note (1 line) |
|---|---|---|---|---|
| P2-01 | Repo + scaffold | ✅ | 51f045a | Next 16.4 + Tailwind v4 (no tailwind.config; tokens go in globals.css @theme). Build + lint green. Pushed to github.com/ShwetaMalabade/SparkLab `main` |
| P2-02 | Design tokens + layout | ✅ | 2d04bbf | Tokens in globals.css @theme (bg-cyan, text-muted, bg-panel…); Space Grotesk + Inter; mode pill reads getMode() from src/lib/client/mode.ts |
| P2-03 | Paste the tested code | ✅ | 4abe446 | 86/86 PASS lines (verify's own summary prints "55 passed": its 8 regression checks log separately). db.ts = no-op stub until P2-07 |
| P2-04 | Contracts + fixture + mocks | ✅ | 5407174 | api.ts + types.ts exactly as CONTRACTS §2, mock mode; fixture q1 launcher · q2 balloons · q3 mix lab · q4 balancer; speak.ts; results stub |
| P2-05 | Accounts + quota | ⛔ | 080fcad | Code done (scripts/test-ai.ts). Atlas ✓. Gemini key ✓, test-ai `{"ok":true}` on both: vision gemini-3.5-flash (~9 s; 3.7/3.8-flash were 503/timeouts today), fast gemini-3.5-flash-lite (~1 s). Still waiting on Dharm: real RPM/RPD from AI Studio, Vercel env vars |
| P2-06 | Business + demo worksheet | ⛔ | 4ecb6bf | Drafts in PERI.md. Waiting on Dharm: contact 3 targets, get a real worksheet, print ×3 with the 34.0 key typo |
| P2-07 | Database | ✅ | 0809611 | db.ts (Mongo, cached client, indexes) + memoryDb.ts (OFFLINE=1), same Store interface; classCode.ts. 32 checks vs local Mongo + memory. aggregateClass comes with P2-15 |
| P2-08 | Agents 1 + 2 | 🟦 | 108515b | prompts.ts (verbatim from 03 §4) + reader.ts + designer.ts done. Still to do: test the prompts on 3 real worksheet photos (needs a Gemini key) |
| P2-09 | Scan pipeline + `/api/ingest` | 🟦 | c340337 | ingest.ts + route + resizeImage done; 25 checks with fake agents + curl. Done-when (printed sheet → flagged worksheet ≤ 25 s) needs a Gemini key |
| P2-10 | Core routes | ✅ | 6d147bd | class, session, session/[id]/end, attempt, worksheet/[id] GET+PATCH (code-only re-check from saved drafts). 32 HTTP checks on Mongo |
| P2-11 | Landing + Scan pages | ✅ | e981eee | Landing: class on load, QR → /live/<code>, budget picker, Use last scan. Scan: drop/webcam/phone, live steps ≥ 0.6 s, → /play/<wsId>. Checked in Chrome |
| P2-12 | Coach `/api/next` | 🟦 | ae7ad55 | Code done: coach.ts + route; 22 scripted-coach checks + HTTP on Mongo (fallback ~130 ms). Still to do: try the Director prompt on a real model (needs key) |
| P2-13 | Real `nextStep` in `api.ts` | ✅ | f157cd0 | All api.ts calls have a live path (NEXT_PUBLIC_MOCK=0); nextStep 6 s abort → browser fallback; postAttempt queue + 5 s retry. 19 live checks |
| P2-14 | Review page | ✅ | 6bc7a64 | /review/[wsId]: cards, plain-words flags, AI-named mistakes, edit → code recompute (PATCH), remove (PATCH remove:true). Scan + Use last scan now go here. Checked in Chrome |
| P2-15 | Class stats `GET /api/class/[code]` | ✅ | ed3f5d9 | ClassStats via $facet (Mongo) / JS (memory), first attempt per student per question; coachFeed from decision rows. 15 checks per store + identical output |
| P2-16 | Live phone page `/live/[code]` | 🟦 | 61cc03a | Polls 2 s, no toasts on first load, toast + vibrate for real answers only (0.8 s locally), grid/mistakes/bars/coach feed. Done-when needs a deploy: real phone on venue Wi-Fi + cellular |
| P2-17 | Teacher insight | ✅ | 15421cf | insight.ts + POST /api/class/[code]/insights + phone card "✓ numbers checked". numbersAllowed on bullets, nextMove and groups; unknown nicknames dropped; cache 20 s (longer if the class is unchanged). 21 scripted checks. Real-model wording check needs a key |
| P2-18 | Results page | ✅ | 23aa53c | Score (first answer per question), accuracy by topic, top mistake + why, time played, coach note + its questions, Play again. GET /api/session/[id]/results; mock/offline-network → this device's record. 19 checks + Chrome (mock) |
| P2-19 | TTL indexes | ✅ | dd7ab13 | 24 h TTL on createdAt for classes, sessions, attempts, aiCalls (worksheets kept for "Use last scan"). Confirmed on Atlas: all 4 TTL indexes + the query indexes exist |
| P2-20 | Classmates | ⬜ | | |
| P2-21 | Peri + domain | ⬜ | | |
| P2-22 | Offline mode | ✅ | 4401929 | OFFLINE=1: memory store seeded from data/replay/seed.json (worksheet + "replay" alias); unrecorded photo → recorded scan (labelled); coach reuses the recorded decision for the same answer, code-checked, else fallback. 17 checks + OFFLINE build/start. Wi-Fi-off run is P2-23 |
| P2-23 | Record a replay | 🟦 | afb0a2a | scripts/export-replay.ts <CLASS> → data/replay/aiCalls.json + seed.json; 14 round-trip checks (live run → export → offline coach follows it). Still to do: play one demo in live mode, export, Wi-Fi-off test (needs Atlas network access fixed) |
| P2-24 | Backup video + Devpost draft | 🟦 | ff27ff5 | DEVPOST.md drafted from 10 §4, "4 AI agents + code checks", only built features claimed; [TODO]s for links/GIFs/Peri. Still to do by Dharm: record the 2-min backup video (11 §2) |
| P2-25 | Ship | ⬜ | | |

## Requests to Shweta
<!-- Things you need changed in THEIR files. Format: - [ ] R-P2-1 · what you need · why · which task waits on it -->
- (none)

## Answered requests (from Shweta)
<!-- - R-P1-1 → done in <commit> -->
- (none)

## Contract changes (schema.ts / api.ts) — additive only
- **Contracts frozen at 5407174.** `src/lib/client/{api,types}.ts` match CONTRACTS §2. Any later change is additive and listed here.

## Notes for the partner
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
