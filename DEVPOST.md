# Devpost draft: Homework Arena

Draft for the Devpost form (from `docs/plan/10 §4`, updated to what this build actually runs). Copy each section into the matching field.
**Honesty rule (`10 §1`):** claim only what runs in the submitted build. Fill every `[TODO]` before submitting, and delete any line that's still not true at 7:30 AM.

---

**Name:** Homework Arena: Physics & Chemistry Lab

**Tagline:** Snap a worksheet. Play it with your hands. An AI coach adapts every question, and code checks every answer.

## Inspiration
Physics and chemistry are abstract, real labs are limited, and homework is the same for every student. Teachers usually find out what a class misunderstood after the test, when it's too late to fix it. We wanted the worksheet a teacher already uses to turn into something students *do*, and we wanted the teacher to see each mistake as it happens.

## What it does
1. **Snap any worksheet.** A photo of a real physics or chemistry worksheet becomes a playable 3D lab [TODO add the measured scan time once the real scan is timed]. The Scan screen shows each AI agent and each code check as it runs.
2. **AI writes, code checks every number.** The AI reads and solves the page and predicts the mistakes students make, writing a *wrong formula* for each one. Then our code computes every answer and every wrong choice itself, balances every equation and checks every reaction. It even checks the printed answer key: on our demo sheet it flags *"key says 34.0 m, code computes 35.3 m."*
3. **Play seated, with your hands.** The webcam tracks your arms on-device (no video ever leaves the laptop). Aim a projectile launcher with your forearm, mix chemicals in a lab, balance equations on a scale, or pop answer balloons. Every gesture also has a keyboard key.
4. **An AI coach adapts to *how* you experiment.** After every answer, the coach reads what you did (which answers you hovered over, which angles you tried, which beakers you mixed) and decides what comes next. It can write a brand-new question aimed at your exact mistake. Code re-checks every question the coach writes, and we show it rejecting the coach's own bad question live.
5. **The teacher watches live on their phone.** Scan a QR code, no login. Each answer appears within seconds with the mistake named ("Used sin θ instead of sin 2θ"). The phone also shows the class's top mistakes, per-question results, the coach's decisions, and AI insights where **every number is checked by code** before it's shown.
6. **Results** for the student: score, accuracy by topic, their top mistake explained, and the questions the coach wrote for them.

[TODO GIFs: Launcher, Mix Lab, Equation Balancer, a coach-written question, the phone view, the AI trace drawer]

## How we built it
- **Next.js 16** (App Router, TypeScript strict) on **Vercel**; **React Three Fiber** + drei + postprocessing for the 3D lab.
- **MediaPipe Pose**, running entirely in the browser (WASM + model served locally), for seated forearm aiming and gestures.
- **Gemini** runs 4 agents through one wrapper (`askJSON`): timeout, retry, Zod validation, and a log of every call.
  1. **Reader-Solver** (vision): reads the photo, solves each question, writes the formula.
  2. **Mistake Modeler + Level Designer**: predicts misconceptions, writes a wrong formula for each, picks a game template.
  3. **Coach**: picks the next step after every answer and can write a new question.
  4. **Teacher Insight**: summarizes the class for the teacher.
- **Verification in code:** mathjs (formulas, units, the degrees-vs-radians trap), our own chemistry parser (atom balancing, every arrow style, solubility rules), and a two-layer schema. The AI fills *draft* schemas, and `assemble()` builds the final question, so no number a student sees comes from the model.
- **MongoDB Atlas:** worksheets, classes, sessions, attempts, and an `aiCalls` log of every agent decision. One `$facet` aggregation computes the whole live teacher view (first attempt per student per question, top mistakes, per-question accuracy). TTL indexes delete demo data after 24 h.
- **Offline mode:** an in-memory store plus recorded real AI outputs, so the demo runs with the Wi-Fi off.
- Web Speech API for spoken feedback; sound effects we generated ourselves.

## Challenges we ran into
- Making AI output trustworthy enough to put in front of students: two-layer schemas, code-computed wrong answers, a repair loop that sends code's exact errors back to the model, and number-checked teacher summaries.
- Gestures that work **seated** in a crowded hall, with people walking behind you.
- Keeping the coach fast: the game never waits more than 6 seconds. If the coach is slow, code picks the next question and the trace says "fallback".
- [TODO one real bug story from the weekend]

## Accomplishments that we're proud of
- Nothing hand-written: every question and wrong answer is AI-generated and code-verified, and code catches a wrong printed answer key.
- The coach's own bad question gets caught by code, live, and it shows up in the AI trace.
- Privacy-first tracking: camera frames never leave the laptop.
- A teacher view that needs no login and updates every 2 seconds.

## What we learned
[TODO 2–3 honest sentences]

## What's next
Circuits, waves and stoichiometry templates; voice "ask why"; a classroom race mode; Google Classroom export; a printable warm-up written from the class's top mistakes.

## Built with
nextjs, react, typescript, three.js, react-three-fiber, mediapipe, gemini, mongodb-atlas, mathjs, zod, tailwindcss, vercel

## Track and prizes
- **Track:** Best Education Hack (enroll in this one main track only)
- **Sponsor prizes:** Amazon Best Practical AI Innovation, MLH Best Use of Gemini API, MLH Best Use of MongoDB Atlas, Peri Forward Deployed Challenge, MLH Best Domain Name (GoDaddy)

## Peri (Forward Deployed Challenge)
[TODO from `PERI.md`: who (business, role), the pain they told us, 1–2 quotes, a photo with permission, and **the one change we made because of them**]

## Links
- Live: [TODO Vercel URL or GoDaddy domain]
- Repo: https://github.com/ShwetaMalabade/SparkLab
- Video (2 min): [TODO]
- Peri evidence: `PERI.md` · Architecture: README

---
### Before submitting (`10 §5`)
- [ ] Every `[TODO]` filled or the line removed
- [ ] Simulated classmates: if Agent 5 ships, add it as a 5th agent and always call them "AI-simulated". If not, leave it out
- [ ] No claim of Critic, warm-up writer or Bedrock (cut / not used)
- [ ] Live URL works in incognito; video uploaded; both teammates added; submitted by **7:30 AM**
