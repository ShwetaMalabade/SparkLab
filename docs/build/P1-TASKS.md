# P1-TASKS.md — Shweta · PLAY (motion, 3D, game)
**You are Shweta's coding LLM.** Do these in order. Before each task: pull, read `PROGRESS-P2.md`, check **Waits on**. After each: test, commit `P1-xx: …`, update `PROGRESS-P1.md`.
Spec: `docs/plan/04` (motion), `05` (game), `07` (UI). Contracts: `docs/build/CONTRACTS.md`.

Allowed paths: `src/motion/**`, `src/three/**`, `src/game/**`, `src/app/play/**`, `public/{mediapipe-wasm,models,sfx}/**`, `tests/fixtures/**`, `tests/gestures.test.ts`.

---

## PHASE 0 · Sat 9:00–10:00

### P1-00 · Read + wait for the scaffold (20 min)
- Read `docs/plan/00`, `04`, `05`, `13`, `docs/build/CONTRACTS.md`.
- **Waits on:** P2-01 (repo), P2-04 (contracts + fixture) for imports. Until P2-01 is pushed (~9:30), only read and plan.
- **Done when:** you can list, for each Shweta task, which plan section it implements.

### P1-01 · Camera + Pose on a dev page (30 min) · Waits on: P2-01
- Copy MediaPipe assets (`docs/plan/02 §3`): `cp -r node_modules/@mediapipe/tasks-vision/wasm/* public/mediapipe-wasm/`; download `pose_landmarker_lite.task` to `public/models/`.
- `src/motion/pose.ts`: `createPose()` with GPU delegate, **fall back to CPU** if init throws; `startLoop(video, landmarker, onFrame)` returns a stop function (`docs/plan/04 §2`).
- `src/app/play/dev/page.tsx`: `getUserMedia({video:{width:640,height:480,facingMode:"user"}})`, mirrored `<video>`, canvas drawing the 33 points.
- **Done when:** skeleton follows you at ≥ 25 fps; works with Wi-Fi off (all assets local).

### P1-02 · Debug overlay (20 min)
- `src/motion/DebugOverlay.tsx`, toggled by `D`: landmarks + bones, reach box, `sw`, θ, power p, steady timer, fps, last 5 events with time.
- **Done when:** `D` toggles it on the dev page.

---

## PHASE 1 · 10:00–14:00

### P1-03 · Gesture engine core (45 min)
- `src/motion/types.ts` (event bus type, `CONTRACTS §5`), `src/motion/smoothing.ts` (EMA α = 0.4 per point).
- `src/motion/gestures.ts`: convert every landmark to **pixels first** (`x·videoWidth`, `y·videoHeight`, `docs/plan/04 §4`); compute `sw` = shoulder distance; **reach box** → mirrored screen cursors for each wrist (`04 §6`).
- Zustand slice in `src/game/store.ts`: `cursors {left,right}`, `events[]`, `emit(e)`, `subscribe(type, fn)`.
- **Done when:** two cursors follow your hands across the whole screen while seated ~0.8 m away.

### P1-04 · Gestures: hover, dwell, bothUp, clap, lean, lost/found (60 min)
- Rules, thresholds and cooldowns exactly as `docs/plan/04 §6` (dwell 800 ms with ring progress; bothUp both wrists above `nose.y − 0.2·sw` for 3 frames; clap `< 0.35·sw` after `> 1.2·sw` within 600 ms; lean `> 0.40·sw`; lost = key points `visibility < 0.5` for 500 ms).
- Targets register with `registerTarget(id, rect)`; dwell/hover report `targetId`.
- **Hover trace:** while a choice target is hovered, accumulate ms per choice (`hoverTrace` in the attempt).
- Conflict rules (`docs/plan/09 §4` / `04`): templates can `arm/disarm` gestures (e.g. clap disarmed until Mix Lab says so; bothUp disarmed while aiming).
- **Done when:** on the debug overlay each gesture fires ≥ 9/10 tries, and 1 minute of talking with your hands fires 0 claps / 0 bothUp.

### P1-05 · Keyboard twins + input tagging (20 min)
- `src/motion/keyboard.ts`: Enter = bothUp, C = clap, ←/→ = lean, ↑/↓ = angle ±1°, W/S = power, Space = fire, 1–4 = pick choice, N = skip, P = pause, D = debug, T = trace drawer (`04 §7`). Mouse click on a target = dwell.
- Every emitted event carries `source: "gesture" | "keyboard" | "mouse"` → becomes the attempt's `input`.
- **Done when:** the whole dev flow can be driven by keyboard only.

