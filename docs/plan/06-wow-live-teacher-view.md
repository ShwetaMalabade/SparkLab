# 06 · Wow Feature: Live Teacher View (+ classmates, insights, warm-up)
**Owners:** C (API + Mongo) and B (phone page UI) · **Depends on:** 02, 03, 05

> **The moment:** before the demo starts, the judge scans a QR code with their own phone. It says "Waiting for a worksheet…". We snap the page; the phone fills in with the worksheet and 4 AI-simulated classmates. As I play, the phone buzzes: *"Dharm chose 20.4 m ✗ · Used sin θ instead of sin 2θ."* Below it, the coach's decision appears: *"Wrote a new question at 50° to test sin 2θ."* The AI summary rewrites itself from real counts. The judge is holding the teacher's view of our product.

---

## 1. User flow

1. **Landing:** `POST /api/class` creates the class right away, so the **QR + class code** (e.g. `K7QF`) is on screen *before* the scan. The presenter picks the time budget ("2-min tour" for demos).
2. The judge scans → `/live/K7QF` on their phone. No login, no app. It shows **"Waiting for a worksheet…"**.
3. The scan finishes → the class is linked to the worksheet → the phone shows the questions. A few seconds later Agent 5 adds **4 simulated classmates**, each with a small **AI** badge and their profile on tap ("mixes up sin θ and sin 2θ").
4. The student calibrates (`POST /api/session`) and appears as **"Dharm (live)"**.
5. Each locked-in answer → within ≤ 3 s the phone:
   - toasts "**Dharm** chose **20.4 m** ✗ · Used sin θ instead of sin 2θ" (4 s)
   - vibrates briefly (`navigator.vibrate(80)`, Android only)
   - updates the grid, the per-question bars and **Top mistakes**
   - adds the coach's `reason` to **Coach decisions**
6. Every 20 s (or on tap) **AI insights** refresh: 3 bullets, re-teach groups, next move, with "✓ numbers checked".
7. **"Write tomorrow's warm-up"** button (Wow #3) → Agent 7 → a printable page opens.
8. A "Hide simulated students" toggle shows only real players.

## 2. Phone page layout (`/live/[code]`, mobile-first, 390 px wide)

```
┌─────────────────────────────────┐
│ ● LIVE  Physics & Chem Warm-up  │  class K7QF · 5 students (4 AI-simulated)
├─────────────────────────────────┤
│ [toast] Dharm chose 20.4 m ✗    │
│ Used sin θ instead of sin 2θ    │
├─────────────────────────────────┤
│ Students          q1 q2 q3 q4 q5│
│ Dharm (live)      ✗  ●  ·  ·  · │  ● = answering now
│ Ava  AI           ✓  ✓  ✓  ✓  ✗ │  (example: answers come from Agent 5)
│ Leo  AI           ✗  ✓  ✓  ✗  ✓ │
│ …                                │
├─────────────────────────────────┤
│ Top mistakes                     │
│ 1. sin θ vs sin 2θ    3/5 ▇▇▇   │
├─────────────────────────────────┤
│ Coach decisions                  │
│ • Dharm: hovered 35.3 m, picked  │
│   20.4 m → new question at 50°   │
├─────────────────────────────────┤
│ AI insights ✓ numbers checked    │
│ • … • … • …                      │
│ Re-teach: Leo, Sam, Dharm → sin 2θ│
│ Tomorrow: …                      │
│ [ Write tomorrow's warm-up ]     │
└─────────────────────────────────┘
```
Same colors as the app (`07`). Text ≥ 16 px. Works in Safari and Chrome mobile. The numbers above are an illustration; real ones come from the stats.

## 3. Polling (no toasts on first load)

```ts
// src/app/live/[code]/page.tsx (client component; code from useParams())
useEffect(() => {
  let stop = false, first = true, lastAt = "";
  const tick = async () => {
    try {
      const r = await fetch(`/api/class/${code}`, { cache: "no-store" });
      if (r.ok) {
        const s: ClassStats = await r.json();
        setStats(s);
        if (!first) for (const e of [...s.latest].reverse()) if (e.at > lastAt && !e.simulated) showToast(e);
        lastAt = s.latest[0]?.at ?? lastAt;   // ISO strings compare correctly
        first = false;                         // first poll only records the time
      }
    } catch {}
    if (!stop) setTimeout(tick, 2000);
  };
  tick(); return () => { stop = true; };
}, [code]);
```
Change streams do work on Atlas Free, but Vercel functions time out, so SSE would keep reconnecting. **Polling every 2 s is the design.**

## 4. `GET /api/class/[code]` → `ClassStats`

```ts
type ClassStats = {
  code: string; waiting: boolean;                 // true until a worksheet is linked
  worksheetTitle: string | null; updatedAt: string;
  ofStudents: number;                             // sessions with ≥ 1 attempt (shown or hidden simulated per toggle on the client)
  questions: { id: string; short: string; correctPct: number; n: number }[];          // worksheet questions only
  students: { sessionId: string; nickname: string; simulated: boolean; profile: string | null; live: boolean;
              answers: Record<string, "correct" | "wrong" | null>; variants: number; score: number }[];
  topMistakes: { misconceptionId: string; label: string; students: number; ofStudents: number; nicknames: string[] }[];
  latest: { nickname: string; simulated: boolean; questionId: string; chosenText: string; correct: boolean; label: string | null; at: string }[]; // newest first, max 5
  coachFeed: { nickname: string; reason: string; at: string }[];                         // last 5 director calls (aiCalls), newest first
};
```

**Aggregation** (one round trip, `$facet`; first attempt per student per question):
```js
db.attempts.aggregate([
  { $match: { classCode: code } },
  { $sort: { createdAt: 1 } },
  { $group: { _id: { s: "$sessionId", q: "$questionId" },
              origin: { $first: "$questionOrigin" },
              correct: { $first: "$correct" }, misconceptionId: { $first: "$misconceptionId" },
              chosenText: { $first: "$chosenText" }, simulated: { $first: "$simulated" }, at: { $first: "$createdAt" } } },
  { $facet: {
      perQuestion: [ { $match: { origin: "worksheet" } },
                     { $group: { _id: "$_id.q", n: { $sum: 1 }, right: { $sum: { $cond: ["$correct", 1, 0] } } } } ],
      perStudent:  [ { $group: { _id: "$_id.s", answers: { $push: { q: "$_id.q", origin: "$origin", correct: "$correct" } } } } ],
      mistakes:    [ { $match: { misconceptionId: { $ne: null } } },
                     { $group: { _id: "$misconceptionId", students: { $addToSet: "$_id.s" } } },
                     { $project: { students: 1, n: { $size: "$students" } } },
                     { $sort: { n: -1 } }, { $limit: 3 } ],
      latest:      [ { $sort: { at: -1 } }, { $limit: 5 } ],
  } },
])
```
Then in JS: load the class's `sessions` (nickname, simulated, profile, `endedAt`) and join them by session id (attempts don't store nicknames); `live` = no `endedAt`; `ofStudents` = number of sessions in `perStudent` (so the live student counts only after their first answer); labels come from the worksheet's `misconceptions` registry; `coachFeed` from `aiCalls` where `agent: "director", classCode`. Sort students: live first.

