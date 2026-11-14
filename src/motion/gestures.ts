// src/motion/gestures.ts: the gesture engine (docs/plan/04 §4–§6).
// Every distance and angle is computed in VIDEO PIXELS first (04 §4); only cursors go back to screen pixels.
// All distances are in units of sw (shoulder width), so rules work at any distance and body size.
import { emit, useGame } from "@/game/store";
import type { RawLandmark } from "./pose";
import { ema, PointSmoother } from "./smoothing";
import { hitTest, HOVER_MIN_MS } from "./targets";
import type { AimMode, Baseline, Cursor, GestureEvent, MotionFrame, Px, Side } from "./types";

// Landmark ids (04 §3). Left/right = the person's own.
export const NOSE = 0, L_SH = 11, R_SH = 12, L_EL = 13, R_EL = 14, L_WR = 15, R_WR = 16;

// Thresholds (04 §6). Tune these, not the rules (09 §3).
export const T = {
  dwellMs: 800,
  dwellCooldownMs: 500,
  bothUpFrames: 3,
  bothUpAboveNose: 0.2, // × sw
  bothUpCooldownMs: 700,
  clapClose: 0.35, // × sw
  clapOpen: 1.2, // × sw
  clapWindowMs: 600,
  clapCooldownMs: 800,
  lean: 0.4, // × sw
  leanReset: 0.2, // × sw: must come back this close to center before the next lean
  leanCooldownMs: 600,
  lostVis: 0.5,
  lostMs: 500,
  cursorVis: 0.5,
  steadyMs: 1200,
  steadyDeg: 3,
  steadyPower: 0.04,
  fireMinDeg: 10,
  fireCooldownMs: 2500,
} as const;

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const deg = (rad: number) => (rad * 180) / Math.PI;

type HoverState = { targetId: string | null; enterT: number; hoverStart: number; cooldownUntil: number };
const freshHover = (): HoverState => ({ targetId: null, enterT: 0, hoverStart: 0, cooldownUntil: 0 });
const hiddenCursor = (): Cursor => ({ x: 0, y: 0, visible: false, targetId: null, dwell: 0 });

export type EngineOptions = {
  leftHanded: boolean;
  aimMode: AimMode;
  /** Launcher locks (05 §2): a locked control is ignored by hold-steady. */
  lockAngle: boolean;
  lockSpeed: boolean;
};

export class GestureEngine {
  opts: EngineOptions = { leftHanded: false, aimMode: "forearm", lockAngle: false, lockSpeed: false };
  baseline: Baseline | null = null;
  latest: MotionFrame = emptyFrame();

  private smoother = new PointSmoother();
  private frameListeners = new Set<(f: MotionFrame) => void>();
  private rawListeners = new Set<(raw: RawLandmark[] | null, t: number, vw: number, vh: number, sw: number, sh: number) => void>();
  private hover: Record<Side, HoverState> = { left: freshHover(), right: freshHover() };
  private bothUpCount = 0;
  private bothUpLatched = false;
  private bothUpLast = -Infinity;
  private clapHist: { t: number; d: number }[] = [];
  private clapLast = -Infinity;
  private leanLatched = false;
  private leanLast = -Infinity;
  private badSince: number | null = null;
  private isLost = false;
  private theta = 45;
  private thetaFore = 45;
  private thetaFull = 45;
  private power = 0;
  private steady = { t0: 0, theta0: 45, p0: 0 };
  private fireLast = -Infinity;
  private fpsFrames = 0;
  private fpsSince = 0;
  private fps = 0;

  setOptions(o: Partial<EngineOptions>) {
    this.opts = { ...this.opts, ...o };
  }

  setBaseline(b: Baseline | null) {
    this.baseline = b;
    this.leanLatched = false;
  }

  onFrame(fn: (f: MotionFrame) => void): () => void {
    this.frameListeners.add(fn);
    return () => {
      this.frameListeners.delete(fn);
    };
  }

  /** Every raw input frame, before any processing (the P1-19 clip recorder). */
  onRaw(fn: (raw: RawLandmark[] | null, t: number, vw: number, vh: number, sw: number, sh: number) => void): () => void {
    this.rawListeners.add(fn);
    return () => {
      this.rawListeners.delete(fn);
    };
  }

  reset() {
    this.smoother.reset();
    this.hover = { left: freshHover(), right: freshHover() };
    this.bothUpCount = 0;
    this.bothUpLatched = false;
    this.clapHist = [];
    this.badSince = null;
    this.isLost = false;
  }

