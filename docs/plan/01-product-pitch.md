# 01 · Product & Pitch
**Owner:** D (Product/Content) · **Reads:** everyone · **Depends on:** 00

---

## 1. The problem

1. **Physics and chemistry are abstract.** Students memorize `R = v²·sin(2θ)/g` or "acid + base → salt + water" without ever *seeing* it. Real labs are limited by time, cost and safety. Most homework is a flat worksheet.
2. **Students sit all day**, then sit again for homework. They rush or copy answers.
3. **Homework doesn't adapt.** Everyone gets the same 10 questions in the same order. A student who confuses sin θ with sin 2θ gets no second try on that idea.
4. **Teachers find out too late.** They learn about a misconception after the test.
5. **Existing tools don't connect.** Simulation sites (PhET and similar) offer one fixed sim per concept, separate from the teacher's *actual* worksheet.

## 2. The solution

**Homework Arena** turns the teacher's own worksheet into an adaptive 3D lab, run by AI agents and checked by code:

1. **Scan** a photo of any physics or chemistry worksheet.
2. **AI builds the levels.** One agent reads and solves the page; another names the likely mistakes and writes a *wrong formula* for each one; **code computes every number**, including the wrong answers, and catches errors in the teacher's answer key.
3. **Play with your hands.** The laptop camera tracks arms and hands on-device. Your forearm aims the cannon; a clap mixes two beakers.
4. **An AI coach decides what's next.** After every answer it looks at *how* you got there (which angles you tried, which answer you hovered over before picking, how long you hesitated) and chooses: move on, try a **brand-new question it just wrote for your mistake**, probe a related idea, or finish.
5. **See why.** Every wrong answer replays the correct science in 3D, with a spoken line written for *you*.
6. **Live Teacher View.** The teacher scans a QR code and watches named mistakes, the coach's decisions and an AI summary update live. One tap writes tomorrow's warm-up worksheet aimed at the class's mistakes.

## 3. Our edge (say this to judges)

| Edge | What it means | Proof in the demo |
|---|---|---|
| **The teacher's real worksheet becomes the level** | No fixed content library | Judge hands us a worksheet, or we snap the teacher's page |
| **AI writes, code checks** | Seven agents write questions, answers, mistakes and reactions; mathjs, an atom counter and solubility rules verify them. The AI never puts an unchecked number in front of a student | Scan screen: "Answer key says 34.0 m. Code computes 35.3 m. Fixed." |
| **The coach adapts to behavior, not just right/wrong** | It reads experiment traces and hesitation | Coach line: "You tried 30° and 60° and both landed at 35 m. That's sin 2θ." Then a new question appears |
| **Teacher sees named mistakes live** | Not "62%", but "3 students used sin θ instead of sin 2θ" | Judge's phone updates as I play |

Body-controlled learning games have won before (e.g. kinemo at PennApps XXVI; verify others before naming them, `12` R6). We are not "another motion game": the AI-built, AI-adapted, code-verified loop is the product.

## 4. Target users

| Persona | Need | What they get |
|---|---|---|
| **Maya, 16, AP Physics 1** | Kinematics feels like memorizing formulas | Aims with her arm, sees 30° and 60° land together, gets a new question that tests exactly that |
| **Jordan, 15, Chemistry 1** | Can't picture "precipitate" | Claps two beakers together; bright yellow solid rains down |
| **Ms. Patel, HS physics teacher** | 120 students, no time to find who is confused about what | Live view with re-teach groups; tomorrow's warm-up written for her |
| **A tutoring center (Peri business)** | A reason for parents to pick them | Adaptive sessions plus reports for parents |
| **Students who learn by moving / ADHD** | Can't sit still for an hour | Learning *is* moving, even seated |

Scope: **physics and chemistry only**.

## 5. Features

