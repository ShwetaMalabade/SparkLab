# LAB-SPEC.md — Chemistry labs (for Shweta · PLAY)

**Decision (Dharm, Sat ~15:30):** chemistry only, **every question is a hands-on lab, no answer balloons**, look = **clean modern lab**.
Dharm's side is done: the server only sends lab questions, and every number, color and observation below arrives in the question, computed by code. This file is what to build. Data shapes: `CONTRACTS.md §1`. Fixture: `/play/fixture` = q1 Titration · q2 Mystery · q3 Mix Lab · q4 Balancer · q5 Reaction Yield.

## 0. Build order (Merge 3 at 23:30)
1. **Lab bench + Titration Lab** (the showcase), by ~20:30
2. **Mystery Sample**, by ~23:00
3. **Reaction Yield Lab**, then restyle Mix Lab + Balancer onto the bench (stretch, before the 3 AM freeze)
Answer Balloons stay in the code only as a crash-safety fallback; a lab that can't render should **skip** the question (like `N`), not show balloons.

## 1. The look: one shared lab bench (replaces the neon grid arena)
- **Bench:** white/very light grey epoxy top (`#F4F5F7`, roughness 0.35), slightly rounded front edge, dark grey cabinet front below. Fills the lower third of the screen, seen from a seated eye height about 30° down.
- **Wall behind:** soft off-white (`#E9ECEF`) with a gentle vertical gradient; low-detail silhouettes only (a fume hood outline, one shelf with 4–6 simple bottles, a periodic-table poster as a flat texture or drawn rectangle grid). Nothing busy: the glassware is the star.
- **Light:** soft studio light. One large overhead area/rect light (warm white), a fill from the left, the existing offline `Lightformer` environment for glass reflections. `ContactShadows` under every object. No bloom, or a very light one on flames only.
- **Glass:** `MeshPhysicalMaterial` with `transmission ≈ 0.95`, `thickness 0.3–0.6`, `roughness 0.05`, `ior 1.5`, a faint edge tint. The liquid is a separate inner mesh (a cylinder/lathe) whose color and level animate; meniscus = a slightly curved top cap. If fps drops below 30 with pose running: transmission → plain `opacity 0.25` glass + `envMapIntensity`.
- **Labels:** small white label stickers on bottles with the formula (`ChemText` for subscripts).
- **HUD:** keep the question card at the top and the camera preview at the top right; the **Lab Notebook** (§2) sits on the right side of the bench as a clipboard.
- **Sound:** existing generated sfx (drip, fizz, whoosh); add a soft Bunsen hum and a balance "beep" if quick.
- Performance: ≤ 300 particles total, ≥ 30 fps with pose on the demo laptop.

## 2. How a student answers without balloons: the Lab Notebook
Every lab ends the same way, so it's one shared component:
- The notebook shows the measurements the student made (rows fill in live), then a **"Record your result"** section with the question's **4 code-built choices** as 4 notebook lines (`question.choices[i].text`).
- Pick a line by hovering + dwell (or `1–4`), confirm with both hands up (or `Enter`). That's the lock-in: same `AttemptInput` as today (`chosen`, `chosenText`, `correct`, `misconceptionId`) plus the lab's own log field.
- After lock-in: the line turns lime ✓ or coral ✗; show `choices[].why` and the coach line as today.
- The experiment never gives the answer away by itself (the student still reads, calculates or reasons), but the line matching what they measured can get a subtle highlight in the titration (their own burette reading).

## 3. Titration Lab (`template: "titration_lab"`, data `question.titration`)
**Bench:** a burette in a clamp stand (tall glass tube, white scale 0–50 mL, black markings, stopcock at the bottom), a conical flask under it on a white tile, a pH meter (small box with a digital display and a probe in the flask), and a wall monitor or tablet on the bench showing the live **titration curve**.

| Data | Use |
|---|---|
| `analyte.formula/name/volumeML/molarity` | Flask label + starting liquid level (volumeML) |
| `titrant.formula/name/molarity` | Burette label; burette starts at 0.00 mL, filled to the top |
| `indicator`, `indicatorInfo` | Bottle label; the flask color (below) |
| `equivalenceML`, `curve[]`, `startPH`, `endPH` | Live pH, curve, end point |
| `ask` | `"endpoint_ml"`: the notebook asks for the end-point volume. `"analyte_molarity"`: the notebook asks for the concentration |

**Interactions** (every one has a key):
- **Left hand = stopcock.** Open hand (fingers spread / hand raised) opens the valve; the more open, the faster: single drops (≈0.05 mL each) → fast stream (≈0.5 mL/s). Close = stop. Keys: `Space` hold = drip, `Shift+Space` = stream.
- **Right hand = swirl.** Small circles over the flask swirl it (the liquid rotates). Key: `S`. Unswirled drops leave a **pink streak** near the surface that fades in ~1 s (phenolphthalein near the end point).
- **Reading:** the burette level drops as volume is added; the student can lean in (or `R`) to zoom on the meniscus and read the volume (2 decimals).

