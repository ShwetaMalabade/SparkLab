// src/game/store.ts: Zustand store. Motion slice (P1-03): cursors, the event bus, gesture arming.
import { create } from "zustand";
import type { NextStep } from "@/lib/client/api";
import type { TQuestion } from "@/lib/schema";
import type { CommandEvent, Cursor, GestureEvent, GestureType, HandState, InputSource, MotionEvent, MotionEventType, Side } from "@/motion/types";

const hiddenCursor: Cursor = { x: 0, y: 0, visible: false, targetId: null, dwell: 0 };

/** Default arming (04 §6 conflict rules): clap waits for Mix Lab, fire waits for the Launcher. */
const DEFAULT_ARMED: Record<GestureType, boolean> = {
  hover: true, dwell: true, bothUp: true, lean: true, lost: true, found: true,
  clap: false, fire: false, grab: true, release: true,
};
const noHand: HandState = { shape: "other", tilt: 0, seen: -1e9 };

type Listener = (e: MotionEvent) => void;
const listeners = new Map<MotionEventType | "*", Set<Listener>>();

export type CamStatus = "off" | "loading" | "ready" | "no-camera" | "error";

export type MotionSlice = {
  cam: CamStatus;
  poseDelegate: "GPU" | "CPU" | null;
  setCam: (cam: CamStatus, poseDelegate?: "GPU" | "CPU" | null) => void;
  cursors: { left: Cursor; right: Cursor };
  /** Last 20 events, newest last (debug overlay + AI trace). */
  events: MotionEvent[];
  armed: Record<GestureType, boolean>;
  debug: boolean;
  setCursors: (c: { left: Cursor; right: Cursor }) => void;
  /** Finger tracker: per-hand shape (open / point / fist) + tilt. `seen` = last detection time (performance.now). */
  hands: Record<Side, HandState>;
  setHands: (h: Record<Side, HandState>) => void;
  emit: (e: MotionEvent) => void;
  arm: (type: GestureType, on?: boolean) => void;
  resetArming: () => void;
  toggleDebug: () => void;
};

// ---------- Game slice (P1-09, docs/plan/05 §1) ----------
/** "walk" = walking through the lab building to the room of the next question (lab world on). */
export type Phase = "walk" | "intro" | "play" | "lockin" | "reveal" | "next" | "end";

export type GameSession = { sessionId: string; classCode: string; worksheetId: string; timeBudgetSec: number; nickname: string };

/** What the template reports at LOCK-IN; GameRunner adds the session fields to build the AttemptInput. */
export type LockResult = {
  chosen: "A" | "B" | "C" | "D" | "X";
  chosenText: string;
  correct: boolean;
  misconceptionId: string | null;
  input: InputSource;
  hoverTrace: { choice: "A" | "B" | "C" | "D"; ms: number }[];
  experiments?: { thetaDeg: number; speed: number; landedM: number }[];
  mixTries?: [string, string][];
  balancerSteps?: number[][];
};

/** One coach/fallback decision, with the answer that led to it (null = first question or a skip). */
export type TraceEntry = {
  ns: NextStep;
  after: { questionId: string; origin: TQuestion["origin"]; chosenText: string; correct: boolean; misconceptionId: string | null } | null;
  skipped: string | null;
  /** The question actually shown next (null = finish). */
  served?: { id: string; origin: TQuestion["origin"] } | null;
  /** The pick was already played, so code served the next unplayed worksheet question instead. */
  replaced?: string;
};

export type GameSlice = {
  session: GameSession | null;
  question: TQuestion | null;
  phase: Phase;
  /** Pause = tracking lost or P (freeze timers, dim the scene). Not a phase, so play resumes where it was. */
  paused: boolean;
  pauseReason: "lost" | "manual" | null;
  score: number;
  streak: number;
  correctCount: number;
  answeredCount: number;
  played: string[];
  lastNext: NextStep | null;
  /** Every NextStep this session, for the AI trace drawer (P1-17). */
  trace: TraceEntry[];
  lastResult: (LockResult & { points: number }) | null;
  caption: string;
  coachLine: string | null;
  /** Template-specific hint (e.g. the Launcher's experiment line); null → the template's default. */
  templateHint: string | null;
  /**
   * A template sub-phase can claim the N key first (e.g. "skip the test shots, go to the answers").
   * Returns true when it handled the skip; otherwise GameRunner skips the whole question.
   */
  skipHandler: (() => boolean) | null;
  setGame: (p: Partial<GameSlice>) => void;
  resetGame: () => void;
};

const GAME_INITIAL = {
  session: null, question: null, phase: "intro" as Phase, paused: false, pauseReason: null,
  score: 0, streak: 0, correctCount: 0, answeredCount: 0, played: [], lastNext: null, trace: [],
  lastResult: null, caption: "", coachLine: null, templateHint: null, skipHandler: null,
} satisfies Omit<GameSlice, "setGame" | "resetGame">;

export const useGame = create<MotionSlice & GameSlice>()((set, get) => ({
  ...GAME_INITIAL,
  setGame: (p) => set(p),
  resetGame: () => set({ ...GAME_INITIAL }),

  cam: "off",
  poseDelegate: null,
  setCam: (cam, poseDelegate) => set((s) => ({ cam, poseDelegate: poseDelegate === undefined ? s.poseDelegate : poseDelegate })),
  cursors: { left: hiddenCursor, right: hiddenCursor },
  events: [],
  armed: { ...DEFAULT_ARMED },
  debug: false,

  setCursors: (cursors) => set({ cursors }),
  hands: { left: noHand, right: noHand },
  setHands: (hands) => set({ hands }),

  emit: (e) => {
    // Disarmed gestures are dropped for every input source, so keyboard C can't mix with one beaker either.
    if (e.type !== "command" && !get().armed[e.type]) return;
    set((s) => ({ events: [...s.events.slice(-19), e] }));
    listeners.get(e.type)?.forEach((fn) => fn(e));
    listeners.get("*")?.forEach((fn) => fn(e));
  },

  arm: (type, on = true) => set((s) => ({ armed: { ...s.armed, [type]: on } })),
  resetArming: () => set({ armed: { ...DEFAULT_ARMED } }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
}));

/** Subscribe to one event type (or "*"). Returns the unsubscribe function. */
export function subscribe<T extends MotionEventType | "*">(
  type: T,
  fn: (e: T extends "*" ? MotionEvent : T extends "command" ? CommandEvent : GestureEvent) => void,
): () => void {
  const set = listeners.get(type) ?? new Set<Listener>();
  listeners.set(type, set);
  const l = fn as Listener;
  set.add(l);
  return () => {
    set.delete(l);
  };
}

export const emit = (e: MotionEvent) => useGame.getState().emit(e);
