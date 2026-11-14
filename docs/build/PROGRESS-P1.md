# PROGRESS-P1.md — Shweta · PLAY
**Written ONLY by Shweta's LLM.** Dharm's LLM reads this at the start of every task.
Statuses: ⬜ todo · 🟦 doing · ✅ done · ⛔ blocked · ✂️ cut

**Last updated:** Sat 03:45 · **Now working on:** live-camera checks for P1-01/04/06/07/11, then Merge 1 · **Branch:** p1/P1-11 (all Phase 0–1 commits, rebased on main 78355e5)

## ⚠️ Alerts (top-priority things the partner or Dharm must see)
- Phase 0–1 code is complete and `/play/fixture` runs end to end on the mock api (keyboard + mouse, verified in headless Chrome). The 🟦 rows only wait on Shweta's live-camera tests.

## Tasks
| ID | Task | Status | Commit | Note (1 line) |
|---|---|---|---|---|
| P1-00 | Read + wait for the scaffold | ✅ | — | Read 00, 04, 05, 07, 13, CONTRACTS; each task mapped to its plan section |
| P1-01 | Camera + Pose on a dev page | 🟦 | beefe17 | Code done, builds; pose WASM + model in /public (offline). Needs live-camera check: ≥ 25 fps |
| P1-02 | Debug overlay | ✅ | 41600fc | D toggles: landmarks, reach box, sw/swFrac, θ fore+full, p, steady, fps, last 5 events |
| P1-03 | Gesture engine core | ✅ | 41600fc | Pixel space, EMA 0.4, reach-box mirrored cursors; 32/32 synthetic tests (tests/gestures.test.ts) |
| P1-04 | Gestures: hover, dwell, bothUp, clap, lean, lost/found | 🟦 | 41600fc | All gestures + cooldowns + arming; synthetic tests pass. Needs live 9/10 + 1-min talking test |
| P1-05 | Keyboard twins + input tagging | ✅ | 41600fc | Every 04 §7 key; source tag → attempt input; full fixture run keyboard-only verified headless |
| P1-06 | Seated calibration | 🟦 | 091c0f4 | Checklist, 2 s body, distance hints, aim test, baseline, toggles, QR. Needs live ≤ 5 s test ×2 people |
| P1-07 | Arena | 🟦 | bd23847 | Stage + bloom render; Lightformer env (no CDN, offline-safe). Needs fps check with pose on demo laptop |
| P1-08 | Avatar + hand cursors | ✅ | bd23847 | Stick robot from engine.latest (no re-renders), cyan/magenta; 2D cursors with dwell ring |
| P1-09 | Game store + GameRunner | ✅ | 28e43db | Full loop on mock api: fixture q1→q4, attempts + NextStep in parallel, pause clock, N skip |
| P1-10 | Answer Balloons | ✅ | 28e43db | Dwell / lean+bothUp / 1–4 / click; hover trace; coral pop + lime glow + confetti |
| P1-11 | Play page | 🟦 | 28e43db | /play/fixture keyboard-only ✓ (headless). Needs the gesture-only run on a real camera |
| P1-12 | Projectile Launcher | ⬜ | | |
| P1-13 | Effects | ⬜ | | |
| P1-14 | Mix Lab | ⬜ | | |
| P1-15 | Variant badge + coach line | ⬜ | | |
| P1-16 | Equation Balancer | ⬜ | | |
| P1-17 | AI trace drawer | ⬜ | | |
| P1-18 | Polish | ⬜ | | |
| P1-19 | Recorded-landmark tests | ⬜ | | |
| P1-20 | Performance | ⬜ | | |
| P1-21 | People + lighting test | ⬜ | | |
| P1-22 | Freeze | ⬜ | | |

## Requests to Dharm
<!-- Things you need changed in THEIR files. Format: - [ ] R-P1-1 · what you need · why · which task waits on it -->
- (none)

## Answered requests (from Dharm)
<!-- - R-P2-1 → done in <commit> -->
- (none)

## Notes for the partner
- **Play URL:** `/play/<wsId>` (e.g. `/play/fixture`). Uses only `@/lib/client/api` + `@/lib/speak`; classCode = `getClassCode() ?? "TEST"`. Ends with `endSession` → `/results/<sessionId>`.
- **At lock-in** the game calls `postAttempt(a)` and `nextStep({ sessionId, attemptId: null, attempt: a })` together, as your note asked. On `N` (skip) it calls `nextStep({ sessionId })` with no attempt; the game keeps its own played list and never replays a worksheet question, so the real `/api/next` may return an already-played id safely.
- **Attempt fields:** `input` is honest (`gesture` / `keyboard` / `mouse`); `hoverTrace` is `{choice, ms}` from cursor or mouse hover ≥ 150 ms; `msToAnswer` excludes paused time.
- **Bus (Shweta-internal):** besides the 8 gesture types there's a `command` event for keyboard-only controls (pick 1–4, skip, pause, debug, trace, angle, power).
- **FYI, bundle:** `api.ts` imports `fallbackNext` from `agents/director`, which pulls `assemble` + mathjs into the Play page's client bundle. Not blocking; maybe worth splitting when you switch to real fetch.
- **Offline:** the arena doesn't use `<Environment preset="city">` (it downloads an HDR from a CDN); it lights with Lightformers instead.

## Merge log
| Merge | Time | Result | Notes |
|---|---|---|---|
| Merge 1 | Sat 14:00 | | |
| Merge 2 | Sat 19:00 | | |
| Merge 3 | Sat 23:30 | | |
