# 04 · Motion System (Seated First)
**Owner:** B (Motion) · **Helps:** A (templates subscribe to these events) · **Depends on:** 02

> The hardest part of the project. Build it first, test it with 3 different people and 2 lighting setups, and keep the debug overlay one key away.

---

## 1. Why seated is the default

Judging happens at tables in a crowded, noisy, unevenly lit hall. Seated needs no floor space: the student (or judge) sits **0.6–1.2 m** from the laptop, and the camera only needs **head, shoulders, arms and hands**. Standing mode is stretch S1.

**Framing math (why we aim with the forearm):** a laptop webcam sees roughly 1 m wide at 0.8 m. Shoulders are ~0.4 m wide, and a straight arm adds ~0.6–0.7 m. A fully extended arm at 45° puts the wrist ~0.7 m from center, outside the frame, and tracking-lost would pause the game. Aiming with the **forearm** (elbow → wrist, elbow near the body) keeps the hand in frame. Confirm in hour 1 with the protractor test (`09 §3`); if the full arm stays in frame at the venue distance, keep the `fullArm` option.

## 2. MediaPipe setup (`src/motion/pose.ts`)

```ts
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export async function createPose() {
  const vision = await FilesetResolver.forVisionTasks("/mediapipe-wasm");
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate },
    runningMode: "VIDEO" as const,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try { return await PoseLandmarker.createFromOptions(vision, opts("GPU")); }
  catch { return await PoseLandmarker.createFromOptions(vision, opts("CPU")); } // some laptops fail GPU init
}

export function startLoop(video: HTMLVideoElement, lm: PoseLandmarker,
                          onFrame: (pts: any[] | null, t: number) => void) {
  let last = -1, running = true;
  const tick = () => {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== last) {
      last = video.currentTime;
      const t = performance.now();
      onFrame(lm.detectForVideo(video, t).landmarks?.[0] ?? null, t);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { running = false; };
}
```
Camera: `getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })`, shown small in a corner, mirrored (`transform: scaleX(-1)`). Feed the **un-mirrored** video to MediaPipe so "left/right" stay the person's own. Model files are served from `/public`, so pose works with Wi-Fi off.

Open question R4: is Hand Landmarker better than Pose for seated use? Decision rule: stay on Pose unless its wrists are unreliable at 0.6–1.2 m. Pose gives shoulders and elbows (needed for `sw` and forearm aim); Hand Landmarker doesn't.

## 3. Landmarks used
`0` nose · `11/12` left/right shoulder · `13/14` left/right elbow · `15/16` left/right wrist. Left/right = the *person's* own. `x, y ∈ [0, 1]`, `y` grows downward. Hips `23/24` only in standing mode. Mirror for display: `screenX = 1 − x`.

**Aim side** (Calibrate toggle, default right-handed): aim arm = right (12/14/16), power hand = left (15). Left-handed swaps them.

## 4. Pixel space first (applies to everything below)

MediaPipe's `x` is a fraction of the frame *width*, `y` of the *height*. On 640×480, a real 45° arm reads **53°** in normalized units. So before any geometry:
```ts
const px = (p: { x: number; y: number }) => ({ x: p.x * video.videoWidth, y: p.y * video.videoHeight });
```
Every angle, distance and `sw` is computed on `px(...)` points. Only cursor positions are converted back to screen fractions.

## 5. Calibration (seated)

1. Silhouette of head and shoulders. Text: "Sit back until your head and both hands are in the box."
2. **Body check:** nose, both shoulders, both elbows and both wrists have `visibility > 0.6` for **2.0 s** in a row.
3. **Distance check:** `swFrac = sw / video.videoWidth` (with `sw = dist(px(11), px(12))` in pixels). If `swFrac < 0.12` → "Move a bit closer". If `swFrac > 0.45` → "Move back a bit".
4. **Framing check (new):** "Point your forearm up at about 45°." Pass when the aim elbow and wrist stay visible (> 0.6) with θ between 30° and 60° for 0.5 s. If the wrist drops out of view → "Move back a little so your hand stays in the picture."
5. Save `sw`, `baseShMid = mid(11, 12)`, `noseY` (pixels).
6. Live checklist: ✅ Head · ✅ Shoulders · ✅ Left hand · ✅ Right hand · ✅ Aim test.
7. The "Start" button (mouse) also unlocks audio for Web Speech, and creates the session (`POST /api/session`).

## 6. Gesture rules (`src/motion/gestures.ts`)

All distances are in units of `sw` (pixels), so they work at any distance and body size. Smoothing: EMA α = 0.4 on every point.

**Reach box** (seated hands move in a small area, so cursors map from a box around the shoulders):
```
boxLeft = shMid.x − 1.6·sw      boxRight  = shMid.x + 1.6·sw
boxTop  = nose.y  − 0.9·sw      boxBottom = shMid.y + 1.1·sw
cursorX = (1 − (wrist.x − boxLeft)/(boxRight − boxLeft)) · W    // mirrored
cursorY = ((wrist.y − boxTop)/(boxBottom − boxTop)) · H
clamp both to the screen
```

