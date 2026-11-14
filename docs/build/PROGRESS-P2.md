# PROGRESS-P2.md — Dharm · BRAIN
**Written ONLY by Dharm's LLM.** Shweta's LLM reads this at the start of every task.
Statuses: ⬜ todo · 🟦 doing · ✅ done · ⛔ blocked · ✂️ cut

**Last updated:** Sat 02:45 · **Now working on:** — (P2-05 next, waiting for Dharm's go) · **Branch:** main

## ⚠️ Alerts (top-priority things the partner or Dharm must see)
- (none)

## Tasks
| ID | Task | Status | Commit | Note (1 line) |
|---|---|---|---|---|
| P2-01 | Repo + scaffold | ✅ | 51f045a | Next 16.4 + Tailwind v4 (no tailwind.config; tokens go in globals.css @theme). Build + lint green. Pushed to github.com/ShwetaMalabade/SparkLab `main` |
| P2-02 | Design tokens + layout | ✅ | 2d04bbf | Tokens in globals.css @theme (bg-cyan, text-muted, bg-panel…); Space Grotesk + Inter; mode pill reads getMode() from src/lib/client/mode.ts |
| P2-03 | Paste the tested code | ✅ | 4abe446 | 86/86 PASS lines (verify's own summary prints "55 passed": its 8 regression checks log separately). db.ts = no-op stub until P2-07 |
| P2-04 | Contracts + fixture + mocks | ✅ | 5407174 | api.ts + types.ts exactly as CONTRACTS §2, mock mode; fixture q1 launcher · q2 balloons · q3 mix lab · q4 balancer; speak.ts; results stub |
| P2-05 | Accounts + quota | ⛔ | 080fcad | Code done (scripts/test-ai.ts). Waiting on Dharm: AI Studio keys + model names + real RPM/RPD, Atlas cluster, Vercel project + env vars |
| P2-06 | Business + demo worksheet | ⬜ | | |
| P2-07 | Database | ⬜ | | |
| P2-08 | Agents 1 + 2 | ⬜ | | |
| P2-09 | Scan pipeline + `/api/ingest` | ⬜ | | |
| P2-10 | Core routes | ⬜ | | |
| P2-11 | Landing + Scan pages | ⬜ | | |
| P2-12 | Coach `/api/next` | ⬜ | | |
| P2-13 | Real `nextStep` in `api.ts` | ⬜ | | |
| P2-14 | Review page | ⬜ | | |
| P2-15 | Class stats `GET /api/class/[code]` | ⬜ | | |
| P2-16 | Live phone page `/live/[code]` | ⬜ | | |
| P2-17 | Teacher insight | ⬜ | | |
| P2-18 | Results page | ⬜ | | |
| P2-19 | TTL indexes | ⬜ | | |
| P2-20 | Classmates | ⬜ | | |
| P2-21 | Peri + domain | ⬜ | | |
| P2-22 | Offline mode | ⬜ | | |
| P2-23 | Record a replay | ⬜ | | |
| P2-24 | Backup video + Devpost draft | ⬜ | | |
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
