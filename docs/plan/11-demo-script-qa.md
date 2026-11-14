# 11 · Demo Script & Judge Q&A
**Owner:** D (presenter: whoever is calmest) · **Operator:** B (keyboard fallback ready) · **Depends on:** 05, 06, 09

The AI decides the order and writes new questions, so **the script reads the screen**. Lines in *[brackets]* are filled from what's on screen at that moment. Never promise a number before it appears.

---

## 1. Setup at the table (before the judge arrives)
- Demo laptop on the table, lid angled so the camera sees a seated person at ~0.8 m. Lamp/phone light on the presenter's face if the hall is dark.
- **Tab 1:** live app on **Landing**, time budget **"2-min tour"**, QR visible.
- **Window 2 (offline backup):** `localhost:3000` from `OFFLINE=1 npm start`, already on Landing, with the replay loaded.
- **Tab 3:** backup video, paused at 0:00.
- The printed worksheet (from the Peri teacher if possible) on the table. Its answer key has **one typo we planted** (e.g. q1 printed as 34.0 m). Phone hotspot on.
- Second laptop: `/live/<code>` open, in case the judge's phone can't connect.
- Run one warm-up scan 10 minutes before judging so the model is "awake"; then start a fresh class for the judge.

## 2. Script (2:00, rehearse 3×)

| Time | Action | Say |
|---|---|---|
| 0:00 | Point at the QR | "Scan this. You're the teacher today." *(phone shows "Waiting for a worksheet…")* |
| 0:08 | Hold up the worksheet | "A real physics and chemistry worksheet from [teacher/center]. We put one mistake in its answer key. Watch." |
| 0:12 | Snap it; Scan screen streams the agent steps | "Seven AI agents. This one reads and solves the page; this one predicts the mistakes students make and writes a wrong *formula* for each. Then **our code** computes every number." *(point at the flag)* "There: the key says 34.0, code says 35.3. Caught." |
| 0:30 | Review → Play → seated calibrate | "Your phone just filled in, with four **AI-simulated** classmates so you can see a class. The camera tracks my hands right in the browser; video never leaves this laptop." |
| 0:40 | **Launcher** (if the coach picks it first; else whatever it picks): aim at 30°, hold still, fire; then 60° | "My forearm is the launch angle. Thirty… and sixty land in the same spot." |
| 0:52 | Hover the right balloon for a second, then pick the "sin θ" one on purpose | Voice reads the `why`, then: "Coach: *[coach's line]*." "Now look at your phone." |
| 1:00 | Judge's phone toasts; Coach decisions shows the reason | "You saw my mistake by name, and *why* the coach thinks I made it: I hovered on the right answer, then switched. *[Top mistake: label, n of N]*." |
| 1:08 | The next question appears. If it has the **🧠 New question** badge: | "That question didn't exist five seconds ago. The coach wrote it for my mistake, and code checked every number before showing it." *(answer it by keyboard if short on time)* If the trace shows a **rejected** coach question: "And here code *rejected* the coach's first try: at 60°, that mistake gives the right answer, so it couldn't test me." |
| 1:20 | **Mix Lab** (as the coach picks): grab two beakers, clap | Visual from the worksheet's reaction. "The reaction, colors and equation are AI-written and code-checked: atom balance and solubility rules." *(if hazard card)* "And it's virtual, because in real life that's toxic." |
| 1:38 | **Balancer** if the coach picks it and time allows; else press `N` | Scale levels, confetti |
| 1:45 | Point at the phone's AI insights | "The summary only uses real counts: code rejects any number the AI invents. *[Read one bullet.]*" *(if Wow #3 is built)* "And one tap writes tomorrow's warm-up for this class." |
| 1:53 | Close | "[Business name] is testing it. Any worksheet, an AI coach for every student, every answer checked by code." |

## 3. Backup plan (decide in 2 seconds)
| Failure | Switch to |
|---|---|
| Camera / tracking flaky | Keyboard twins (B drives). Say "same controls on keyboard" |
| Scan > 25 s, or 429 | "Let me use the last scan" → **Use last scan** button (no new AI call) |
| Coach slow or down | The game already continued (6 s fallback). Say "the coach falls back to the worksheet order when it's slow" and open the trace |
| Wi-Fi down | Window 2 (offline replay); live view in a second window on the same laptop |
| Judge's phone can't load | Second laptop's live view |
| Everything | Backup video (Tab 3) |

## 4. Judge Q&A
- **"What if the AI is wrong?"** The AI never puts a number in front of a student. It writes formulas; mathjs computes the answer *and* every wrong answer. Equations are atom-counted, precipitates checked against solubility rules, and a Critic agent reviews chemistry claims. You saw code reject the coach's own question.
- **"What's actually AI here, and what's hard-coded?"** No content is hand-written: questions, mistakes, wrong answers, reactions, the next question and the summaries are all generated. Code only checks (math, atoms, solubility, schemas) and draws the 3D.
- **"How does the coach decide?"** After every answer it gets the student's model, the answer, and behavior traces: angles they tried, how long they hovered on each option, beaker pairs, coefficient steps. It chooses next / new variant / probe / finish, with code-enforced limits and a 6-second fallback.
- **"Are the classmates real?"** No, and the app says so: an agent simulates 4 students with different profiles so the dashboard has a class. In a real classroom they're real students.
- **"How is this different from kinemo / PhET?"** Those use fixed content. We turn *this teacher's* worksheet into the level, adapt it per student, and show the teacher *named* mistakes live.
- **"Privacy?"** Pose runs on-device; no video is uploaded. Only the worksheet photo and numeric gesture events reach the server. Nicknames only; data expires in 24 h.
- **"Cost?"** Free-tier Gemini; one scan is 2–4 calls and a coach decision is 1 call on the fast model.
- **"Why seated?"** Classrooms are crowded and some students can't stand for long. Standing mode is next.
- **"Business model?"** Free for students. Tutoring centers and schools pay per classroom for the teacher view, history and warm-ups.
- **"What's next?"** Circuits, waves, stoichiometry; voice "ask why"; classroom race; Google Classroom export.