### 5.1 MVP (the demo depends on these)
| ID | Feature | Done when… |
|---|---|---|
| F1 | **Worksheet scan:** upload or webcam/phone photo, resized in the browser | Review screen in ≤ 20 s |
| F2 | **Agent 1 Reader-Solver** (vision) | Draft passes `ReadOut` schema |
| F3 | **Agent 2 Mistake Modeler + Level Designer** | Every wrong choice has a named mistake and (numeric) a wrong formula |
| F4 | **Code verification:** mathjs values, atom balance, solubility rules, answer-key check | Wrong key flagged; no unchecked number reaches a student |
| F5 | **Agent 3 Critic** (background) | Chemistry claims reviewed; ⚠️ shown on Review |
| F6 | **Review screen:** edit a number → code recomputes all four choices instantly | Fix a misread number in < 10 s, no AI call |
| F7 | **Seated calibration** with framing check | ✅ in ≤ 5 s |
| F8 | **Seated hand controls:** cursors, dwell, both-hands-up, clap, forearm angle, power, hold-steady, hover trace | Works 0.6–1.2 m from the laptop |
| F9 | **P1 Projectile Launcher** | Forearm sets θ, hold still fires, trajectory matches the formula |
| F10 | **C1 Mix Lab** (reaction from Agent 1, checked by code) | Two beakers + clap → visual + balanced equation |
| F11 | **C2 Equation Balancer** | Coefficients by dwell; code decides balanced and simplest |
| F12 | **G1 Answer Balloons** | Dwell or lean + both-hands-up |
| F13 | **Agent 4 Director (AI coach):** next step + personal feedback after every answer; code fallback at 6 s | Never stalls the game |
| F14 | **Live variants:** the coach writes a new question aimed at the mistake; code verifies it before it's shown | Variant playable within the reveal time |
| F15 | **Agent 5 Classmate Simulator** (labelled) | 4 classmates appear on the phone after the scan |
| F16 | **Live Teacher View + Agent 6 Insight** | Phone updates ≤ 3 s after each answer; bullets contain only real numbers |
| F17 | **AI trace drawer:** every agent decision, its reason and latency | Judges can open it at any time |
| F18 | **Keyboard/mouse twin** for every action | Demo never blocks on camera |
| F19 | **Offline + replay mode** | Whole flow runs with Wi-Fi off on the demo laptop |

### 5.2 Wow #3 (build after the Sat 9 PM sync if everything is green)
| F20 | **Agent 7 Warm-up Writer:** printable 4-question warm-up aimed at the class's top mistakes, scannable back into the app |

### 5.3 Stretch (only after `09 §3` passes)
| ID | Feature |
|---|---|
| S1 | Standing mode (jump, lean, run in place) |
| S2 | "Ask why" by voice: the student asks a question out loud, the coach answers in context |
| S3 | P2 Force Push, P3 Free-Fall Drop, C3 pH Walk templates |
| S4 | Classroom race (2 poses) |
| S5 | Shareable replay clip (`MediaRecorder` on the canvas) |
| S6 | Bedrock path live (only if Amazon credits arrive) |

### 5.4 Out of scope
Accounts/passwords, payments, AI-generated 3D models, native mobile app, real-world chemistry instructions, storing camera video.

## 6. How AI is used (the pitch slide)

| # | AI job | Technology | Checked by |
|---|---|---|---|
| 1 | Body/hand tracking, 30 fps, on-device | MediaPipe Pose Landmarker (lite) | Calibration + fixture tests |
| 2 | Read and solve the worksheet | Agent 1, Gemini vision | mathjs, atom counter, solubility rules |
| 3 | Name likely mistakes; write a wrong formula for each; choose the 3D template | Agent 2 | Code computes each wrong value; rejects near-duplicates and impossible values |
| 4 | Second opinion on chemistry and wording | Agent 3 Critic | Blocks or flags |
| 5 | Decide the next step from behavior; write new questions live; personal feedback | Agent 4 Director | Same verifiers as the scan; 6 s code fallback |
| 6 | Simulate a class for the teacher view | Agent 5 | Schema: answers must be real choice ids |
| 7 | Teacher summary, re-teach groups, next move | Agent 6 | Code rejects any number not in the computed stats |
| 8 | Tomorrow's warm-up | Agent 7 → Agent 2 → code | Same pipeline as a scanned worksheet |

**AI writes, code checks. The AI never has the last word on correctness.**

## 7. Business model (for Q&A)
Free for students. Tutoring centers and schools pay per classroom for the Live Teacher View, history, warm-up generation and projector mode.

## 8. What's next (for Devpost and Q&A)
More templates (circuits, waves, stoichiometry), voice "ask why", classroom race, Google Classroom export, Spanish voice.