**Live chemistry (all from Dharm's helpers, browser-safe):**
- `addedML` = what's left the burette. pH = `phAt({ analyte: {formula, molarity, volumeML}, titrant: {formula, molarity} }, addedML)` from `@/lib/acidBase` (or interpolate `curve[]`, which is cheaper).
- Flask color: `indicatorColor(indicator, pH)` returns `{hex, strength, label}`. Mix the liquid toward `hex` by `strength` (phenolphthalein is clear in acid, so strength 0 means a clear liquid). It goes faint pink, then pink, then **deep magenta** past the end point (overshoot, which the student can see).
- The pH meter display shows `pH` (2 decimals). The curve on the monitor draws point by point as volume is added; an end-point marker appears at `equivalenceML` **after** lock-in.
- **Notebook rows (live):** Initial reading 0.00 mL · Final reading (current) · Volume added · pH.

**Lock-in:** `titrationLog: { finalReadingML, drops, overshootML: max(0, finalReadingML − equivalenceML) }`.
**Done when:** fixture q1 (acetic acid 0.150 M × 20.0 mL vs NaOH 0.100 M): the flask stays clear, gets a faint pink that fades, turns pink at ~30 mL and deep magenta by ~33 mL; the pH reads ~2.8 at the start and ~8.8 at 30.0 mL; keyboard-only works; ≥ 30 fps.

## 4. Mystery Sample (`template: "mystery_sample"`, data `question.mystery`)
**Bench:** a watch glass with "Sample X" (white powder), a Bunsen burner (blue flame, gentle flicker), a nichrome wire loop in a holder, a rack of 4 test tubes with a little dissolved sample, 4 dropper bottles labeled **NaOH**, **AgNO₃ (+ HNO₃)**, **BaCl₂ (+ HCl)**, **dilute HCl**, and a **clue board** (small whiteboard) beside the notebook.

| Data | Use |
|---|---|
| `tests[5]` | `{test, label, detail, effect, color, text}` for flame / naoh / agno3 / bacl2 / hcl |
| `compound` | **The answer**: never show it before lock-in |

**Interactions:**
- **Flame test:** grab the loop (dwell), touch the sample, move the loop into the flame. The flame turns `tests[flame].color` for ~3 s (`effect: "none"` = it stays blue/orange, "no distinctive color"). Keys: `F`.
- **Dropper tests:** grab a bottle, hold it over a test tube, dwell to add drops. `effect: "precipitate"` → `Precipitate` with `color` settling in the tube; `"bubbles"` → `Bubbles` (fizz sound); `"none"` = nothing happens (that's information too). Keys: `1` NaOH, `2` AgNO₃, `3` BaCl₂, `4` HCl.
- Each test writes its `text` on the clue board (e.g. "Flame test → Lilac flame"). The same test twice doesn't add a row.
- **Notebook:** "Which compound is Sample X?" with the 4 choices. **Stars:** 3★ if ≤ 2 tests, 2★ if 3, 1★ if 4–5 (shown after lock-in).

**Lock-in:** `testsUsed: ["flame", "agno3", …]` in order.
**Done when:** fixture q2 (KCl): lilac flame, no precipitate with NaOH, white precipitate with AgNO₃, nothing with BaCl₂, no fizz; picking KCl gives ✓; keyboard-only works.

## 5. Reaction Yield Lab (`template: "stoich_lab"`, data `question.stoich`)
**Bench:** a digital balance (display reads in g, 2 decimals), a weighing boat with the solid reactant (`known`), a conical flask of the other reactant (in excess) fitted with a stopper and a tube to a **gas syringe** (horizontal, 0–100 mL scale) when `targetIsGas`, otherwise a beaker where the product forms.

| Data | Use |
|---|---|
| `equation` | Shown on the flask label (`ChemText`) |
| `known {formula, name, massG}` | The balance reading once the boat is placed: settle on `massG` with a tiny jitter for 0.5 s |
| `target`, `targetIsGas`, `gasVolumeML` | The syringe plunger moves out to `gasVolumeML` (scale so the max fits) while `Bubbles` fizz in the flask |
| `molesKnown`, `molesTarget`, `coefKnown`, `coefTarget`, `mmKnown`, `mmTarget`, `answer`, `ask` | Notebook rows, revealed **after** lock-in as the worked chain: g → mol → ratio → answer |

**Interactions:** tare the balance (dwell on TARE, key `T`), place the boat (grab and drop, key `P`), read the mass, tip the solid into the flask (grab boat over the flask, both hands up, key `Enter`), watch the reaction and the gas syringe fill. Notebook during the experiment: "Mass of Mg: 2.43 g", "Gas collected: … mL".
**Lock-in:** the 4 choices as usual (no extra log field needed).
**Done when:** fixture q5 (2.43 g Mg + HCl): the balance reads 2.43 g; the syringe fills to ~2400 mL scaled (or shows "2.40 L"); the worked chain shows 0.1000 mol → 1:1 → 0.202 g after lock-in.

## 6. Mix Lab and Equation Balancer
Keep their mechanics (they work); move them onto the same bench with the same glass and light. Mix Lab: the hazard card (`reaction.hazard`) is now always filled by code for heavy metals, and should be shown as a small yellow warning sticker. If time allows: a thermometer in the flask showing a rise (`visual.heat: "exo"`) or a fall (`"endo"`).

## 7. What the server guarantees (so you don't need checks)
- Every question the server sends has a lab template and its data (`titration`, `mystery`, `stoich`, `reaction`, or `equation`); no balloons.
- Every number is computed by code, and the 4 choices are distinct.
- The coach can send a new question of any lab type mid-game (`origin: "variant"`, badge as today); it has the same data.