| Gesture | Rule | Cooldown | Used for |
|---|---|---|---|
| **Hand cursors** | Each wrist → reach box → screen | — | Pointing |
| **Hover** (new) | Cursor enters a target → start timer; on leave or select, emit `{type:"hover", targetId, ms}` if ms ≥ 150 | — | **Hover trace** for the AI coach |
| **Dwell select** | Cursor inside a target for **800 ms** (ring fills) | 500 ms | Balloons, beakers, +/− buttons, menus |
| **Both hands up** | Both wrists above `nose.y − 0.2·sw` for 3 frames | 700 ms | Confirm / Next / pick the highlighted balloon |
| **Clap** | Wrist distance `< 0.35·sw` **and** it was `> 1.2·sw` within the last 600 ms | 800 ms | MIX in Mix Lab |
| **Lean L/R** | `shMid.x` shift from baseline `> 0.40·sw` (mirrored) | 600 ms | Move the highlight between balloon lanes |
| **Aim angle θ** | Default `forearm`: `θ = atan2(elbow.y − wrist.y, |wrist.x − elbow.x|)`. Option `fullArm`: shoulder → wrist. Degrees, clamp 5°–85°, EMA | — | Launcher angle |
| **Power p** | Power wrist: `p = clamp((shoulder.y + 1.0·sw − wrist.y) / (2.0·sw), 0, 1)`; speed = `5 + p·25` m/s | — | Launcher speed |
| **Hold steady (fire)** | For 1.2 s: θ changes < 3° (**ignored if angle is locked**) **and** p changes < 0.04 (**ignored if speed is locked**), with θ ≥ 10° when angle is free → ring fills → `fire` | 2.5 s (ball in flight) | Launcher FIRE |
| **Tracking lost** | Nose, shoulders or aim wrist `visibility < 0.5` for 500 ms | — | Pause: "Step back into view" |

**Conflict rules (checked on paper, `09 §4`):**
- Mix Lab: `clap` is only armed once **both** hands hold a beaker.
- Launcher experiment phase: `bothUp` is ignored (it would wreck the aim).
- `hold steady` only exists in the Launcher experiment phase.
- Dwell targets are ≥ 160 px and ≥ 40 px apart.

**Event bus:** emits `{ type: "hover" | "dwell" | "bothUp" | "clap" | "lean" | "fire" | "lost" | "found", side?, targetId?, ms?, t }` into Zustand. Templates subscribe; they never read landmarks directly (except the Avatar and the Launcher's live θ/p). GameRunner collects `hover` events on answer targets into the attempt's `hoverTrace` (max 20 entries). This is what lets the coach say "you hovered on the right answer, then changed your mind."

## 7. Keyboard twins (every gesture)

| Gesture | Key |
|---|---|
| Dwell | Mouse click (mouse hover also records hover time) |
| Both hands up | Enter |
| Clap | C |
| Lean | ← / → |
| Aim angle | ↑ / ↓ (1° per press, hold to repeat) |
| Power | W / S |
| Fire | Space |
| Skip to next (demo safety) | N |
| Debug overlay | D |
| AI trace drawer | T |
| Pause | P |

Every attempt records `input: "gesture" | "keyboard" | "mouse"`, so the report is honest about it.

## 8. Debug overlay (hour 1, toggle `D`)
Landmarks and bones, the reach box, `sw` and `swFrac`, θ (forearm and full arm side by side), p, the steady timer, fps, and the last 5 events with timestamps.

## 9. Avatar (`src/three/Avatar.tsx`)
A glowing **upper-body** stick robot (spheres for joints, cylinders for bones) driven by landmarks: bones 11-12, 11-13, 13-15, 12-14, 14-16, plus a head sphere at 0. Emissive cyan (physics) / magenta (chemistry) + bloom. Map `(1 − x, y)` → world `X = (0.5 − x)·−4`, `Y = (1 − y)·3.5`, z = 0; tune the scale so it sits at the bench.

## 10. Recorded-landmark tests
Record **landmark JSON** (not video) for 10 s clips: `clap ×5`, `bothUp ×5`, `aim 30°/45°/60°` (forearm and full arm), `hold steady`, `hover A then pick B`, `walking past behind me`, `drinking water`, `scratching head`. Save to `tests/fixtures/*.json`. `tests/gestures.test.ts` replays each clip and asserts event counts ("drinking water" → 0 claps, 0 bothUp; "hover A then pick B" → hover A ≥ 500 ms, dwell B).

## 11. Standing mode (stretch S1, only after the MVP passes)
v1 rules for jump (`baseHipY − hipMidY > 0.35·sw`, 2 frames, 700 ms) and run in place, at 1.5–2.5 m. Toggle on Calibrate. Never the default demo.
