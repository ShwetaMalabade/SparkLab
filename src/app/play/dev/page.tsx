"use client";
// /play/dev: scratch page for the motion system (P1-01). Camera + Pose + landmarks, all on-device.
import { useEffect, useRef, useState } from "react";
import { createPose, startCamera, startLoop, UPPER_BONES, type RawLandmark } from "@/motion/pose";

type Status = "loading" | "ready" | "no-camera" | "error";

export default function MotionDevPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [info, setInfo] = useState({ fps: 0, delegate: "", points: 0 });

  useEffect(() => {
    let stopCam: (() => void) | null = null;
    let stopLoop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const video = videoRef.current!;
      try {
        stopCam = await startCamera(video);
      } catch {
        if (!cancelled) setStatus("no-camera");
        return;
      }
      try {
        const { landmarker, delegate } = await createPose();
        if (cancelled) return landmarker.close();
        setStatus("ready");
        let frames = 0;
        let since = performance.now();
        stopLoop = startLoop(video, landmarker, (pts, t) => {
          draw(canvasRef.current, video, pts);
          frames++;
          if (t - since >= 1000) {
            setInfo({ fps: Math.round((frames * 1000) / (t - since)), delegate, points: pts?.length ?? 0 });
            frames = 0;
            since = t;
          }
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      stopLoop?.();
      stopCam?.();
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold">Motion dev</h1>
      <p className="text-muted">
        {status === "loading" && "Starting camera + pose…"}
        {status === "no-camera" && "No camera (permission denied or none found). The game still works by keyboard."}
        {status === "error" && "Pose model failed to load."}
        {status === "ready" && `${info.fps} fps · ${info.delegate} · ${info.points} points`}
      </p>
      <div className="relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-line">
        {/* Mirrored for display only; MediaPipe reads the un-mirrored stream. */}
        <video ref={videoRef} className="block w-full -scale-x-100" muted playsInline />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100" />
      </div>
    </main>
  );
}

function draw(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, pts: RawLandmark[] | null) {
  if (!canvas) return;
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  if (!pts) return;
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 3;
  for (const [a, b] of UPPER_BONES) {
    ctx.beginPath();
    ctx.moveTo(pts[a].x * w, pts[a].y * h);
    ctx.lineTo(pts[b].x * w, pts[b].y * h);
    ctx.stroke();
  }
  for (const p of pts) {
    ctx.fillStyle = p.visibility > 0.6 ? "#a3e635" : "#fb7185";
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
