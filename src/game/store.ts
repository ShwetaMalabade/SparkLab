// src/game/store.ts: Zustand store. Motion slice (P1-03): cursors, the event bus, gesture arming.
import { create } from "zustand";
import type { Cursor, GestureType, MotionEvent, MotionEventType } from "@/motion/types";

const hiddenCursor: Cursor = { x: 0, y: 0, visible: false, targetId: null, dwell: 0 };

/** Default arming (04 §6 conflict rules): clap waits for Mix Lab, fire waits for the Launcher. */
const DEFAULT_ARMED: Record<GestureType, boolean> = {
  hover: true, dwell: true, bothUp: true, lean: true, lost: true, found: true,
  clap: false, fire: false,
};

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
  emit: (e: MotionEvent) => void;
  arm: (type: GestureType, on?: boolean) => void;
  resetArming: () => void;
  toggleDebug: () => void;
};

export const useGame = create<MotionSlice>()((set, get) => ({
  cam: "off",
  poseDelegate: null,
  setCam: (cam, poseDelegate) => set((s) => ({ cam, poseDelegate: poseDelegate === undefined ? s.poseDelegate : poseDelegate })),
  cursors: { left: hiddenCursor, right: hiddenCursor },
  events: [],
  armed: { ...DEFAULT_ARMED },
  debug: false,

  setCursors: (cursors) => set({ cursors }),

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
  fn: (e: T extends "*" ? MotionEvent : Extract<MotionEvent, { type: T }>) => void,
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
