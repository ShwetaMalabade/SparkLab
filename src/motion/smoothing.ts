// src/motion/smoothing.ts: exponential moving average, α = 0.4 per point (docs/plan/04 §6).
import type { Px } from "./types";

export const ALPHA = 0.4;

export const ema = (prev: number, next: number, a = ALPHA) => prev + a * (next - prev);

/** Smooths a whole landmark list in place-free fashion. Visibility is passed through unsmoothed. */
export class PointSmoother {
  private prev: Px[] | null = null;

  constructor(private readonly alpha = ALPHA) {}

  push(pts: Px[]): Px[] {
    const prev = this.prev;
    const out = pts.map((p, i) =>
      prev && prev[i]
        ? { x: ema(prev[i].x, p.x, this.alpha), y: ema(prev[i].y, p.y, this.alpha), visibility: p.visibility }
        : { ...p },
    );
    this.prev = out;
    return out;
  }

  reset() {
    this.prev = null;
  }
}
