// src/three/quality.ts: keeps the arena at ≥ 30 fps with pose running (05 §8, P1-20).
// If the render loop stays under 30 fps for 3 s in a row, step quality down once, in the plan's order:
//   1 = half the particles · 2 = no environment lighting · 3 = bloom intensity 0.5.
// It never steps back up during a session (no flicker between levels).
import { create } from "zustand";

export const MIN_FPS = 30;
const SLOW_SECONDS = 3;
const WARMUP_SECONDS = 3; // shader compiles on the first frames

type Quality = { level: 0 | 1 | 2 | 3; renderFps: number; slow: number; seconds: number };
export const useQuality = create<Quality>(() => ({ level: 0, renderFps: 0, slow: 0, seconds: 0 }));

/** Called once a second with the measured render fps. */
export function reportFps(fps: number) {
  const q = useQuality.getState();
  const seconds = q.seconds + 1;
  if (typeof document !== "undefined" && document.hidden) return useQuality.setState({ seconds }); // background tab: not a real reading
  if (seconds <= WARMUP_SECONDS) return useQuality.setState({ renderFps: fps, seconds });
  const slow = fps < MIN_FPS ? q.slow + 1 : 0;
  if (slow >= SLOW_SECONDS && q.level < 3) {
    const level = (q.level + 1) as Quality["level"];
    console.info(`[quality] ${fps} fps for ${SLOW_SECONDS} s → level ${level}`);
    return useQuality.setState({ level, renderFps: fps, slow: 0, seconds });
  }
  useQuality.setState({ renderFps: fps, slow, seconds });
}

/** Particle count for the current level (level ≥ 1 halves it). */
export const particles = (n: number, level: number) => (level >= 1 ? Math.max(1, Math.round(n / 2)) : n);
