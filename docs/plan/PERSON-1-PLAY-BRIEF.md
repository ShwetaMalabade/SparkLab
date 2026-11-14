# PERSON 1 · PLAY — Brief for your coding LLM
*(Paste this whole file as the first message to your LLM. Attach: `00`, `02`, `04`, `05`, `07`, `13`, and `tested-code/data/fixtures/worksheet.json`.)*

---

## Who you are and what we're building
You are the coding partner of **Person 1 (PLAY)** on a 2-person HackPrinceton team (Nov 13–15, 2026, main track: Best Education Hack).

**Homework Arena:** a student snaps a physics/chemistry worksheet; AI agents turn it into a 3D lab played **seated, with the hands, through the laptop webcam** (MediaPipe Pose, on-device). The forearm aims a cannon; a clap mixes two chemicals; wrong answers replay the correct science in 3D. An AI coach picks the next question after every answer. The teacher watches live on their phone.

**Your half:** everything on the camera and the 3D canvas: **motion system, 3D scene, game loop, templates, and the Play page.** Person 2 (BRAIN) owns the AI, backend, database and the other pages.

**Stack:** Next.js (App Router, TypeScript), React Three Fiber + drei + postprocessing, `@mediapipe/tasks-vision` (Pose Landmarker lite), Zustand, Tailwind, Framer Motion. Chrome on a laptop.

## Hard rules
1. **Only create or edit files inside your paths:** `src/motion/**`, `src/three/**`, `src/game/**`, `src/app/play/**`, `public/mediapipe-wasm/`, `public/models/`, `public/sfx/`, `tests/fixtures/`, `tests/gestures.test.ts`. If you think another file needs a change, **stop and tell me**; I'll ask Person 2.
2. **Talk to the backend only through `src/lib/client/api.ts`** (Person 2's file, signatures frozen; see `13 §3`). Never call `fetch` yourself. Its functions never throw: `postAttempt` queues offline, `nextStep` falls back to code after 6 s.
3. **You may import (never edit) Person 2's helpers:** `src/lib/speak.ts` (Web Speech), `src/lib/chem.ts` (`isBalanced`, `sameSpecies`, `withCoefficients` for the Balancer).
4. **Types come from `src/lib/schema.ts`** (`TWorksheet`, `TQuestion`, `TAttempt`). Don't redefine them. Read `question.template`, `question.params`, `question.choices`, `question.reaction`, `question.equation` from the real schema.
5. **Never show a number that code didn't compute.** Choice texts come from the worksheet as is. Physics in the Launcher uses the exact equations in `05 §2`.
6. **Every gesture has a keyboard twin** (`04 §7`). The demo must never block on the camera. `N` skips to the next step at any time.
7. **Geometry in pixel space** (`04 §4`): multiply landmark `x` by video width and `y` by video height *before* any angle or distance math. On 640×480, normalized math turns a real 45° into 53°.
7. Camera frames never leave the browser.
8. Work one task at a time. For each: list the files you'll touch, write the code, tell me how to test it in < 2 minutes.

## Contracts you code against
- `src/lib/client/api.ts`: `createSession`, `postAttempt`, `nextStep`, `endSession`, `getWorksheet`, `getClassCode` (signatures in `13 §3`). **Until Merge 1 they're mocks** that use `data/fixtures/worksheet.json`.
- **Fixture:** `data/fixtures/worksheet.json` has `q1` projectile_launcher (speed locked, choices 17.7 / 35.3✓ / 70.6 / 20.4 m), `q2` answer_balloons, `q3` mix_lab (Pb(NO₃)₂ + KI → yellow PbI₂, with `reaction.visual`), `q4` equation_balancer (2H₂ + O₂ → 2H₂O).
- **Your internal event bus** (`src/motion/types.ts`): `{ type: "hover"|"dwell"|"bothUp"|"clap"|"lean"|"fire"|"lost"|"found", side?, targetId?, t }`. Templates subscribe; they don't read landmarks (except the Avatar and the Launcher's live θ / power).
- **Attempt you build at LOCK-IN** = `TAttempt` fields (`02 §6`): `classCode, sessionId, worksheetId, questionId, questionOrigin, chosen, chosenText, correct, misconceptionId, msToAnswer, input, hoverTrace, experiments, mixTries, balancerSteps`.

## Tasks by phase (times ET; see `13 §5`)

### Phase 0 · Sat 9:00–10:00 — warm-up
- [ ] P0.1 Read `04` and `05` fully. Wait for Person 2's scaffold push (~9:30), then pull.
- [ ] P0.2 Scratch page `src/app/play/dev/page.tsx`: webcam (640×480, mirrored), Pose Landmarker lite (GPU, fall back to CPU), draw landmarks. **Test:** skeleton follows you at ~30 fps.
- [ ] P0.3 Debug overlay (`D` key): landmarks, reach box, `sw`, θ, power, steady timer, fps, last 5 events.

