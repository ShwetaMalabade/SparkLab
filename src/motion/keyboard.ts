// src/motion/keyboard.ts: keyboard twins for every gesture (docs/plan/04 §7). The demo never blocks on the camera.
// Every event carries source: "keyboard", which becomes the attempt's `input`.
import { emit, useGame } from "@/game/store";
import type { MotionEvent } from "./types";

const ANGLE_STEP = 1; // degrees per press (hold to repeat)
const POWER_STEP = 0.04;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** Maps one KeyboardEvent to a bus event, or null. Exported for tests. */
export function keyToEvent(e: Pick<KeyboardEvent, "key" | "repeat">, t: number): MotionEvent | null {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const src = "keyboard" as const;
  // Held keys repeat only for the continuous controls.
  if (e.repeat && !["ArrowUp", "ArrowDown", "w", "s"].includes(k)) return null;
  switch (k) {
    case "Enter": return { type: "bothUp", t, source: src };
    case "c": return { type: "clap", t, source: src };
    case "ArrowLeft": return { type: "lean", side: "left", t, source: src };
    case "ArrowRight": return { type: "lean", side: "right", t, source: src };
    case " ": return { type: "fire", t, source: src };
    case "ArrowUp": return { type: "command", cmd: "angle", value: ANGLE_STEP, t, source: src };
    case "ArrowDown": return { type: "command", cmd: "angle", value: -ANGLE_STEP, t, source: src };
    case "w": return { type: "command", cmd: "power", value: POWER_STEP, t, source: src };
    case "s": return { type: "command", cmd: "power", value: -POWER_STEP, t, source: src };
    case "1": case "2": case "3": case "4":
      return { type: "command", cmd: "pick", value: Number(k) - 1, t, source: src };
    case "n": return { type: "command", cmd: "skip", t, source: src };
    case "p": return { type: "command", cmd: "pause", t, source: src };
    case "d": return { type: "command", cmd: "debug", t, source: src };
    case "t": return { type: "command", cmd: "trace", t, source: src };
    default: return null;
  }
}

/** Attaches the global key handler. Returns the detach function. */
export function attachKeyboard(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    // Let Enter/Space activate a focused button normally (e.g. Calibrate "Start").
    if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement | null)?.tagName === "BUTTON") return;
    const ev = keyToEvent(e, performance.now());
    if (!ev) return;
    if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault(); // no page scroll
    if (ev.type === "command" && ev.cmd === "debug") useGame.getState().toggleDebug();
    emit(ev);
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
