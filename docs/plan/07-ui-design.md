# 07 · UI & Visual Design
**Owner:** D (Product/Content) · **Builds with:** A · **Depends on:** 01, 05, 06

> It must look premium from 2 m away on a laptop at a judging table, and the AI's work must be *visible*.

---

## 1. Look: "neon science arena"

| Token | Value | Use | Contrast on navy (checked) |
|---|---|---|---|
| Background | `#0B1020` dark navy + soft fog | Everything | — |
| Physics accent | cyan `#22D3EE` | Physics avatar, launcher, cards | 10.5:1 |
| Chemistry accent | magenta `#E879F9` | Chemistry avatar, Mix Lab, Balancer | 7.7:1 |
| AI accent | violet `#A78BFA` | 🧠 coach badge, AI trace, agent steps | 7.0:1 |
| Correct | lime `#A3E635` + ✓ icon | Correct pops, ✓ dots | 12.6:1 |
| Wrong | coral `#FB7185` + ✗ icon | Wrong pops, ✗ dots, ghost trail | 7.0:1 |
| Hazard | amber `#FBBF24` + ⚠️ | Reaction hazard cards, Review flags | 11.3:1 |
| Text | `#E5E7EB` | Body text | 15.3:1 |
| Muted | `#94A3B8` | Hints, caption labels | 7.4:1 |

- **Fonts:** Space Grotesk (headings) + Inter (body) via `next/font/google` (self-hosted at build, so offline works). HUD text ≥ 20 px. Captions ≥ 24 px.
- **3D polish:** `<Environment preset="city" />`, `<ContactShadows />`, `<Bloom intensity={0.8} luminanceThreshold={0.2} />`, gentle camera sway, `<Float>` on balloons (frozen while hovered), a sound on every action (CC0 sfx: pop, fizz, whoosh, correct, wrong).
- **Colorblind-safe:** never color alone. Always ✓/✗ icons, shapes and labels.

## 2. Screens

| # | Screen | Key elements | Judge-facing detail |
|---|---|---|---|
| 1 | **Landing** | Big 3D flask bubbling; **QR + class code card** (class already created); time budget picker ("2-min tour" / "10 min" / "Full worksheet"); "Scan a worksheet"; "Use last scan" | LIVE / OFFLINE · REPLAY pill top-left; "Camera video never leaves your laptop" |
| 2 | **Scan** | Drag-drop, "Take photo" (webcam snapshot), or "Upload from phone" (`capture="environment"`). **Live agent steps from the NDJSON stream:** Preparing photo → 🧠 Agent 1 reading & solving → Code checking answers ✓ → 🧠 Agent 2 modeling mistakes → Code computing wrong answers ✓ → Repair (if any) → Ready | Each step shows its real time ("4.2 s"). Keep each on screen ≥ 0.6 s |
| 3 | **Review** | One card per question: template icon, concept, editable numbers (edit → code recomputes all choices instantly), the AI-named mistakes, flags: ⚠️ "Answer key says 34.0 m. Code computes 35.3 m." · "Critic: check the color of the solid" · "dropped: …". "Critic reviewing…" spinner until it's done. "Play" | Flags prove "AI writes, code checks" |
| 4 | **Calibrate** | Small QR stays visible; head-and-shoulders silhouette; ✅ checklist incl. **aim test**; Seated/Standing toggle (Standing greyed until S1); Left-handed toggle; Forearm/Full-arm toggle; nickname field | QR ≥ 220 px so phones scan from 1 m |
| 5 | **Play HUD** | Top: question text (+ "🧠 New question from your coach" badge on variants). Left: score/streak. Right: small mirrored webcam with skeleton. Bottom: gesture hints. Captions bar above hints. 🧠 button opens the AI trace drawer (`T`) | Coach line appears in the caption bar as "Coach: …" |
| 6 | **Results** | Score, accuracy per concept, top mistake, coach's note, the variants the coach wrote, time played | — |
| 7 | **Live Teacher View** (phone) | See `06 §2` | The wow |
| 8 | **Print** (`/print/[wsId]`) | White page, black text, numbered questions, blank answer lines, small QR, footer "Written by Homework Arena's AI for class K7QF · checked by code" | Scan it back in to close the loop |

## 3. Gesture hint copy (exact text)

| Template / phase | Hint |
|---|---|
| Calibrate | "Sit back until your head and both hands are in the box" |
| Aim test | "Point your forearm up at about 45°" |
| Launcher, speed locked | "Forearm = angle · Speed is 🔒 20 m/s · Hold still to fire" (number from the question) |
| Launcher, angle locked | "Left hand = power · Angle is 🔒 30° · Hold still to fire" (swap sides if left-handed) |
| Mix Lab | "Hover a hand on a beaker to grab it · 👏 Clap to mix" |
| Balancer | "Hover on + / − to change numbers · Both hands up to check" |
| Balloons | "Hover on an answer · or lean and raise both hands" |
| Paused | "Step back into view" |

## 4. Accessibility
- Seated by default; captions for all speech; keyboard twin for everything (`04 §7`).
- Reduced-motion toggle: no camera sway, fewer particles, no confetti.
- Never require a real name.
- Contrast ≥ 4.5:1 for all text on navy (values above).

## 5. Figma / sketch deliverable (D, Sat 9–11 AM)
Low-fi frames for screens 2, 3, 5 (with the AI trace drawer open) and the phone view (390×844). A gets these by 11 AM. Don't polish Figma; polish the real app.
