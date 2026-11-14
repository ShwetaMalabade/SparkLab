# 12 · Risks, Fallbacks & Open Research
**Owner:** all · Claude updates §3 as research lands

---

## 1. Risk register

| # | Risk | Likelihood | Trigger (how we notice) | Fallback (exact action) | Owner |
|---|---|---|---|---|---|
| K1 | Gestures flaky in the judging hall | Medium | Calibration > 5 s or false triggers | Seated default; move the lamp; keyboard twins; test at the venue Sat night | B |
| K2 | **Gemini free-tier quota too small for heavy AI** (~300 calls/day on the fast model, plus the coach's per-minute rate) | **High** | AI Studio's quota page Sat 9 AM; 429s in `aiCalls` | (1) Split load across the two models (already in the plan). (2) "Use last scan" for repeat demos. (3) Warm-up only on request. (4) **Decision for Dharm by Sat 11 AM if the limits are too low:** ask the Amazon booth for Bedrock credits (then run agents 2–7 on Bedrock, which also strengthens the Amazon prize), or enable Gemini billing with a hard spend cap (breaks the zero-spend rule, so only with Dharm's OK). Don't create extra projects to get around limits | C, Dharm |
| K3 | Agent 1 misreads the photo | Medium | < 4/5 correct in `09 §3` | Review screen edits (code recomputes instantly); flat page, good light; demo with the tested printout | C, D |
| K4 | AI writes a wrong formula or a false chemistry claim | Medium | Code errors in `aiCalls`; Critic blocks | Repair loop (max 2); drop the question with a note; the Critic hides blocked questions; never auto-correct a formula | C |
| K5 | Coach too slow (> 6 s) | Medium | `ms` in `aiCalls` | Client fallback to the next unplayed question; the call runs during the 4–6 s reveal; the fast model only | C, B |
| K6 | Coach loops on variants or finishes too early | Low | Trace shows repeated variants | Code limits: ≤ 3 variants per session, ≤ 2 per mistake, none in the last 20 s, no early finish | C |
| K7 | Coach's variant fails code checks | Medium | `rejected` in the response | Fallback question; show the rejection in the trace (it's a feature: "code caught it") | C |
| K8 | Scan too slow on Vercel | Medium | > 25 s | Review opens after Agent 2; Critic and classmates run in background; `maxDuration = 60` (Hobby allows up to 60 s on older projects, 300 s with Fluid compute); client aborts at 45 s → "Use last scan" | C |
| K9 | Upload too big | Low | 413 | Browser resize to ≤ 1600 px JPEG; server cap 1.5 MB (Vercel's body limit is 4.5 MB) | C |
| K10 | Venue Wi-Fi down | Medium | Pages don't load | Phone hotspot; offline build with replay on the demo laptop; live view in a second window | C, D |
| K11 | Judge's phone can't open the live view | Medium | Stuck loading > 10 s | Second laptop's live view; keep the demo moving | D |
| K12 | Atlas Free connection cap | Low | "too many connections" | Cached `MongoClient` on `globalThis`; 2 s polling | C |
| K13 | Low fps with bloom + pose | Low–Medium | < 30 fps on the overlay | Halve particles → drop Environment → lower bloom (05 §8) | A |
| K14 | Speech doesn't play | Low | Silent reveal | Needs the Start click first; captions always on | A |
| K15 | Scope creep (heavy AI adds work) | High | Stretch work before `09 §3` passes | Freeze at 3 AM; cut order in `08 §4` | All |
| K16 | No Peri business responds | Medium | No reply by 1 PM Sat | Teacher we know as fallback; be honest with judges | D |
| K17 | Simulated classmates look like fake data | Medium | Judge asks | AI badge always on, presenter says "simulated" first, toggle to hide them | D |
| K18 | Demo order unpredictable (the coach decides) | Medium | Rehearsal runs differ | Script reads the screen; `N` skips; "2-min tour" budget makes the coach favor variety | D, B |
| K19 | Replay misses (offline, coach input differs) | Medium | Offline run uses fallbacks | Expected: the fallback keeps the game going; record the replay from the exact demo path | C |
| K20 | AI-generated chemistry includes something unsafe | Low | Critic block / blocklist | Prompts forbid procedures; code blocklist drops the question; hazard text is a warning only | C, D |

## 2. Never-break rules
1. The demo always has a no-camera, no-network route (keyboard + offline replay + backup video).
2. No card on any cloud account without Dharm's OK (K2).
3. No real-world chemistry instructions anywhere in the UI, prompts or outputs.
4. No number reaches a student or a teacher unless code computed or checked it.
5. Simulated data is always labelled.

## 3. Open research (status)

| # | Question | Status | Answer / next step |
|---|---|---|---|
| R1 | Gemini free tier: current Flash and Flash-Lite model names, RPM/RPD, latency on a ~500 KB image | ⏳ **Check Sat 9 AM in AI Studio** | Google no longer publishes per-model free-tier numbers on its rate-limits page; third-party reports describe cuts in Dec 2025 and Apr 2026. Limits are per project, per model. Treat the real numbers in your AI Studio quota page as the truth; feeds K2 |
| R2 | Vercel Hobby: max duration and body limit | ✅ | With Fluid compute: 300 s default and max. Older projects without Fluid: 10 s default, 60 s max. `maxDuration = 60` works either way. Body limit 4.5 MB |
| R3 | Change streams on Atlas Free? | ✅ | Supported (namespace filters can use only strings and regexes). We still poll, because Vercel functions time out |
| R4 | MediaPipe Hand vs Pose for seated use | ⏳ | Stay on Pose unless its wrists are unreliable at 0.6–1.2 m |
| R5 | Exact prize rules: Amazon, Peri, MLH | ⏳ partly | Amazon text (as shared from Devpost): prototype/demo, clear use case and user, basic docs, pitch; LLMs, APIs, agent frameworks and Amazon platforms are all allowed. Re-read the final text Sat morning |
| R6 | Past winners: worksheet-to-game, live teacher dashboards, adaptive AI tutors | ⏳ | kinemo (PennApps XXVI) is confirmed from earlier research; verify any other name before saying it to judges |
