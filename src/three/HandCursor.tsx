"use client";
// src/three/HandCursor.tsx: 2D overlay hand cursors with the dwell ring (docs/plan/04 §6, 05 §5).
// Updated outside React renders (transient subscription) so 30 fps cursor motion doesn't re-render the tree.
import { useEffect, useRef } from "react";
import { useGame } from "@/game/store";
import type { Cursor, HandState, Side } from "@/motion/types";

const R = 22; // ring radius, px
const CIRC = 2 * Math.PI * R;

export function HandCursors({ accent = "#22d3ee" }: { accent?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <HandCursor side="left" accent={accent} />
      <HandCursor side="right" accent={accent} />
    </div>
  );
}

function HandCursor({ side, accent }: { side: Side; accent: string }) {
  const el = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const icon = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const apply = (c: Cursor, h: HandState) => {
      const node = el.current;
      if (!node) return;
      node.style.opacity = c.visible ? "1" : "0";
      node.style.transform = `translate(${c.x - R - 4}px, ${c.y - R - 4}px)`;
      if (ring.current) ring.current.style.strokeDashoffset = String(CIRC * (1 - c.dwell));
      // Finger tracker: show the hand shape (✋ open = safe, ☝️ point = hold to choose, ✊ fist = grab / select).
      const live = performance.now() - h.seen < 400;
      const shape = live ? h.shape : "other";
      if (icon.current) icon.current.textContent = shape === "fist" ? "✊" : shape === "point" ? "☝️" : shape === "open" ? "✋" : "";
      if (dot.current) dot.current.setAttribute("r", shape === "fist" ? "13" : "8");
    };
    const st = useGame.getState();
    apply(st.cursors[side], st.hands[side]);
    return useGame.subscribe((s) => apply(s.cursors[side], s.hands[side]));
  }, [side]);

  return (
    <div ref={el} className="absolute left-0 top-0 opacity-0 transition-opacity duration-150" style={{ willChange: "transform" }}>
      <svg width={2 * R + 8} height={2 * R + 8} aria-hidden>
        <circle cx={R + 4} cy={R + 4} r={R} fill="none" stroke="#ffffff22" strokeWidth={5} />
        <circle
          ref={ring}
          cx={R + 4}
          cy={R + 4}
          r={R}
          fill="none"
          stroke={accent}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
          transform={`rotate(-90 ${R + 4} ${R + 4})`}
        />
        <circle ref={dot} cx={R + 4} cy={R + 4} r={8} fill={accent} opacity={0.9} />
        <text x={R + 4} y={R + 8} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0b1020">
          {side === "left" ? "L" : "R"}
        </text>
      </svg>
      <span ref={icon} className="absolute -right-5 -top-3 text-2xl drop-shadow" aria-hidden />
    </div>
  );
}
