// src/motion/hands.ts: finger tracking (MediaPipe Hand Landmarker, 21 points per hand) on top of the body tracker.
// The body tracker still places the cursors (wrist → reach box, tuned and tested); this adds the hand SHAPE:
//   open ✋  → never selects (a resting hand is safe)
//   point ☝️ → hold on a target to select (menus)
//   fist ✊  → select instantly / grab and hold (answers, atoms, test tubes)
// plus the hand's tilt (roll) for pouring. Model + WASM are served from /public (offline-safe).
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { emit, useGame } from "@/game/store";
import type { HandShape, Side } from "./types";

type P = { x: number; y: number; z: number };

export async function createHands(): Promise<HandLandmarker> {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks("/mediapipe-wasm");
  const opts = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate },
    runningMode: "VIDEO" as const,
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await HandLandmarker.createFromOptions(vision, opts("GPU"));
  } catch {
    return await HandLandmarker.createFromOptions(vision, opts("CPU"));
  }
}

let handsPromise: Promise<HandLandmarker> | null = null;
/** One hand landmarker per page load (same reason as getPose). */
export function getHands() {
  handsPromise ??= createHands().catch((e) => {
    handsPromise = null;
    throw e;
  });
  return handsPromise;
}

const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Shape of one hand from its 21 landmarks (pure; tested). Image coords, any scale. */
export function classifyHand(lm: P[]): { shape: HandShape; tilt: number } {
  const wrist = lm[0];
  const palm = d(wrist, lm[9]) || 1e-6; // wrist → middle-finger knuckle
  // A finger is extended when its tip is clearly farther from the wrist than its middle joint.
  const ext = (tip: number, pip: number) => d(lm[tip], wrist) > d(lm[pip], wrist) * 1.12 && d(lm[tip], wrist) > palm * 1.15;
  const index = ext(8, 6), middle = ext(12, 10), ring = ext(16, 14), pinky = ext(20, 18);
  const n = [index, middle, ring, pinky].filter(Boolean).length;
  // Fist: all four fingertips curled close to the palm centre.
  const centre = { x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5, y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5, z: 0 };
  const curl = [8, 12, 16, 20].reduce((s, i) => s + d(lm[i], centre), 0) / 4 / palm;
  let shape: HandShape = "other";
  if (n === 0 && curl < 0.95) shape = "fist";
  else if (index && !middle && !ring && !pinky) shape = "point";
  else if (n >= 3) shape = "open";
  // Tilt (roll): angle of the knuckle line (index → pinky knuckles) from horizontal, degrees, −180..180.
  const tilt = (Math.atan2(lm[17].y - lm[5].y, lm[17].x - lm[5].x) * 180) / Math.PI;
  return { shape, tilt };
}

type SideState = { shape: HandShape; candidate: HandShape; frames: number; tilt: number };
const fresh = (): SideState => ({ shape: "other", candidate: "other", frames: 0, tilt: 0 });

/** Turns per-frame detections into stable per-side shapes (3-frame debounce) + grab/release events. */
export class HandTracker {
  private s: Record<Side, SideState> = { left: fresh(), right: fresh() };
  private lost: Record<Side, number> = { left: 0, right: 0 };

  /**
   * `hands`: landmarks in normalised image coords; `poseWrists`: the body tracker's wrists in the same coords
   * (null if not visible). Each hand goes to the side whose wrist is nearest, so left/right always match the cursors.
   */
  update(hands: P[][], poseWrists: Record<Side, { x: number; y: number } | null>, t: number) {
    const seen: Partial<Record<Side, P[]>> = {};
    for (const lm of hands) {
      let best: Side | null = null, bestD = 0.25; // must be within 25% of the frame of a body wrist
      for (const side of ["left", "right"] as const) {
        const w = poseWrists[side];
        if (!w || seen[side]) continue;
        const dd = Math.hypot(w.x - lm[0].x, w.y - lm[0].y);
        if (dd < bestD) {
          bestD = dd;
          best = side;
        }
      }
      if (best) seen[best] = lm;
    }
    const out = { ...useGame.getState().hands };
    for (const side of ["left", "right"] as const) {
      const st = this.s[side];
      const lm = seen[side];
      if (!lm) {
        if (++this.lost[side] > 6 && st.shape !== "other") this.set(side, "other", t);
        out[side] = { ...out[side], shape: this.s[side].shape };
        continue;
      }
      this.lost[side] = 0;
      const c = classifyHand(lm);
      st.tilt = st.tilt * 0.6 + c.tilt * 0.4;
      if (c.shape === st.candidate) st.frames++;
      else {
        st.candidate = c.shape;
        st.frames = 1;
      }
      // Fist registers fast (3 frames ≈ 100 ms) so grabbing feels instant; other shapes need 4.
      if (st.candidate !== st.shape && st.frames >= (st.candidate === "fist" ? 3 : 4)) this.set(side, st.candidate, t);
      out[side] = { shape: this.s[side].shape, tilt: st.tilt, seen: t };
    }
    useGame.getState().setHands(out);
  }

  private set(side: Side, shape: HandShape, t: number) {
    const was = this.s[side].shape;
    this.s[side].shape = shape;
    if (shape === "fist" && was !== "fist") {
      const c = useGame.getState().cursors[side];
      emit({ type: "grab", side, targetId: c.visible ? c.targetId ?? undefined : undefined, t, source: "gesture" });
    } else if (was === "fist" && shape !== "fist") emit({ type: "release", side, t, source: "gesture" });
  }

  reset() {
    this.s = { left: fresh(), right: fresh() };
  }
}

export const handTracker = new HandTracker();
