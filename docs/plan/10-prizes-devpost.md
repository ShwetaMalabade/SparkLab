# 10 · Prizes, Peri Outreach, Devpost
**Owner:** D (Product/Content) · **Depends on:** 01, 03, 06

---

## 1. Prize stack

| Prize | Status | How we qualify | What to show / write |
|---|---|---|---|
| **Best Education Hack** (main track, enroll here only) | ✅ Core | The whole product | Learning impact, real worksheet, adaptive coach, Live Teacher View |
| **Amazon: Best Practical AI Innovation** | ✅ **Primary sponsor target** | The prize text (as you shared it from Devpost) asks for a working prototype or demo, a clear use case and target user, basic documentation, and a pitch, and says teams may use open-source tools, LLM or other API services, custom or fine-tuned models, agentic frameworks, and Amazon platforms (AGI, SageMaker, Bedrock). So AWS is allowed, not required. **Re-read the final text on Devpost Saturday morning** (it was a placeholder on Friday) | (1) Clear user: Ms. Patel + Maya. (2) Working demo. (3) README with the 7-agent architecture diagram, "AI writes, code checks", and the AI trace. (4) Pitch: the coach writing a question live, and code rejecting a bad one. If Amazon credits arrive before Sun 12 AM, run Agent 4 on Bedrock and say so |
| **MLH: Best Use of Gemini API** | ✅ | Gemini runs 7 agents: vision reading, mistake modeling, critic, live coach with question writing, simulated class, insights, warm-up | Architecture slide; AI trace drawer; the Scan screen's live agent steps |
| **MLH: Best Use of MongoDB Atlas** | ✅ | Worksheets, classes, sessions, attempts, `aiCalls` (every agent decision); `$facet` aggregation powers the live view; TTL indexes on Date fields auto-clean | Show the aggregation and the `aiCalls` log in the README |
| **Peri: Forward Deployed Challenge** | ⏳ Needs a real business | A local tutoring center / after-school STEM program / a teacher whose school agrees. **Ask them for a real worksheet**: it becomes the demo worksheet | `PERI.md` with evidence (§3) |
| **MLH: Best Domain Name (GoDaddy)** | ✅ Cheap win | Register with the MLH code, e.g. a "labarena"-style name | Put it on Devpost |
| Photon, LangChain deepagents | ❌ Skip unless someone attends their workshop | — | Don't force it |
| Arlequin tracks | ❌ Not a fit | — | Skip |

**Precedent (from our earlier research):** last fall, MindPad (a gesture + voice study tool) won Best Overall, Best Use of Gemini and Amazon's Best Practical AI Innovation at HackPrinceton with one project. Track winners can't also win Best Overall, but sponsor prizes stack.

**Honesty rule:** only claim a technology that runs in the submitted build. Simulated classmates are always called simulated. Judges check.

## 2. The AI-prize pitch in 3 sentences
1. "Seven AI agents turn any teacher's worksheet into an adaptive 3D lab, and an AI coach decides what each student plays next by watching *how* they experiment."
2. "The AI writes everything (questions, wrong answers, reactions, new questions mid-game), and code checks every number before a student sees it. You just saw it reject the coach's own question at 60°."
3. "The teacher sees named mistakes, the coach's decisions, and gets tomorrow's warm-up written for her class."

## 3. Peri outreach (D, Saturday by 10 AM)

**Targets (contact 3, expect 1):** a local tutoring center (independent STEM tutors near Princeton), a high-school science teacher one of us knows, a school science club advisor. Phone or email + walk-in if close.

**Script:**
> "Hi, we're students at HackPrinceton building a tool that turns physics and chemistry worksheets into 3D games students play with their hands. An AI coach adapts the questions to each student, and the teacher sees each student's specific mistakes live on their phone. Could we show you a 5-minute demo today, and could you share one worksheet you actually use? We'd love to build it around your center and quote you in our project."

**Collect (with permission):** business name, contact name and role, contact details, date/time, 1–2 quotes, one photo or 20-second video, **one real worksheet**, the pain they told us, **one change we made because of them** (judges want this). Put it all in `PERI.md` and on Devpost.

**If nobody responds by 1 PM:** a teacher we know is the fallback; tell judges honestly what kind of user it is.

## 4. Devpost write-up

- **Name:** Homework Arena: Physics & Chemistry Lab
- **Tagline:** Snap a worksheet. Play it with your hands. An AI coach adapts every question, and code checks every answer.
- **Inspiration:** physics and chemistry are abstract; labs are limited; homework is the same for everyone; teachers learn about confusion after the test.
- **What it does:** (1) snap any worksheet, (2) 7 AI agents build 3D levels and **code checks every number**, including the answer key, (3) play seated with your hands via the webcam, (4) an AI coach reads how you experiment and writes new questions for your exact mistake, (5) the teacher watches named mistakes and the coach's decisions live, and gets tomorrow's warm-up. GIFs: Launcher, Mix Lab, Balancer, coach variant, phone view, AI trace.
- **How we built it:** Next.js, React Three Fiber, MediaPipe Pose (on-device), Gemini (7 agents: vision reader-solver, mistake modeler + level designer, critic, coach, classmate simulator, teacher insight, warm-up writer), mathjs + a custom chemistry parser + solubility rules for verification, MongoDB Atlas (`$facet`, TTL, AI call log), Web Speech API, Vercel.
- **Challenges:** gestures that work seated in a crowded hall; making AI output trustworthy (two-layer schemas, code-computed wrong answers, repair loop, number-checked summaries); keeping the coach fast enough to think during a 5-second reveal.
- **Accomplishments:** nothing hand-written: every question and wrong answer is AI-generated and code-verified; the coach's own bad question gets caught by code live; privacy-first tracking; a teacher view that updates in under 3 s.
- **What we learned / next:** circuits, waves, stoichiometry templates; voice "ask why"; classroom race; Google Classroom export.
- **Built with:** nextjs, react, three.js, react-three-fiber, mediapipe, gemini, mongodb-atlas, mathjs, zod, typescript, vercel (+ amazon-bedrock only if used).
- **Track:** Best Education Hack. **Sponsor prizes:** Amazon Best Practical AI Innovation, MLH Gemini, MLH MongoDB, Peri, GoDaddy domain.
- **Links:** live URL, public GitHub repo, 2-minute video, `PERI.md`, README architecture section.

## 5. Submission checklist
- [ ] GitHub repo **public**, created after Fri 8 PM; README with setup, `.env.example`, the 7-agent architecture diagram, "AI writes, code checks" section, CC0 asset credits
- [ ] `.env.local` **not** committed; keys rotated after the event
- [ ] Live Vercel URL works in incognito
- [ ] Offline build tested on the demo laptop (`OFFLINE=1`), replay file committed
- [ ] 2-minute demo video uploaded
- [ ] Enrolled in **one** main track (Education); sponsor prizes selected; all 4 teammates added
- [ ] `PERI.md` with evidence
- [ ] Printed worksheet ×3, both laptops charged, phone hotspot ready
- [ ] **Submitted by 7:30 AM** (deadline 8:15 AM)