  /** Feed one MediaPipe result. `screenW/H` = viewport size for the cursors. */
  process(raw: RawLandmark[] | null, t: number, videoW: number, videoH: number, screenW: number, screenH: number) {
    this.rawListeners.forEach((fn) => fn(raw, t, videoW, videoH, screenW, screenH));
    this.fpsFrames++;
    if (t - this.fpsSince >= 1000) {
      this.fps = Math.round((this.fpsFrames * 1000) / (t - this.fpsSince));
      this.fpsFrames = 0;
      this.fpsSince = t;
    }

    const aim = this.opts.leftHanded ? { sh: L_SH, el: L_EL, wr: L_WR } : { sh: R_SH, el: R_EL, wr: R_WR };
    const pow = this.opts.leftHanded ? { sh: R_SH, wr: R_WR } : { sh: L_SH, wr: L_WR };

    // ---- Tracking lost / found (nose, shoulders or aim wrist visibility < 0.5 for 500 ms) ----
    const keyOk =
      !!raw && [NOSE, L_SH, R_SH, aim.wr].every((i) => (raw[i]?.visibility ?? 0) >= T.lostVis);
    if (keyOk) {
      this.badSince = null;
      if (this.isLost) {
        this.isLost = false;
        this.fire({ type: "found", t, source: "gesture" });
      }
    } else {
      this.badSince ??= t;
      if (!this.isLost && t - this.badSince >= T.lostMs) {
        this.isLost = true;
        this.fire({ type: "lost", t, source: "gesture" });
      }
    }

    if (!raw) {
      this.smoother.reset();
      this.endHovers(t);
      this.publish({ ...emptyFrame(), t, videoW, videoH, fps: this.fps, tracking: false, theta: this.theta, power: this.power });
      return;
    }

    // ---- Pixel space first (04 §4), then EMA α = 0.4 ----
    const pxRaw: Px[] = raw.map((p) => ({ x: p.x * videoW, y: p.y * videoH, visibility: p.visibility ?? 0 }));
    const pts = this.smoother.push(pxRaw);
    const vis = (i: number) => pts[i].visibility >= T.cursorVis;

    const sw = Math.max(1, dist(pts[L_SH], pts[R_SH]));
    const shMid = { x: (pts[L_SH].x + pts[R_SH].x) / 2, y: (pts[L_SH].y + pts[R_SH].y) / 2 };
    const nose = pts[NOSE];

    // ---- Reach box → mirrored screen cursors (04 §6) ----
    const box = {
      left: shMid.x - 1.6 * sw,
      right: shMid.x + 1.6 * sw,
      top: nose.y - 0.9 * sw,
      bottom: shMid.y + 1.1 * sw,
    };
    const toCursor = (wr: Px): { x: number; y: number } => ({
      x: clamp((1 - (wr.x - box.left) / (box.right - box.left)) * screenW, 0, screenW),
      y: clamp(((wr.y - box.top) / (box.bottom - box.top)) * screenH, 0, screenH),
    });

    const cursors = { left: hiddenCursor(), right: hiddenCursor() };
    const armed = useGame.getState().armed;
    for (const side of ["left", "right"] as const) {
      const wi = side === "left" ? L_WR : R_WR;
      if (!vis(wi)) {
        this.endHover(side, t);
        continue;
      }
      const c = toCursor(pts[wi]);
      const id = hitTest(c.x, c.y);
      cursors[side] = { ...c, visible: true, targetId: id, dwell: this.stepDwell(side, id, t, armed.dwell) };
    }

    // ---- Both hands up: both wrists above nose.y − 0.2·sw for 3 frames, 700 ms cooldown ----
    const upLine = nose.y - T.bothUpAboveNose * sw;
    const bothUp = vis(L_WR) && vis(R_WR) && pts[L_WR].y < upLine && pts[R_WR].y < upLine;
    if (bothUp) {
      this.bothUpCount++;
      if (this.bothUpCount >= T.bothUpFrames && !this.bothUpLatched && t - this.bothUpLast >= T.bothUpCooldownMs) {
        this.bothUpLatched = true; // hands must come down before the next one
        this.bothUpLast = t;
        this.fire({ type: "bothUp", t, source: "gesture" });
      }
    } else {
      this.bothUpCount = 0;
      this.bothUpLatched = false;
    }

    // ---- Clap: wrists < 0.35·sw AND they were > 1.2·sw within the last 600 ms ----
    if (vis(L_WR) && vis(R_WR)) {
      const d = dist(pts[L_WR], pts[R_WR]) / sw;
      this.clapHist.push({ t, d });
      this.clapHist = this.clapHist.filter((h) => t - h.t <= T.clapWindowMs);
      if (d < T.clapClose && t - this.clapLast >= T.clapCooldownMs && this.clapHist.some((h) => h.d > T.clapOpen)) {
        this.clapLast = t;
        this.clapHist = [];
        this.fire({ type: "clap", t, source: "gesture" });
      }
    } else {
      this.clapHist = [];
    }

    // ---- Lean L/R: shMid.x shift from baseline > 0.40·sw ----
    if (vis(L_SH) && vis(R_SH)) {
      this.baseline ??= { sw, shMidX: shMid.x, shMidY: shMid.y, noseY: nose.y }; // until calibration sets one
      const dx = shMid.x - this.baseline.shMidX;
      if (Math.abs(dx) < T.leanReset * sw) this.leanLatched = false;
      if (Math.abs(dx) > T.lean * sw && !this.leanLatched && t - this.leanLast >= T.leanCooldownMs) {
        this.leanLatched = true;
        this.leanLast = t;
        // Un-mirrored video: the person's left is +x. On the mirrored screen that is LEFT.
        this.fire({ type: "lean", side: dx > 0 ? "left" : "right", t, source: "gesture" });
      }
    }

    // ---- Aim angle θ (forearm default, or full arm), degrees, clamp 5°–85°, EMA ----
    if (vis(aim.el) && vis(aim.wr)) {
      const el = pts[aim.el], wr = pts[aim.wr], sh = pts[aim.sh];
      this.thetaFore = clamp(deg(Math.atan2(el.y - wr.y, Math.abs(wr.x - el.x))), 5, 85);
      this.thetaFull = clamp(deg(Math.atan2(sh.y - wr.y, Math.abs(wr.x - sh.x))), 5, 85);
      this.theta = ema(this.theta, this.opts.aimMode === "forearm" ? this.thetaFore : this.thetaFull);
    }
    // ---- Power p from the power hand ----
    if (vis(pow.wr)) {
      const p = clamp((pts[pow.sh].y + 1.0 * sw - pts[pow.wr].y) / (2.0 * sw), 0, 1);
      this.power = ema(this.power, p);
    }

    // ---- Hold steady → fire (only armed in the Launcher experiment phase) ----
    const aimVisible = vis(aim.el) && vis(aim.wr);
    const moved =
      (!this.opts.lockAngle && Math.abs(this.theta - this.steady.theta0) >= T.steadyDeg) ||
      (!this.opts.lockSpeed && Math.abs(this.power - this.steady.p0) >= T.steadyPower) ||
      (!this.opts.lockAngle && !aimVisible);
    if (moved) this.steady = { t0: t, theta0: this.theta, p0: this.power };
    const steadyMs = t - this.steady.t0;
    if (
      armed.fire &&
      steadyMs >= T.steadyMs &&
      (this.opts.lockAngle || this.theta >= T.fireMinDeg) &&
      t - this.fireLast >= T.fireCooldownMs
    ) {
      this.fireLast = t;
      this.steady = { t0: t, theta0: this.theta, p0: this.power };
      this.fire({ type: "fire", t, source: "gesture" });
    }

    this.publish({
      t, videoW, videoH, pts,
      norm: raw.map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 0 })),
      sw, shMid, box, cursors,
      theta: this.theta, thetaForearm: this.thetaFore, thetaFullArm: this.thetaFull,
      power: this.power, steadyMs, tracking: keyOk, fps: this.fps,
    });
  }

  /** Dwell: cursor inside the same target for 800 ms (ring fills), 500 ms cooldown. Also tracks hover time. */
  private stepDwell(side: Side, id: string | null, t: number, dwellArmed: boolean): number {
    const st = this.hover[side];
    if (id !== st.targetId) {
      this.endHover(side, t);
      st.targetId = id;
      st.enterT = t;
      st.hoverStart = t;
    }
    if (!id || !dwellArmed || t < st.cooldownUntil) return 0;
    const progress = (t - st.enterT) / T.dwellMs;
    if (progress >= 1) {
      this.emitHover(side, id, t - st.hoverStart, t); // "on leave or select"
      this.fire({ type: "dwell", side, targetId: id, t, source: "gesture" });
      st.cooldownUntil = t + T.dwellCooldownMs;
      st.enterT = st.cooldownUntil;
      st.hoverStart = st.cooldownUntil;
      return 0;
    }
    return clamp(progress, 0, 1);
  }

  private endHover(side: Side, t: number) {
    const st = this.hover[side];
    if (st.targetId) this.emitHover(side, st.targetId, t - st.hoverStart, t);
    // Mutate in place: stepDwell holds a reference to this object.
    st.targetId = null;
    st.enterT = 0;
    st.hoverStart = 0;
  }

  private endHovers(t: number) {
    this.endHover("left", t);
    this.endHover("right", t);
  }

  private emitHover(side: Side, targetId: string, ms: number, t: number) {
    if (ms >= HOVER_MIN_MS) this.fire({ type: "hover", side, targetId, ms: Math.round(ms), t, source: "gesture" });
  }

  private fire(e: GestureEvent) {
    emit(e);
  }

  private publish(f: MotionFrame) {
    this.latest = f;
    useGame.getState().setCursors(f.cursors);
    this.frameListeners.forEach((fn) => fn(f));
  }
}

function emptyFrame(): MotionFrame {
  return {
    t: 0, videoW: 640, videoH: 480, pts: null, norm: null, sw: 0, shMid: null, box: null,
    cursors: { left: hiddenCursor(), right: hiddenCursor() },
    theta: 45, thetaForearm: 45, thetaFullArm: 45, power: 0, steadyMs: 0, tracking: false, fps: 0,
  };
}

/** One engine for the whole app (also read inside the R3F canvas, so no React context needed). */
export const engine = new GestureEngine();
