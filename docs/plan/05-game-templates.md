# 05 · Game Templates + Game Loop with the AI Coach
**Owner:** A (3D/Game) · **Helps:** B (gesture wiring) · **Depends on:** 02, 03, 04

Templates contain **no content**. Every question, choice, reaction, color and "why" comes from the agents (`03`) after code has checked it. Templates only draw and simulate.

---

## 1. Game loop (`GameRunner.tsx` + `coach.ts`)

```
START: first question = the coach's pick (POST /api/next, no attempt yet: it may only choose "next"); fallback = first worksheet question
INTRO   question card 3 s, read aloud + caption. Variants show a badge: "🧠 New question from your coach"
PLAY    template-specific; gesture events + hover trace + experiments recorded
LOCK-IN answer chosen →  POST /api/attempt   (phone updates)
                     →  POST /api/next       (coach thinks, 6 s budget, AbortController)
REVEAL  4–6 s: correct simulation + the option's "why" spoken + caption
        then the coach's personal feedback line, if it has arrived ("Coach: …")
NEXT    the coach's choice (or the code fallback). Both hands up / Enter, or auto after 6 s
END     coach says "finish", or no questions left, or time budget used → POST /api/session/[id]/end → Results
```
- **Score:** +100 correct, +50 if answered < 10 s, ×1.5 streak multiplier after 3 correct in a row. Variants score the same.
- **Time budget** comes from the class (`timeBudgetSec`, chosen on Landing: "2-min tour", "10 min", "Full worksheet"). The coach plans to it.
- **Attempt POST** fires at LOCK-IN. If it fails, queue it in `localStorage` and retry every 5 s (never block the game). The coach call still runs with the attempt in its body (`attempt` inline when `attemptId` is missing).
- **Hidden questions** (Critic `block`) are skipped by both the coach context and the fallback.
- **Pause** (tracking lost or `P`): freeze timers and physics, dim the scene, show "Step back into view".
- **Template check at runtime:** if the props fail (e.g. Launcher without `v` or `theta`), use Answer Balloons.
- **`N` key** skips to the next step at any time (demo safety).

## 2. P1 Projectile Launcher

**Scene:** cannon at the left of a 3D field; distance markers every 10 m; hidden target flag at the correct range; seated avatar on the right.
**Field length (code):** `Rmax = v²/g` for the question's `v` (or 30 m/s if speed is free), rounded up to the next 10 m, minimum 50 m. World scale fits `Rmax` to the camera, so a 35 m shot uses most of the field.

**Experiment phase (20 s, up to 3 test shots):**
- `params.lock` (chosen by the Level Designer, enforced by code in `assemble`):
  - `"speed"`: speed fixed at the question's `v` (HUD 🔒 20 m/s); the forearm sets θ. Power hand ignored.
  - `"angle"`: angle fixed at the question's `theta` (HUD 🔒 30°); the power hand sets speed.
- **Fire = hold steady 1.2 s** (ring around the cannon). Keyboard: Space.
- The ball flies on the exact equations below with a glowing trail and a landing label ("35.3 m"). Each shot is stored in `experiments[]` as `{thetaDeg, speed, landedM}`; the coach reads these.
- After 3 shots or 20 s → answer phase. Skip by dwell or `N`.

**Answer phase:** Answer Balloons (§5) with the 4 choices, floating above the field.

**Reveal:**
1. Fire with the question's real `v` and `θ`; the ball lands on the flag; the label pops: "35.3 m".
2. Wrong numeric pick → a **ghost trail** (dashed, coral) with the same launch angle, scaled to land at the wrong value, labelled with the mistake: "Used sin θ instead of sin 2θ → 20.4 m". The value is the code-computed wrong value from `assemble`.
3. Speak the chosen option's `why`, then the coach's line.

**Physics (analytic, no physics engine):** level ground, `g = 9.81`:
```
x(t) = v·cosθ·t        y(t) = v·sinθ·t − ½·g·t²
T = 2·v·sinθ/g         R = v²·sin(2θ)/g        H = v²·sin²θ/(2g)
```
Animate with `useFrame`; time-scale so every flight lasts ~2.5 s on screen.

## 3. C1 Mix Lab

**Scene:** lab bench with **4 beakers**: the 2 reactants from `question.reaction.reactants` + up to 2 decoys from `question.params.decoys` (both written by the AI; the Critic reviews decoys). Labels show name + formula. Central flask, avatar.

**Play:**
1. Dwell a hand over a beaker for 800 ms → it attaches to that hand (one per hand). Dwell on the bench to put it back.
2. When **both** hands hold a beaker, the HUD shows "👏 Clap to mix". Only now is `clap` armed.
3. Clap → both pour into the flask:
   - **The question's pair:** play `question.reaction.visual`:
     - `bubbles`: ~200 instanced spheres rising + fizz sound
     - `precipitateColor`: particles in that color fall and settle
     - `colorFrom → colorTo`: liquid color lerps over 1.5 s
     - `heat`: exo = orange glow + shimmer; endo = frost on the glass
     - `flame`: cone flame in that color above the flask
   - **Any other pair:** "Not the pair for this experiment. Try again." (We don't claim "no reaction", because we haven't verified that pair.) Beakers return; max 2 tries; each try goes into `mixTries` for the coach.
