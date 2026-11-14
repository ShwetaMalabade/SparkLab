"use client";
// src/motion/MotionProvider.tsx: owns the webcam, the pose loop, the gesture engine and the keyboard twins.
// If the camera or the model fails, the keyboard still drives everything (RULES §6).
import { useEffect, useRef, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { engine } from "./gestures";
import { getHands, handTracker } from "./hands";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { attachKeyboard } from "./keyboard";
import { attachCamera, getPose, openCamera, startLoop } from "./pose";

let sharedVideo: HTMLVideoElement | null = null;
/** The live (un-mirrored) camera element, for views that draw it. */
export const getVideo = () => sharedVideo;

export function MotionProvider({ children, camera = true }: { children: ReactNode; camera?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => attachKeyboard(), []);

  useEffect(() => {
    if (!camera) return;
    const video = videoRef.current!;
    sharedVideo = video;
    const setCam = useGame.getState().setCam;
    let stopCam: (() => void) | null = null;
    let stopLoop: (() => void) | null = null;
    let cancelled = false;
    setCam("loading");
    (async () => {
      try {
        const stream = await openCamera();
        // React dev mode mounts twice: a cancelled mount must not touch the shared <video>.
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop());
        stopCam = await attachCamera(video, stream);
        if (cancelled) return stopCam();
      } catch {
        if (!cancelled) setCam("no-camera");
        return;
      }
      try {
        const { landmarker, delegate } = await getPose(); // shared; never closed per mount
        if (cancelled) return;
        setCam("ready", delegate);
        engine.reset();
        // Finger tracker (open / point / fist) loads in the background; until then the plain dwell rules run.
        let hands: HandLandmarker | null = null;
        useGame.getState().setHandsStatus("loading");
        getHands()
          .then((h) => {
            if (cancelled) return;
            hands = h;
            useGame.getState().setHandsStatus("ready");
          })
          .catch(() => !cancelled && useGame.getState().setHandsStatus("failed"));
        stopLoop = startLoop(video, landmarker, (pts, t) => {
          const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
          engine.process(pts, t, vw, vh, window.innerWidth, window.innerHeight);
          if (!hands) return;
          try {
            const res = hands.detectForVideo(video, t + 0.001);
            const wrist = (i: number) => (pts && pts[i] && pts[i].visibility > 0.5 ? { x: pts[i].x, y: pts[i].y } : null);
            handTracker.update((res.landmarks ?? []) as { x: number; y: number; z: number }[][], { left: wrist(15), right: wrist(16) }, t);
          } catch {
            /* a bad frame never kills the loop */
          }
        });
      } catch {
        if (!cancelled) setCam("error");
      }
    })();
    return () => {
      cancelled = true;
      stopLoop?.();
      stopCam?.();
      if (sharedVideo === video) sharedVideo = null;
      setCam("off", null);
    };
  }, [camera]);

  return (
    <>
      {/* Kept in the DOM (a detached <video> pauses). Views draw it to their own canvas. */}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
      />
      {children}
    </>
  );
}
