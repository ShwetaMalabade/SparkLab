# Homework Arena: Plan Set (v3.2, AI-first, 2-person build) — Read Me First

> **Team of 2? Start with `13-two-person-build-plan.md`**, then give each person's LLM their brief: `PERSON-1-PLAY-BRIEF.md` / `PERSON-2-BRAIN-BRIEF.md`. Where `13` disagrees with older files (agent count, `08` roles), `13` wins.

> **One line:** Snap any physics or chemistry worksheet. Seven AI agents turn it into a 3D lab you play with your hands: your arm aims a cannon, you clap to mix chemicals. An AI coach watches *how* you experiment, picks what you play next, and writes brand-new questions aimed at your exact mistake. Code checks every number the AI writes. The teacher watches it all live on their phone.

This folder replaces v2 (Claude keeps a copy of v2; it is not in this zip). Each file has **one owner**. Nobody writes code from memory: code against these files.

**Code freeze rule for this round:** these are plan files only. No code is written until Dharm says go.

---

## 1. The big change in v3: nothing is hand-written

| v2 (hand-written) | v3 (AI writes it, code checks it) |
|---|---|
| `sample-worksheets/*.json` with fixed questions | Every question comes from the scanned page (Agent 1) or is written mid-game by the coach (Agent 4) |
| Fixed `misconceptions.json` (18 entries) | Agent 2 names the likely mistakes for *each* question; the list grows as students play |
| Wrong answers typed by a person | Agent 2 writes a **wrong formula** for each mistake; **code computes** the wrong number |
| Hand-checked `reactions.json` (14 rows) | Agent 1 writes the reaction (products, colors, gas, heat); code checks atom balance + solubility rules; Agent 3 (Critic) reviews it |
| Fixed question order | Agent 4 (Director/Coach) picks the next step after **every** answer |
| 4 hand-made seed students | Agent 5 simulates 4 classmates on the scanned worksheet, clearly labelled "AI-simulated" |
| Mock mode with fake data | **Replay mode:** recorded outputs of real AI runs, for offline only |

**What code still owns (and why):** math, atom counting, solubility rules, schema checks, and the game physics. These are *checks*, not content. "AI writes, code verifies" is our edge for the AI prize: judges always ask "what if the AI is wrong?"

## 2. The seven AI agents (details in `03`)

| # | Agent | Runs | Model tier |
|---|---|---|---|
| 1 | **Reader-Solver** (vision): reads the page, solves each question, writes formulas / reactions / equations | On scan | Vision (Flash) |
| 2 | **Mistake Modeler + Level Designer**: names likely mistakes, writes a wrong formula per mistake, picks the 3D template and its settings | On scan | Fast (Flash-Lite) |
| 3 | **Critic**: second opinion on chemistry claims, wording, safety | On scan, in background | Fast |
| 4 | **Director (AI coach)**: after every answer, reads the student's behavior and decides: next question, a **new variant** aimed at the mistake, a probe, or finish. Writes the personal spoken feedback | Every answer | Fast |
| 5 | **Classmate Simulator**: 4 realistic students with different skill profiles play the worksheet, so the teacher view has a class to show | Once per class | Fast |
| 6 | **Teacher Insight**: 3 bullets, re-teach groups, next lesson move, from *computed* stats only (code rejects any invented number) | Live view, every 20 s | Fast |
| 7 | **Warm-up Writer**: writes tomorrow's 4-question warm-up aimed at the class's top mistakes, as a printable page | Teacher button | Fast, then Agents 2 + code |

Plus **MediaPipe Pose** (on-device ML) for body tracking.