**Indexes:** `attempts {classCode: 1, createdAt: 1}`, `aiCalls {classCode: 1, createdAt: -1}`. **TTL:** every collection's `createdAt` is a BSON Date set by the server, with a 24 h TTL index, so demo data cleans itself up. Put this in the MongoDB prize write-up.

## 5. Simulated classmates (Agent 5, replaces the hand-made seed)

- Triggered in the background when the scan saves (`POST /api/class/[code]/simulate`, idempotent).
- Agent 5 returns 4 students with profiles and answers; **code** looks up each choice in the worksheet to set `correct`, `misconceptionId`, `chosenText`. The model never decides what's correct.
- Sessions: `simulated: true`, `profile`, `endedAt` set. Attempts: `simulated: true`, `createdAt` spread over the previous 20 minutes (no toasts; toasts also skip `simulated`).
- **Honesty:** the AI badge is always visible; the toggle hides them; the presenter says "four AI-simulated classmates" out loud.
- The demo numbers are **not** fixed in advance. The presenter reads the top mistake off the phone (`11 §2`).

## 6. AI insights (Agent 6) and warm-up (Agent 7)

- `POST /api/class/[code]/insights` → `InsightOut` (`03 §11`), cached 20 s. Code checks every number against the stats; failing text is replaced with a code-built line. If the call fails: show the last good result, or the code-built line alone.
- `POST /api/class/[code]/warmup` → `03 §12` → opens `/print/[wsId]` in a new tab. Button shows "Writing… (≈ 15 s)" with the live agent steps.

## 7. Offline fallback

- **Venue Wi-Fi down:** the demo laptop runs `OFFLINE=1 npm start` (02 §4). Open `localhost:3000/live/<code>` in a **second window on the same laptop** (or on the projector). It polls the same local server, so it works with no network. No BroadcastChannel is needed.
- The judge's phone can't reach the laptop offline. Say "this normally runs on your phone" and show the second window.
- **Gemini down, online:** insights show the last good bullets or the code-built line; the coach falls back to the next unplayed question; the trace shows "fallback".

## 8. Privacy + safety
- Nicknames only (max 16 chars, simple profanity filter list). No real names, no video, no photos of students.
- The live page is read-only. Class codes avoid look-alike characters and expire in 24 h.

## 9. Done when
- [ ] QR opens the live page on an iPhone and an Android phone, on venue Wi-Fi **and** cellular, *before* the scan ("Waiting for a worksheet…")
- [ ] After the scan, the worksheet appears, then 4 AI-badged classmates within 15 s
- [ ] No toasts on first load; each real locked-in answer toasts in ≤ 3 s (10/10)
- [ ] `ofStudents` counts the live student only after their first answer
- [ ] Coach decisions appear within 3 s of each answer
- [ ] Insight bullets: an injected fake number is rejected (unit test with `numbersAllowed`)
- [ ] Polling 3 phones for 10 minutes: no errors, Atlas connections stay < 50
- [ ] Offline second-window view works with Wi-Fi off
- [ ] TTL: a test document with `createdAt` 25 h ago disappears (Mongo's TTL monitor runs about once a minute)