### P1-06 · Seated calibration (45 min)
- `src/game/Calibrate.tsx` (`docs/plan/04 §5`): head-and-shoulders silhouette, live checklist (Head · Shoulders · Left hand · Right hand), pass after 2.0 s with visibility > 0.6, save baseline (`sw`, `shMid`, nose y); distance hints using `sw / videoWidth` (v3 fix F12); framing/aim check (forearm visible when raised); Left-handed toggle; nickname field (max 16); **Start** button (also calls `warmVoices()` from `@/lib/speak` to unlock audio).
- **Done when:** calibration passes in ≤ 5 s for you and one other person.

### P1-07 · Arena (40 min)
- `src/three/Arena.tsx`: `<Canvas>`, navy `#0B1020` background, fog, glowing floor grid, `<Environment preset="city"/>`, `<ContactShadows/>`, one `<EffectComposer><Bloom intensity={0.8} luminanceThreshold={0.2}/></EffectComposer>` (`docs/plan/07 §1`, `05 §8`).
- **Done when:** the scene renders at ≥ 30 fps *with pose running*.

### P1-08 · Avatar + hand cursors (40 min)
- `src/three/Avatar.tsx`: upper-body stick robot (joints 0, 11–16) from smoothed landmarks, emissive cyan (physics) / magenta (chemistry) (`04 §9`).
- `src/three/HandCursor.tsx`: 2D overlay cursors with the dwell ring.
- **Done when:** the robot mirrors your arms smoothly.

