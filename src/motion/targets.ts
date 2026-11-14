// src/motion/targets.ts: dwell/hover targets (docs/plan/04 §6). Rects are viewport pixels.
// Mouse twin (04 §7): a click on a target = dwell, mouse hover also records hover time.
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { emit } from "@/game/store";

export type Rect = { x: number; y: number; w: number; h: number };
type RectFn = () => Rect | null;

type Entry = { rect: RectFn; enabled: () => boolean };
const targets = new Map<string, Entry>();

/** Registers a target. A disabled target keeps its rect (3D objects still follow it) but is never hit. */
export function registerTarget(id: string, rect: RectFn, enabled: () => boolean = () => true): () => void {
  const entry = { rect, enabled };
  targets.set(id, entry);
  return () => {
    if (targets.get(id) === entry) targets.delete(id);
  };
}

/** Current viewport rect of a registered target (used to place 3D objects behind DOM targets). */
export function getTargetRect(id: string): Rect | null {
  return targets.get(id)?.rect() ?? null;
}

/** Every registered target's current rect (the clip recorder saves them so replays hit the same targets). */
export function allTargetRects(): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const [id, t] of targets) {
    const r = t.rect();
    if (r) out[id] = r;
  }
  return out;
}

/** The enabled target under a viewport point, or null. Later registrations win on overlap. */
export function hitTest(x: number, y: number): string | null {
  let hit: string | null = null;
  for (const [id, t] of targets) {
    if (!t.enabled()) continue;
    const r = t.rect();
    if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) hit = id;
  }
  return hit;
}

export const HOVER_MIN_MS = 150;

/**
 * Registers a DOM element as a target and returns the mouse-twin handlers.
 * Usage: `const ref = useRef<HTMLDivElement>(null); const mouse = useTarget("choice:A", ref); <div ref={ref} {...mouse} />`
 */
export function useTarget(id: string, el: RefObject<HTMLElement | null>, enabled = true) {
  const enterT = useRef<number | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(
    () =>
      registerTarget(
        id,
        () => {
          const node = el.current;
          if (!node) return null;
          const r = node.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        },
        () => enabledRef.current,
      ),
    [id, el],
  );

  const endHover = useCallback(() => {
    const start = enterT.current;
    enterT.current = null;
    if (start === null) return;
    const ms = performance.now() - start;
    if (ms >= HOVER_MIN_MS) emit({ type: "hover", targetId: id, ms: Math.round(ms), t: performance.now(), source: "mouse" });
  }, [id]);

  const onMouseEnter = useCallback(() => {
    if (enabled) enterT.current = performance.now();
  }, [enabled]);

  const onClick = useCallback(() => {
    if (!enabled) return;
    endHover();
    emit({ type: "dwell", targetId: id, t: performance.now(), source: "mouse" });
  }, [enabled, endHover, id]);

  return { onMouseEnter, onMouseLeave: endHover, onClick };
}
