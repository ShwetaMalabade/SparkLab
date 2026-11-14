"use client";
// /play/dev/arena: Arena + Avatar + hand cursors with pose running (P1-07, P1-08). Goal: ≥ 30 fps (3D).
import { useRef, useState } from "react";
import { useGame } from "@/game/store";
import { CameraView } from "@/motion/CameraView";
import { DebugOverlay } from "@/motion/DebugOverlay";
import { MotionProvider } from "@/motion/MotionProvider";
import { Arena } from "@/three/Arena";
import { Avatar } from "@/three/Avatar";
import { FpsProbe } from "@/three/FpsMeter";
import { HandCursors } from "@/three/HandCursor";

export default function ArenaDevPage() {
  const fpsRef = useRef<HTMLSpanElement>(null);
  const [chem, setChem] = useState(false);
  const cam = useGame((s) => s.cam);
  const color = chem ? "#E879F9" : "#22D3EE";
  return (
    <MotionProvider>
      <div className="fixed inset-0">
        <Arena accent={color}>
          <Avatar color={color} position={[0, 0, -1.5]} />
          <FpsProbe onFps={(fps) => { if (fpsRef.current) fpsRef.current.textContent = `${fps} fps (3D)`; }} />
        </Arena>
      </div>
      <div className="fixed left-3 top-12 z-30 flex flex-col gap-2 rounded-xl bg-navy/80 p-3 text-sm">
        <span ref={fpsRef} className="font-mono text-lime">… fps</span>
        <span className="text-muted">cam: {cam} · D = debug</span>
        <button className="rounded border border-line px-2 py-1" onClick={() => setChem((c) => !c)}>
          {chem ? "Chemistry (magenta)" : "Physics (cyan)"}
        </button>
      </div>
      <div className="fixed bottom-4 right-4 z-30">
        <CameraView className="h-[150px] w-[200px] rounded-xl border border-line" />
      </div>
      <HandCursors accent={color} />
      <DebugOverlay />
    </MotionProvider>
  );
}