4. The balanced equation (`reaction.equation`, verified by code) slides in above the flask, each element color-coded (CPK colors, §4), with `reaction.observation` as a caption.
5. If `reaction.hazard` is set: a small amber card "In real life: Lead compounds are toxic. Virtual only."
6. Then Answer Balloons with the question.

**Safety:** every reaction card says "Virtual only". No real-world steps anywhere (the prompts forbid them; the Critic blocks them).

## 4. C2 Equation Balancer

**Scene:** a giant balance scale. Each side holds molecules as clusters of atom spheres. CPK colors: **H white, O red, C dark gray, N blue, Cl green, Na purple, S yellow, Fe orange, Cu copper, Ag silver, Ca light green, Mg teal, K violet, Pb dark slate, I deep purple, Ba lime-green**; any other element: neutral gray with its symbol.

**Play:**
- Start: all coefficients 1, species from `question.equation` via `splitEquation`.
- Under each molecule: `[ − ] n [ + ]` blocks (each ≥ 160 px, dwell to press; range 1–9). Each change re-spawns that many molecules and appends the coefficient list to `balancerSteps`.
- Per-element atom counters on each side; mismatched elements pulse coral. The scale tilts by total atom difference.
- **"Check"** (dwell, or both hands up / Enter) locks in.
- **Subscript trap:** a "change subscript" button is shown on purpose. Pressing it turns H₂O into H₂O₂ with "That's a different chemical!" and locks in as a subscript mistake.

**How the attempt is recorded:**
0. **Subscript trap first.** `H2 + O2 -> H2O2` *is* atom-balanced, so: if the trap was pressed (or `!sameSpecies(built, question.equation)`), record the choice tagged with the subscript mistake (or `chosen: "X"` with the registry's subscript id if no such choice), and stop.
1. `built = withCoefficients(...)`; `b = isBalanced(built)`.
2. `b.balanced && b.minimal` → the correct choice.
3. `b.balanced && !b.minimal` (e.g. 4, 2, 4) → don't lock in: "Balanced! Now make the numbers as small as possible." One more try.
4. Not balanced → find the wrong choice whose text equals the coefficient list (e.g. "1, 1, 2") → that choice and its misconception.
5. No matching choice → `chosen: "X"`, `chosenText` = the coefficient list, `misconceptionId: null`; the coach names the mistake from `balancerSteps` and `diff` (it may add it to the registry via `newMisconceptions`).

**Done:** correct → scale levels, confetti, "Balanced!". Wrong → the right coefficients animate in and the counters turn lime.

## 5. G1 Answer Balloons (generic)

- 4 balloons in a row (≥ 220 px wide on a 1080p screen, ≥ 60 px apart), choice text ≤ 40 chars. **Keep them between 35% and 75% of the screen height** (never the top third), so raising both hands doesn't sweep the cursors through them.
- **Pick by dwell** with either hand (800 ms), **or** lean L/R to move the highlight + both hands up to pop it. Keyboard: 1–4 or ←/→ + Enter.
- Hover time on each balloon goes into `hoverTrace`.
- Wrong pop → balloon bursts coral, its `why` is spoken, the correct balloon glows lime. Correct → confetti.
- Balloons float with `<Float>` but **freeze while a cursor is inside**, so dwell doesn't drift off.

## 6. Results screen
Score, accuracy per concept (bars), "Your top mistake: Used sin θ instead of sin 2θ", the coach's final note (`studentModel.notes`), questions the coach wrote for you (variants, with ✓/✗), time played, "Play again".

## 7. AI trace drawer (`T` key, or the 🧠 button)
A side panel listing every agent call for this session from `aiCalls`: agent, ms, one-line reason (coach `reason`, critic messages, code `rejected` notes). Example rows:
- `Coach · 2.1 s · Hovered 35.3 m for 1.8 s, then picked 20.4 m. Unsure about sin 2θ → wrote a variant at 50°.`
- `Code · rejected coach question q1v1: "sin θ" value equals the right answer at 60°.`
This is the "you can watch the AI think" moment for judges.

## 8. Performance budget (demo laptop, pose running)
| Item | Budget |
|---|---|
| Frame rate | ≥ 30 fps |
| Bubbles / precipitate particles | ≤ 300 instanced |
| Bloom | one `<EffectComposer>` pass, `luminanceThreshold 0.2` |
| Shadows | `ContactShadows` only; no shadow maps |
| Textures | none required; emissive materials + bloom |
If fps < 30: halve particles, disable `Environment`, drop bloom intensity to 0.5, in that order.