### P1-09 · Game store + GameRunner (60 min) · Waits on: P2-04 (api mock + fixture)
- `src/game/store.ts` (extend): session, current question, phase (`intro|play|lockin|reveal|next|paused|end`), score, streak, played ids, last NextStep.
- `src/game/GameRunner.tsx` (`docs/plan/05 §1`): START → `nextStep({sessionId})` (first pick) → INTRO 3 s (read aloud with `speak`, caption, variant badge) → PLAY (template) → LOCK-IN: build `AttemptInput` (`CONTRACTS §6`), `postAttempt` then `nextStep` **in parallel with** REVEAL 4–6 s (speak the chosen option's `why`, then `Coach: <feedback>` if it arrived) → NEXT (bothUp/Enter or auto 6 s) → … → END: `endSession` → `router.push('/results/'+sessionId)`.
- Score: +100 correct, +50 if < 10 s, ×1.5 after 3 in a row. Pause on `lost` or P. `N` skips. Template runtime check → Balloons.
- Template registry: `templates/index.ts` maps `question.template` → component; unknown → `AnswerBalloons`.
- **Done when:** with the fixture, GameRunner walks q1→q4 (all as Balloons for now) using the mock `nextStep`.

### P1-10 · Answer Balloons (45 min)
- `src/game/templates/AnswerBalloons.tsx` (`docs/plan/05 §5`): 4 balloons, ≥ 220 px, ≥ 60 px apart, **middle 50% of screen height**, `<Float>` but frozen while hovered; pick by dwell, or lean to move highlight + bothUp; keys 1–4; wrong → coral burst + correct glows lime; correct → confetti. Calls `onLock({chosen, chosenText, correct, misconceptionId, hoverTrace})`.
- **Done when:** you can pick each balloon by gesture and by keys, and the attempt object is right (log it).

### P1-11 · Play page (30 min)
- `src/app/play/[wsId]/page.tsx`: `getWorksheet(wsId)` → Calibrate → `createSession({classCode: getClassCode() ?? "TEST", worksheetId, nickname})` → `<GameRunner/>` with Arena + Avatar + HUD (`docs/plan/07 §2–3`: question top, score left, mirrored mini-webcam right, gesture hints bottom, captions bar).
- **Done when:** `/play/fixture` runs the whole fixture by gesture **and** by keyboard only.

**⛳ MERGE 1 · 14:00** → `MERGE-CHECKLISTS.md §1` (with Dharm)

---

## PHASE 2 · 14:30–19:00

### P1-12 · Projectile Launcher (2 h)
`src/game/templates/ProjectileLauncher.tsx`, exactly `docs/plan/05 §2`:
- Field 0–100 m, markers every 10 m, 1 m = 0.1 world units; cannon left; hidden flag at `answer.value`.
- Aim with the **forearm** (elbow→wrist) in pixel space, θ clamped 5°–85°; power hand → `v = 5 + p·25`; honour `params.lock` (locked control shows 🔒 and the question's value; hold-steady **ignores the locked control**).
- **Fire:** hold steady 1.2 s (θ change < 3°, p change < 0.04, θ ≥ 10°) with a filling ring; Space twin. `bothUp` disarmed while aiming.
- Trajectory: `x = v cosθ t`, `y = v sinθ t − ½·9.81·t²`, time-scaled so every flight lasts ~2.5 s; glowing trail; landing label with distance; up to 3 shots → `experiments[] {thetaDeg, speed, landedM}`; skip after 3 shots or 20 s → Balloons phase with the question's choices.
- **Reveal:** fire with the question's real v and θ → lands on the flag; if the chosen wrong option is numeric, a dashed coral **ghost trail** (same θ, scaled) lands at that value with its misconception label.
- **Done when:** v = 20, θ = 30° lands at 35.3 m; 45° goes farthest; 30° and 60° land together.

### P1-13 · Effects (45 min)
`src/three/effects/{Bubbles,Precipitate,Trail,Confetti}.tsx`: instanced, ≤ 300 particles, props from `reaction.visual` (`docs/plan/05 §3`).

### P1-14 · Mix Lab (1 h 45 min)
`src/game/templates/MixLab.tsx`, `docs/plan/05 §3`:
- Beakers: the 2 reactants from `question.reaction.reactants` + up to 2 from `question.params.decoys` (none → 2 beakers), labelled with name + formula.
- Dwell a hand on a beaker → it attaches to that hand; dwell on the bench to put it back. **Clap is armed only when both hands hold a beaker.**
- Clap → pour animation → if the pair = the reactants: play `reaction.visual` (bubbles, precipitate color falling and settling, color lerp 1.5 s, heat glow / frost, flame); show `reaction.equation` color-coded; **hazard card** "Virtual only: <hazard>" if `reaction.hazard`. Other pair → "No visible reaction" + wobble, beakers return (max 2 tries). Record `mixTries`.
- Then Balloons with the question's choices.
- **Done when:** fixture q3 shows yellow PbI₂ raining down and the hazard card, by gesture and by keys.

### P1-15 · Variant badge + coach line (20 min)
- INTRO card shows "🧠 New question from your coach" when `question.origin === "variant"`. REVEAL shows/speaks `Coach: <feedback>` when present.
- **Done when:** a fake variant (copy of q1 with `origin:"variant"`) shows the badge.

**⛳ MERGE 2 · 19:00** → `MERGE-CHECKLISTS.md §2`. Its result decides P1-16.

---

## PHASE 3 · 19:30–23:30

### P1-16 · Equation Balancer (2 h) · **only if Merge 2 is green**, else spend the time on P1-12/14 polish
`src/game/templates/EquationBalancer.tsx`, `docs/plan/05 §4`: scale + CPK atom spheres; per molecule `[−] n [+]` dwell buttons (≥ 160 px, 1–9); per-element counters (mismatch pulses coral); scale tilts; **Check** (bothUp/Enter). Recording order: (0) subscript trap / `sameSpecies` false → `changed_subscripts`; (1) `isBalanced(withCoefficients(...))`; balanced but not simplest (e.g. 4,2,4) → "Balanced! Now simplify" (not locked); (2) balanced+simplest → correct choice; (3) unbalanced → matching wrong choice text, else `chosen:"X"` with misconception from the first `diff` element (O → oxygen, H → hydrogen). Record `balancerSteps`.
- **Done when:** fixture q4: 2,1,2 → correct; 1,1,2 → `unbalanced_hydrogen`; trap → `changed_subscripts`.

### P1-17 · AI trace drawer (45 min)
`src/game/TraceDrawer.tsx` (`T` / 🧠 button, `docs/plan/05 §7`): per step `source` (coach/fallback), `reason`, `ms`, `rejected[]` ("code caught it"), question origin.

### P1-18 · Polish (45 min)
Sounds in `public/sfx/` (CC0: pop, fizz, whoosh, correct, wrong), transitions, reduced-motion toggle, pause overlay "Step back into view".

### P1-19 · Recorded-landmark tests (45 min)
Record landmark JSON (not video) clips to `tests/fixtures/`: clap ×5, bothUp ×5, aim 30/45/60°, hold steady, drinking water, scratching head, talking with hands. `tests/gestures.test.ts` replays them through the engine and asserts event counts (`docs/plan/04 §10`).

**⛳ MERGE 3 · 23:30** → `MERGE-CHECKLISTS.md §3`

---

## PHASE 4 · Sun 0:00–3:00

### P1-20 · Performance (45 min)
≥ 30 fps in Mix Lab with pose on, on the **demo laptop**. Cut in order: particles → Environment → bloom intensity.

### P1-21 · People + lighting test (1 h)
3 people × 2 lighting setups, the motion list in `docs/plan/09 §3`. Tune thresholds (not rules). Fix the bugs from the Merge 3 run.

### P1-22 · Freeze (3:00 AM) → rehearse
Bug fixes only. Rehearse the `docs/plan/11 §2` demo 3×; you drive the keyboard backup.