## 3. Decisions (final)

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Main track | **Best Education Hack** (enroll in exactly one) | Core product |
| D2 | Big sponsor target | **Amazon: Best Practical AI Innovation**, plus MLH Gemini, MLH MongoDB, Peri, GoDaddy | User asked to win the AI prize; Amazon's text allows any LLM or agent framework (see `10 §1`) |
| D3 | AI provider | **Gemini default** (`AI_PROVIDER=gemini`), Bedrock switch kept and fully written | Zero spend; Bedrock if Amazon credits arrive |
| D4 | Models | Two env vars: `GEMINI_MODEL_VISION` (Flash, Agent 1) and `GEMINI_MODEL_FAST` (Flash-Lite, Agents 2–7) | Free-tier limits are per model, so splitting spreads the load |
| D5 | Voice | Browser Web Speech API | Free, no extra calls |
| D6 | Motion default | **Seated, hands-only**; aim with the **forearm** (elbow→wrist) so the hand stays in frame; fire by holding still 1.2 s | Crowded judging hall; laptop camera field of view |
| D7 | Wow #1 | **Live Teacher View** on the judge's phone, with the coach's decisions shown live | Shows the AI thinking about a real student |
| D8 | Wow #2 | **The coach writes a new question about your mistake, live**, and code checks it before you see it | "That question didn't exist 3 seconds ago" |
| D9 | Wow #3 (if time) | **Tomorrow's warm-up**: the teacher taps a button, gets a printable worksheet aimed at the class's mistakes, which the app can scan again | Closes the loop: worksheet in → worksheet out |
| D10 | Database | MongoDB Atlas Free (M0). Live view polls every 2 s. Every AI call is logged in `aiCalls` | Change streams work on Free, but Vercel functions time out; polling is simpler |
| D11 | Offline | `next start` on the demo laptop with `OFFLINE=1`: in-memory DB + **replay** of recorded AI outputs. Live view in a second window on the same laptop | A Vercel tab can't load pages offline; BroadcastChannel can't reach another device |
| D12 | Demo worksheet | A real worksheet from a teacher (ideally the Peri business). Its answer key has **one deliberate typo** that we say out loud ("we put a mistake in the key; watch") | Shows code catching a wrong key, honestly |
| D14 | **Team is 2 people** | Build plan = `13-two-person-build-plan.md` + `PERSON-1-PLAY-BRIEF.md` + `PERSON-2-BRAIN-BRIEF.md` (replaces the 4-person split in `08`). Scope cut to Agents 1, 2, 4, 6; Agent 5 only if Merge 2 is green; Agents 3 + 7 cut | ~18 build hours for 2 people |
| D13 | Scope | Must-have: Scan → Review → Calibrate → **Launcher** → **Mix Lab** → **Balancer** (as the coach picks) → Live Teacher View | Three templates + the coach is enough to win |

## 4. Files and owners

| File | Owner | What it holds |
|---|---|---|
| `00-README-decisions.md` | Claude | This index + decisions |
| `01-product-pitch.md` | D | Problem, users, features, AI story, edge |
| `02-architecture-data-contracts.md` | C | Architecture, routes, schemas, Mongo, modes |
| `03-ai-pipeline-gemini.md` | C (prompts: D) | The 7 agents, prompts, verification code, repair loop |
| `04-motion-seated-first.md` | B | MediaPipe, gestures, calibration, hover trace |
| `05-game-templates.md` | A | Launcher, Mix Lab, Balancer, Balloons, reveal, game loop with the coach |
| `06-wow-live-teacher-view.md` | C + B | Live phone view, classmates, insights, warm-up |
| `07-ui-design.md` | D | Screens, AI trace drawer, colors, accessibility |
| `08-team-timeline.md` | All | Hour-by-hour plan |
| `09-paper-tests.md` | All | Tests already run + run-time checklist |
| `10-prizes-devpost.md` | D | Prize stacking, Peri, Devpost text |
| `11-demo-script-qa.md` | D | 2-minute script, Q&A, backups |
| `12-risks-fallbacks.md` | All | Risks, fallbacks, open research |

## 5. Constraints (never break these)

- **Software only:** laptops + phones, built-in webcams.
- **Zero spend:** free tiers or sponsor credits. No card on any account unless Dharm approves (see `12` K2 for the one decision point).
- **Deadlines (ET):** HackPrinceton runs Nov 13–15, 2026. Public GitHub repo created **after Fri 8:00 PM**. Devpost due **Sun 8:15 AM** (we submit by **7:30 AM**; confirm the time in the hacker guide). Judging **Sun 9:30 AM–2:30 PM**. Track winners can't also win Best Overall.
- **Safety:** all chemistry is virtual. No AI output may contain real-world procedures; hazards appear only as warnings.
- **Privacy:** camera frames never leave the browser. Only the worksheet image and numeric gesture events are sent. Nicknames only.
- **Honesty:** simulated classmates are always labelled; only claim tech that runs in the submitted build.

