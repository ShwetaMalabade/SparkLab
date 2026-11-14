"use client";
// src/three/WorldLabels.tsx: DOM labels pinned to 3D points, without drei <Html>.
// drei's Html mounts a separate React root per label; unmounting those during a render (React 19) throws
// "removeChild … not a child" and corrupts the page between questions. Here the 3D side only projects
// points; one ordinary DOM layer (outside the Canvas) draws the labels and follows them every animation frame.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { create } from "zustand";
import { Group, Vector3 } from "three";

export type LabelVariant = "tick" | "small" | "dim" | "big";
export type LabelSpec = { text: string; color?: string; variant?: LabelVariant };

const useLabelStore = create<{ items: Record<string, LabelSpec> }>(() => ({ items: {} }));
/** Latest screen position (viewport px) of every anchor. */
const screen = new Map<string, { x: number; y: number; on: boolean }>();

/** Inside the Canvas: projects this point every frame; `label` (optional) is drawn by <WorldLabelsLayer/>. */
export function WorldAnchor({ id, position = [0, 0, 0], label }: { id: string; position?: [number, number, number]; label?: LabelSpec }) {
  const group = useRef<Group>(null);
  const { camera, size } = useThree();
  const v = useRef(new Vector3());
  const text = label?.text;
  const color = label?.color;
  const variant = label?.variant;

  useEffect(() => {
    if (text === undefined) return;
    useLabelStore.setState((s) => ({ items: { ...s.items, [id]: { text, color, variant } } }));
    return () => {
      useLabelStore.setState((s) => {
        const items = { ...s.items };
        delete items[id];
        return { items };
      });
    };
  }, [id, text, color, variant]);

  useEffect(() => () => void screen.delete(id), [id]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(v.current);
    v.current.project(camera);
    const on = v.current.z < 1 && Math.abs(v.current.x) <= 1.2 && Math.abs(v.current.y) <= 1.2;
    screen.set(id, { x: ((v.current.x + 1) / 2) * size.width, y: ((1 - v.current.y) / 2) * size.height, on });
  });

  return <group ref={group} position={position} />;
}

/** Makes a DOM element follow an anchor (centred on it). */
export function useFollowAnchor(id: string, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      const p = screen.get(id);
      if (el) {
        el.style.opacity = p?.on ? "1" : "0";
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, ref]);
}

/** A DOM element pinned to an anchor (e.g. the Launcher's hold-to-fire ring). */
export function Pinned({ id, children, className = "" }: { id: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFollowAnchor(id, ref);
  return (
    <div ref={ref} className={`pointer-events-none absolute left-0 top-0 opacity-0 ${className}`} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}

const VARIANT: Record<LabelVariant, string> = {
  tick: "text-sm font-semibold text-muted",
  small: "rounded-full bg-navy/85 px-3 py-1 text-base font-semibold",
  dim: "rounded-full bg-navy/70 px-2 py-0.5 text-sm font-semibold opacity-70",
  big: "rounded-full bg-navy/90 px-3 py-1 text-2xl font-semibold",
};

/** Outside the Canvas: draws every registered label at its anchor. */
export function WorldLabelsLayer() {
  const items = useLabelStore((s) => s.items);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Object.entries(items).map(([id, spec]) => (
        <Pinned key={id} id={id}>
          <span
            className={`block select-none whitespace-nowrap ${VARIANT[spec.variant ?? "small"]}`}
            style={spec.color ? { color: spec.color, border: spec.variant === "tick" ? undefined : `1px solid ${spec.color}66` } : undefined}
          >
            {spec.text}
          </span>
        </Pinned>
      ))}
    </div>
  );
}
