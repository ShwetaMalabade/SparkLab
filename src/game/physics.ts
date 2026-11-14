// src/game/physics.ts: projectile motion on level ground, analytic (docs/plan/05 §2). No physics engine.
//   x(t) = v·cosθ·t     y(t) = v·sinθ·t − ½·g·t²
//   T = 2·v·sinθ/g      R = v²·sin(2θ)/g      H = v²·sin²θ/(2g)
export const G = 9.81;
const rad = (deg: number) => (deg * Math.PI) / 180;

export const flightTime = (v: number, thetaDeg: number, g = G) => (2 * v * Math.sin(rad(thetaDeg))) / g;
export const range = (v: number, thetaDeg: number, g = G) => (v * v * Math.sin(2 * rad(thetaDeg))) / g;
export const maxHeight = (v: number, thetaDeg: number, g = G) => (v * v * Math.sin(rad(thetaDeg)) ** 2) / (2 * g);

export function position(v: number, thetaDeg: number, t: number, g = G): { x: number; y: number } {
  const th = rad(thetaDeg);
  return { x: v * Math.cos(th) * t, y: v * Math.sin(th) * t - 0.5 * g * t * t };
}

/** Launch speed that lands at distance R for angle θ (used to scale the ghost trail of a wrong answer). */
export const speedForRange = (R: number, thetaDeg: number, g = G) => Math.sqrt((Math.max(0, R) * g) / Math.sin(2 * rad(thetaDeg)));

/** Field length (05 §2): Rmax = v²/g (v = 30 m/s if speed is free), rounded up to the next 10 m, minimum 50 m. */
export function fieldLength(v: number | null, g = G): number {
  const rmax = ((v ?? 30) ** 2) / g;
  return Math.max(50, Math.ceil(rmax / 10) * 10);
}

/** Samples the full arc for drawing a trail: n+1 points from launch to landing. */
export function arc(v: number, thetaDeg: number, n = 60, g = G): { x: number; y: number }[] {
  const T = flightTime(v, thetaDeg, g);
  return Array.from({ length: n + 1 }, (_, i) => position(v, thetaDeg, (T * i) / n, g));
}

/** Speed from the power hand (04 §6): v = 5 + p·25 m/s. */
export const speedFromPower = (p: number) => 5 + Math.min(1, Math.max(0, p)) * 25;

/** Parses the number at the start of a choice text ("20.4 m" → 20.4), or null for non-numeric choices. */
export function choiceNumber(text: string): number | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)/.exec(text);
  return m ? Number(m[1]) : null;
}
