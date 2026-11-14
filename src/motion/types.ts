// src/motion/types.ts: the motion event bus (CONTRACTS §5, docs/plan/04 §6). Shweta-internal.
// Templates subscribe to these events; they never read landmarks (except the Avatar and the Launcher's θ / power).

export type GestureType = "hover" | "dwell" | "bothUp" | "clap" | "lean" | "fire" | "lost" | "found";
export type InputSource = "gesture" | "keyboard" | "mouse";
export type Side = "left" | "right";

/**
 * One gesture event.
 * - `side`: which hand for hover/dwell (the person's own hand), or the SCREEN direction for lean.
 * - `targetId`: the registered target for hover/dwell.
 * - `ms`: hover duration.
 * - `source`: becomes the attempt's `input` (04 §7: the report is honest about keyboard use).
 */
export type GestureEvent = {
  type: GestureType;
  side?: Side;
  targetId?: string;
  ms?: number;
  t: number;
  source: InputSource;
};

/** Keyboard-only controls that are not gestures (04 §7). Same bus, so one subscription covers both. */
export type CommandName = "pick" | "skip" | "pause" | "debug" | "trace" | "angle" | "power";
export type CommandEvent = { type: "command"; cmd: CommandName; value?: number; t: number; source: InputSource };

export type MotionEvent = GestureEvent | CommandEvent;
export type MotionEventType = MotionEvent["type"];

/** A landmark in VIDEO PIXELS (04 §4), smoothed, with MediaPipe's visibility. */
export type Px = { x: number; y: number; visibility: number };

export type Cursor = {
  /** Screen pixels (already mirrored). */
  x: number;
  y: number;
  visible: boolean;
  /** Target under the cursor, if any. */
  targetId: string | null;
  /** Dwell ring progress 0..1. */
  dwell: number;
};

export type Baseline = { sw: number; shMidX: number; shMidY: number; noseY: number };

/** Per-frame snapshot of everything the debug overlay, calibration, avatar and launcher read. */
export type MotionFrame = {
  t: number;
  videoW: number;
  videoH: number;
  /** 33 smoothed landmarks in video pixels, or null when no person is detected. */
  pts: Px[] | null;
  /** Raw normalized landmarks (0..1) for the avatar. */
  norm: Px[] | null;
  sw: number;
  shMid: { x: number; y: number } | null;
  box: { left: number; right: number; top: number; bottom: number } | null;
  cursors: { left: Cursor; right: Cursor };
  /** Aim angle in degrees (forearm and full arm), already clamped 5..85 and smoothed. */
  theta: number;
  thetaForearm: number;
  thetaFullArm: number;
  /** Power 0..1 from the power hand. */
  power: number;
  /** How long θ and p have been steady (ms), for the hold-to-fire ring. */
  steadyMs: number;
  tracking: boolean;
  fps: number;
};

export type AimMode = "forearm" | "fullArm";