### Phase 1 · 10:00–14:00 — foundations
- [ ] P1.1 `src/motion/gestures.ts` + `smoothing.ts`: pixel space, EMA α 0.4, reach-box hand cursors, **hover** (for the hover trace), **dwell 800 ms**, **bothUp**, **clap**, **lean**, tracking lost/found, cooldowns (`04 §6`). Keyboard twins (`04 §7`).
- [ ] P1.2 Seated calibration (`04 §5`), including the framing/aim check and the `sw / videoWidth` limits. Checklist UI: Head · Shoulders · Left hand · Right hand. "Start" click also unlocks speech.
- [ ] P1.3 `src/three/Arena.tsx`: navy `#0B1020` stage, fog, glowing floor grid, `Environment`, `ContactShadows`, one Bloom pass (`07 §1`).
- [ ] P1.4 `src/three/Avatar.tsx` (upper-body stick robot from landmarks) + `HandCursor.tsx` with the dwell ring.
- [ ] P1.5 `src/game/templates/AnswerBalloons.tsx` (`05 §5`): 4 balloons, middle 50% of the screen height, freeze while hovered, pick by dwell or lean + bothUp, keys 1–4.
- [ ] P1.6 `src/game/store.ts` + `GameRunner.tsx` (`05 §1`): INTRO → PLAY → LOCK-IN (`postAttempt` then `nextStep`) → REVEAL (speak the option's `why` + caption; then the coach's `feedback` if it arrived) → NEXT. Score rules. Pause on lost. `N` skip. Template runtime check → fall back to Balloons.
- [ ] P1.7 Play page `src/app/play/[wsId]/page.tsx`: `getWorksheet(wsId)` → calibrate → `createSession` → GameRunner → `endSession` → go to `/results/[sessionId]`.
- **Done when:** with the fixture, you can calibrate and finish the 4 questions as Balloons using **only gestures**, and again using **only the keyboard**.

### ⛳ MERGE 1 · 14:00 (with Person 2, checklist `13 §6`)

### Phase 2 · 14:30–19:00 — core templates
- [ ] P2.1 `ProjectileLauncher.tsx` (`05 §2`): field 0–100 m with markers every 10 m; **forearm** (elbow→wrist) θ, clamp 5°–85°; power hand → speed 5 + p·25 m/s; honour `params.lock` (speed or angle locked, HUD 🔒); **hold-steady 1.2 s fires** (ignore the locked control; needs θ ≥ 10°); `bothUp` ignored while aiming; analytic trajectory `x = v cosθ t`, `y = v sinθ t − ½gt²`, every flight ~2.5 s on screen; glowing trail + landing label; up to 3 test shots → `experiments[]` (incl. `landedM`); then Balloons. Reveal: real shot lands on the flag; if a wrong numeric choice was picked, a dashed coral **ghost trail** lands at that value.
- [ ] P2.2 `MixLab.tsx` (`05 §3`): 4 beakers (2 reactants from `question.reaction.reactants` + up to 2 decoys from `question.params.decoys`; if none, show only 2 beakers); dwell to attach one per hand; **clap armed only when both hands hold a beaker**; play `reaction.visual` (bubbles ≤ 300 instanced, precipitate color falling, color lerp 1.5 s, heat glow/frost, flame); balanced equation slides in; **hazard card** if `reaction.hazard`; record `mixTries`; then Balloons.
- [ ] P2.3 Effects: `Bubbles`, `Precipitate`, `Trail`, `Confetti` in `src/three/effects/`.
- [ ] P2.4 Variant badge: questions with `origin: "variant"` show "🧠 New question from your coach" on the INTRO card.
- **Done when:** the fixture's q1 and q3 play end to end by gesture; v = 20, θ = 30° lands at 35.3 m; θ = 45° goes farthest.

### ⛳ MERGE 2 · 19:00 (checklist `13 §6`; decides if Phase 3 includes the Balancer)

### Phase 3 · 19:30–23:30 — complete
- [ ] P3.1 **If Merge 2 green:** `EquationBalancer.tsx` (`05 §4`): balance scale, CPK atom spheres, `[−] n [+]` dwell buttons (≥ 160 px), per-element counters, "Check" (bothUp/Enter); subscript trap checked **before** `isBalanced`; balanced but not simplest (`4, 2, 4`) → "Balanced! Now simplify"; record `balancerSteps`. **If red:** polish Launcher + Mix Lab instead.
- [ ] P3.2 AI trace drawer (`T` key / 🧠 button, `05 §7`): shows the coach's `reason`, `source`, `ms`, `rejected[]` per step.
- [ ] P3.3 Sounds (pop, fizz, whoosh, correct, wrong), transitions, reduced-motion toggle.
- [ ] P3.4 Recorded-landmark fixtures (`04 §10`) in `tests/fixtures/*.json` + `tests/gestures.test.ts` (drinking water → 0 claps, etc.).

### ⛳ MERGE 3 · 23:30 — full demo on the deploy

### Phase 4 · Sun 0:00–3:00 — harden
- [ ] P4.1 ≥ 30 fps in Mix Lab with pose on (cut in this order: particles → Environment → bloom).
- [ ] P4.2 3-person gesture test + 2 lighting setups (`09 §3` motion list). Fix thresholds, not the rules.
- [ ] P4.3 Fix every bug from the Merge 3 demo run.
- **3:00 AM: FEATURE FREEZE.** After this, bug fixes only.

### Phase 5 · 3:00–7:30 — ship
- [ ] Rehearse the `11 §2` demo 3× (you drive the keyboard backup while Person 2 talks, or swap).

## When you're unsure
Prefer the simplest version that keeps the demo safe (keyboard twin, fallback, skip). Ask me before adding any dependency. Don't build anything listed as cut in `13 §1`.
