# MERGE-CHECKLISTS.md — done by both people together (30 min each)

**Order every time:** both stop coding → Dharm merges `p2/*` into `main` → Shweta rebases on `main`, merges `p1/*` → `npm run build` → run the tests → deploy → walk the checklist → each LLM writes the result in its own progress file's **Merge log** → post a 3-line summary in #hack-project.

If an item fails: write it as ⛔ with an owner, **keep going** (don't block the other person), fix it in the next phase.

---

## §1 · MERGE 1 · Sat 14:00 — "a real worksheet becomes a playable level"
Before: Dharm switches `api.ts` to real calls for everything **except** `nextStep` (still the code fallback).
- [ ] `npm run build` passes; tests 86/86
- [ ] Landing creates a class; the QR opens `/live/<code>` on a phone (page may still be a stub)
- [ ] Scan the **printed** worksheet → agent steps stream → verified worksheet saved, the key typo flagged (`answer_key_mismatch`)
- [ ] `/play/<real wsId>` loads it → seated calibration ≤ 5 s → play Balloons **by gesture**
- [ ] Each lock-in writes a document to Mongo `attempts` with `input`, `hoverTrace`, `chosenText`
- [ ] Whole flow also works **keyboard only**
- [ ] Vercel URL works in an incognito window
- **If scan is red:** Shweta keeps using the fixture; Dharm fixes ingest first.

## §2 · MERGE 2 · Sat 19:00 — "the coach and the phone work"
- [ ] Coach picks the next step after each answer (trace: `source: coach`)
- [ ] With Chrome DevTools "Slow 3G", the game falls back within 6 s (trace: `source: fallback`) and never freezes
- [ ] A wrong answer can produce a **🧠 variant** that passed code checks (or a visible "code rejected" entry)
- [ ] Launcher: v = 20, θ = 30° lands at 35.3 m; hold-steady fires; speed lock works
- [ ] Mix Lab: real worksheet reaction plays; clap only works with 2 beakers; hazard card shows
- [ ] Judge's phone (real phone, venue Wi-Fi **and** cellular) updates ≤ 3 s after each answer; no toasts on first load
- **Decision (write in both progress files):** 🟢 green → P1-16 Balancer and P2-20 classmates are IN. 🔴 red → both are ✂️ cut; Phase 3 = fixes + polish.

## §3 · MERGE 3 · Sat 23:30 — "the full 2-minute demo works on the deploy"
- [ ] Run the `docs/plan/11 §2` script on the Vercel URL with a stopwatch: ≤ 2:00, **twice in a row**
- [ ] Phone shows insights with "✓ numbers checked"; a fake injected number is replaced
- [ ] Spot-check 5 numbers on screen: each came from code (choices, landing distance, counts)
- [ ] ≥ 30 fps in Mix Lab with pose running, on the demo laptop
- [ ] Keyboard-only run of the whole demo works
- [ ] Write every bug found as a task in the owner's progress file (Phase 4)

## §4 · FREEZE · Sun 3:00 AM
- [ ] Offline mode passes with Wi-Fi off (replay recorded)
- [ ] Backup video recorded
- [ ] From now on: bug fixes only, each one tested on the deploy **and** offline