## 6. If you only remember six things

1. Gestures first, seated, debug overlay on.
2. **AI writes, code checks.** No number reaches a student unless code computed it.
3. The coach (Agent 4) decides what's next, with a code fallback if it's slow (6 s).
4. Launcher, Mix Lab, Balancer + the coach's live variant + the phone view are the demo.
5. Freeze at **3 AM Sunday**. Record a replay session and the backup video before then.
6. Every gesture has a keyboard twin. The demo never blocks on the camera or the network.

## 7. v2 → v3 fix list (from the cross-check)

| # | v2 problem | v3 fix | File |
|---|---|---|---|
| F1 | AI output always failed Zod (prompt never asked for `template`, `id`, `source`…) | Two schema layers: agent drafts are checked with draft schemas; code assembles the final `Question` | 02, 03 |
| F2 | `bedrockVision`/`bedrockText` undefined; reactions + Bedrock code pointed at the deleted v1 file | Bedrock code written out in full; reactions now AI-generated | 03 |
| F3 | QR shown before the worksheet existed; seed assumed fixed answer letters | Class created on Landing; worksheet linked when the scan finishes; classmates simulated *after* the scan; attempts store `chosenText` | 02, 06 |
| F4 | Phone toasted every seeded attempt on first load | First poll records the time, no toasts | 06 |
| F5 | TTL index on a string `createdAt` (never expires) | Server sets `createdAt: new Date()` | 02, 06 |
| F6 | BroadcastChannel to a second laptop; Vercel tab offline | Local `next start` + in-memory DB + replay; live view in a second window on the same laptop | 02, 11, 12 |
| F7 | "Here it fixed one" had nothing to fix; q2 not in the script | Answer-key typo printed on purpose and said out loud; coach picks order under a time budget; `N` = skip | 05, 11 |
| F8 | No routes to create classes or sessions; 2/4 vs 2/5 count | `POST /api/class`, `POST /api/session`, `POST /api/session/[id]/end`; students counted only once they answer | 02, 06 |
| F9 | `⇌` and `<=>` crashed the parser; `normalizeChem` never called | Normalizer handles every arrow and is called inside every chem function; bad equations return an error instead of throwing | 03 |
| F10 | Formula lint flagged correct formulas | Lint parses with mathjs: rejects unknown symbols, and trig on degree values with no `pi` | 03 |
| F11 | Extended arm may leave the camera frame | Forearm aiming by default + a framing check during calibration | 04 |
| F12 | Calibration limits in the wrong units | `sw / videoWidth` | 04 |
| F13 | Launcher rules disagreed (03 vs 05); hold-steady waited on a locked hand | One rule set; the Level Designer sets `lock`; hold-steady ignores the locked control | 03, 05 |
| F14 | Upload limit 1 MB vs 1.5 MB | 1.5 MB server cap; client resize targets ~0.5 MB | 02, 03 |
| F15 | No way to tag a wrong option with no matching mistake | Mistakes are generated per question, so none are missing | 03 |
| F16 | Phone page owner unclear | B builds the phone page UI (after motion is stable); C builds its API | 06, 08 |
| F17 | Balancer accepted non-simplest answers silently | `4,2,4` is balanced but not simplest → "Balanced! Now simplify" | 05 |
| F18 | `extractJson`'s regex contained three backticks, which broke the code block when copied | Regex is now `` /`{3}(json)?/g `` | 03 |
| F19 | Degree lint passed any formula that had `pi` *anywhere*, so `v^2*sin(2*theta)/g + 0*pi` or `sin(2*theta)*cos(theta*pi/180)` slipped through | Lint now checks each sin/cos/tan call's own argument | 03 |
| F20 | `fmt(999.7)` printed "1.00e+3 m" and tiny values printed "1.00e-7" on balloons | Values ≥ 999.5 shown as whole numbers; tiny values as ×10^n | 03 |
| F21 | `numbersAllowed` read digits from timestamps and ids in the stats, so almost any invented number passed ("14 students" was allowed because of the date 2026-11-14). Real percentages like "60%" were rejected | Skip dates/ids; allow percentages computed from real counts | 03 |
