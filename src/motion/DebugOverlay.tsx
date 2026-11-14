"use client";
// src/motion/DebugOverlay.tsx: toggled by D (docs/plan/04 §8). Landmarks + bones, reach box, sw / swFrac,
// θ (forearm and full arm side by side), power p, steady timer, fps, last 5 events with timestamps.
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { engine } from "./gestures";
import { UPPER_BONES } from "./pose";
import type { MotionFrame } from "./types";

type Stats = Pick<MotionFrame, "sw" | "theta" | "thetaForearm" | "thetaFullArm" | "power" | "steadyMs" | "fps" | "tracking"> & {
  swFrac: number;
};

export function DebugOverlay() {
  const debug = useGame((s) => s.debug);
  return debug ? <DebugPanel /> : null;
}

function DebugPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const events = useGame((s) => s.events);
  const armed = useGame((s) => s.armed);
  const cam = useGame((s) => s.cam);
  const delegate = useGame((s) => s.poseDelegate);

  useEffect(() => {
    let lastStats = 0;
    return engine.onFrame((f) => {
      drawDebug(canvasRef.current, f);
      if (f.t - lastStats > 100) {
        lastStats = f.t;
        setStats({
          sw: f.sw, swFrac: f.sw / (f.videoW || 640), theta: f.theta, thetaForearm: f.thetaForearm,
          thetaFullArm: f.thetaFullArm, power: f.power, steadyMs: f.steadyMs, fps: f.fps, tracking: f.tracking,
        });
      }
    });
  }, []);

  return (
    <div className="pointer-events-none fixed right-3 top-14 z-50 w-[340px] rounded-xl border border-line bg-navy/90 p-3 font-mono text-xs text-text shadow-2xl backdrop-blur">
      <div className="mb-2 flex justify-between text-muted">
        <span>DEBUG (D)</span>
        <span>cam {cam}{delegate ? ` · ${delegate}` : ""}</span>
      </div>
      <canvas ref={canvasRef} width={320} height={240} className="mb-2 w-full rounded-md bg-panel" />
      {stats ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span>fps {stats.fps}</span>
          <span className={stats.tracking ? "text-lime" : "text-coral"}>{stats.tracking ? "✓ tracking" : "✗ lost"}</span>
          <span>sw {stats.sw.toFixed(0)} px</span>
          <span>swFrac {stats.swFrac.toFixed(3)}</span>
          <span>θ fore {stats.thetaForearm.toFixed(1)}°</span>
          <span>θ full {stats.thetaFullArm.toFixed(1)}°</span>
          <span>θ used {stats.theta.toFixed(1)}°</span>
          <span>p {stats.power.toFixed(2)} → {(5 + stats.power * 25).toFixed(1)} m/s</span>
          <span>steady {(stats.steadyMs / 1000).toFixed(1)} s</span>
          <span className="text-muted">
            armed: {Object.entries(armed).filter(([, v]) => v).map(([k]) => k).join(" ")}
          </span>
        </div>
      ) : (
        <div className="text-muted">No pose frames yet (keyboard still emits events).</div>
      )}
      <div className="mt-2 border-t border-line pt-2">
        {events.slice(-5).reverse().map((e, i) => (
          <div key={`${e.t}-${i}`} className="truncate">
            <span className="text-muted">t={(e.t / 1000).toFixed(2)}s</span>{" "}
            <span className="text-cyan">{e.type === "command" ? `cmd:${e.cmd}` : e.type}</span>
            {"side" in e && e.side ? ` ${e.side}` : ""}
            {"targetId" in e && e.targetId ? ` → ${e.targetId}` : ""}
            {"ms" in e && e.ms ? ` ${e.ms}ms` : ""}
            {e.type === "command" && e.value !== undefined ? ` ${e.value}` : ""}
            <span className="text-muted"> [{e.source}]</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function drawDebug(canvas: HTMLCanvasElement | null, f: MotionFrame) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!f.pts) return;
  const sx = W / (f.videoW || 640), sy = H / (f.videoH || 480);
  // Mirror so it matches what the person sees.
  const X = (x: number) => W - x * sx;
  const Y = (y: number) => y * sy;
  if (f.box) {
    ctx.strokeStyle = "#a78bfa";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(X(f.box.right), Y(f.box.top), (f.box.right - f.box.left) * sx, (f.box.bottom - f.box.top) * sy);
    ctx.setLineDash([]);
    // bothUp line
    const nose = f.pts[0];
    ctx.strokeStyle = "#fbbf2466";
    ctx.beginPath();
    ctx.moveTo(0, Y(nose.y - 0.2 * f.sw));
    ctx.lineTo(W, Y(nose.y - 0.2 * f.sw));
    ctx.stroke();
  }
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2;
  for (const [a, b] of UPPER_BONES) {
    ctx.beginPath();
    ctx.moveTo(X(f.pts[a].x), Y(f.pts[a].y));
    ctx.lineTo(X(f.pts[b].x), Y(f.pts[b].y));
    ctx.stroke();
  }
  f.pts.forEach((p, i) => {
    if (i > 24) return;
    ctx.fillStyle = p.visibility > 0.6 ? "#a3e635" : "#fb7185";
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), i >= 11 && i <= 16 ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fill();
  });
}
