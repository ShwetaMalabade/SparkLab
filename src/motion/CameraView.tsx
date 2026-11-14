"use client";
// src/motion/CameraView.tsx: draws the mirrored webcam (+ skeleton) on a canvas, once per pose frame.
// Used big on Calibrate and small in the Play HUD. Frames stay in the browser.
import { useEffect, useRef } from "react";
import { useGame } from "@/game/store";
import { engine } from "./gestures";
import { getVideo } from "./MotionProvider";
import { UPPER_BONES } from "./pose";
import type { MotionFrame } from "./types";

export function CameraView({ skeleton = true, className = "" }: { skeleton?: boolean; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useGame((s) => s.cam);

  useEffect(() => {
    return engine.onFrame((f) => {
      const canvas = canvasRef.current;
      const video = getVideo();
      if (canvas && video) drawCamera(canvas, video, skeleton ? f : null);
    });
  }, [skeleton]);

  return (
    <div className={`relative overflow-hidden bg-panel ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full object-cover" />
      {cam !== "ready" && (
        <div className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">
          {cam === "loading" ? "Starting camera…" : cam === "no-camera" ? "No camera · keyboard works" : cam === "error" ? "Pose failed · keyboard works" : ""}
        </div>
      )}
    </div>
  );
}

export function drawCamera(canvas: HTMLCanvasElement, video: HTMLVideoElement, f: MotionFrame | null) {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  // Mirror for display only (MediaPipe reads the un-mirrored stream).
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  const pts = f?.pts;
  if (pts) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#22d3ee";
    for (const [a, b] of UPPER_BONES) {
      if (pts[a].visibility < 0.5 || pts[b].visibility < 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    for (const i of [0, 11, 12, 13, 14, 15, 16]) {
      const p = pts[i];
      ctx.fillStyle = p.visibility > 0.6 ? "#a3e635" : "#fb7185";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
