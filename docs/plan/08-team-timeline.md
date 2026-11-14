# 08 · Team Split & Timeline

> ⚠️ **Superseded for the 2-person team by `13-two-person-build-plan.md`.** Kept for reference.
**Owner:** all (Dharm assigns names to A–D) · **Depends on:** 00–07

All times ET. Devpost **due Sun 8:15 AM**; we submit by **7:30 AM**. Judging Sun 9:30 AM.

**Head start:** the verification code (`chem.ts`, `verifyPhysics.ts`, `assemble.ts`, `schema.ts`, the coach's `applyDirector`, `ai.ts`) is already written and tested in `03`. C pastes it and runs the tests in hour 1 instead of writing it.

## 1. Roles

| Role | Person | Owns files | Builds |
|---|---|---|---|
| **A · 3D/Game lead** | ____ | 05 | R3F arena, avatar, all templates, GameRunner, AI trace drawer |
| **B · Motion lead** | ____ | 04, 06 (phone UI) | MediaPipe, gestures, hover trace, calibration, fixtures; then `coach.ts` client and the live phone page UI |
| **C · AI/Backend lead** | ____ | 02, 03, 06 (API) | `ai.ts`, ingest + repair, all routes, Mongo + memory DB, coach API, classmates, insights, warm-up, deploy, replay export |
| **D · Product/Content lead** | ____ | 01, 07, 10, 11 | **Writes and tests all 7 prompts in AI Studio**, gets a real worksheet, Scan/Review/Landing/Results/Print UI, Peri business, Devpost, video |

**Claude** makes decisions and answers questions in #hack-project. **Grok** does research and checks.

## 2. Timeline

| Block | A · 3D/Game | B · Motion | C · AI/Backend | D · Product/Content |
|---|---|---|---|---|
| **Sat 12–2 AM** (now) | Read 00, 02, 05 | Read 00, 04, 06 | Read 00, 02, 03; create GitHub repo (public, after Fri 8 PM ✓), Atlas Free cluster, Vercel project | Read 00, 01, 03 §4, 07, 10; list 3 tutoring centers / teachers to contact |
| **Sat 2–8:30 AM** | **Sleep** | **Sleep** | **Sleep** | **Sleep** |
| **Sat 9–11 AM** | Next.js app, R3F arena (floor, lights, bloom), routing; Landing creates the class + shows the QR | Webcam + MediaPipe, debug overlay, seated calibration with aim test, pixel-space math | `test-ai.ts`; paste `03` code; run `09 §2` tests (must be 55 + 10 + 8 passing); `db.ts` + `memoryDb.ts`; `/api/class` | **Check the real free-tier quota for both models in AI Studio (K2 decision by 11 AM)**; test Agent 1 + 2 prompts on 3 real photos; get a real worksheet with an answer key; Figma frames; contact 3 Peri businesses by 10 AM |
| **11 AM–2 PM** | Upper-body avatar; Answer Balloons; GameRunner loop using the code fallback only | Gesture engine: hover, dwell, bothUp, clap, lean, keyboard twins; record fixtures | `/api/ingest` with NDJSON steps + repair loop; `/api/worksheet/[id]` PATCH (code-only recompute) | Scan screen (live agent steps) + Review screen (flags, editable numbers) |
| **2–6 PM** | **P1 Projectile Launcher** (field scale, lock, trail, ghost trail) | Forearm θ + power p + hold-steady; protractor test with 3 people | `/api/session`, `/api/attempt`, **`/api/next` (coach)** with `applyDirector` + logging | Test the coach prompt on recorded attempts (good/bad traces); Peri visit or call: demo, quote, feedback (`10 §3`) |
| **6–9 PM** | **C1 Mix Lab** (AI reaction visual, decoys, hazard card) | `coach.ts` (6 s abort + local fallback); conflict rules; tracking-lost pause; fixture tests passing | `/api/class/[code]` aggregation, **classmates**, **insights** + number check, TTL indexes | Live phone page with B; Results screen |
| **9 PM–12 AM** | **C2 Equation Balancer**; AI trace drawer | Phone page polish; help wire gestures into Balancer + Mix Lab | End-to-end on Vercel: photo → play → coach variant → phone updates; Critic in background; **warm-up API if the 9 PM sync is green** | Print page; Devpost draft; architecture diagram ("7 agents + code checks") |
| **Sun 12–3 AM** | Polish: transitions, confetti, camera moves | Stretch S1 (standing) **only if** `09 §3` all pass | **Record one full demo in live mode → `scripts/export-replay.ts`**; test offline mode | **Record the backup demo video (2 min)** before 3 AM |
| **3 AM** | **FEATURE FREEZE** | | | |
| **3–6 AM** | Bug fixes only | Bug fixes; venue lighting test | Bug fixes; env on Vercel; offline check with Wi-Fi off; quota check | Final Devpost text, README, `PERI.md`, prize selections |
| **6–7:30 AM** | Rehearse demo 3× | Rehearse | Rehearse | **Submit Devpost by 7:30 AM** |
| **7:30–9:30 AM** | Sleep 1 h / eat | | Charge laptops, print the worksheet ×3 | Rehearse Q&A (`11 §4`) |

## 3. Sync points (15 min each, in #hack-project)
| Time | Check |
|---|---|
| Sat 11 AM | Pose running; AI smoke test passes; `03` tests pass; **quota decision made (K2)**; real worksheet in hand |
| Sat 2 PM | Balloons playable by gesture; ingest returns a verified worksheet for the real photo, with steps streaming |
| Sat 6 PM | Launcher demo-able; attempts reach Mongo; the coach picks the next question (or falls back) |
| Sat 9 PM | Mix Lab demo-able; phone view updating with classmates and coach decisions |
| Sun 12 AM | Full demo path works end to end on the deploy, including one live coach variant. **If not, cut Balancer polish; never cut the coach, code checks, the live view or offline mode** |
| Sun 3 AM | Freeze. Replay recorded. Backup video exists |

## 4. Cut order (if behind)
Cut from the top first: stretch S1–S6 → warm-up writer (Wow #3) → Critic for physics questions (keep it for chemistry) → AI trace drawer polish (keep a plain list) → Balancer subscript trap → Mix Lab decoys (2 beakers only) → classmates (show only the live student) → Launcher ghost trail → coach personal feedback line (keep the option's `why`).
*Never cut:* code verification, the coach with its fallback, keyboard twins, offline replay, Live Teacher View polling, backup video.
