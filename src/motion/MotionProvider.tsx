"use client";
// src/motion/MotionProvider.tsx: owns the webcam, the pose loop, the gesture engine and the keyboard twins.
// If the camera or the model fails, the keyboard still drives everything (RULES §6).
import { useEffect, useRef, type ReactNode } from "react";
import { useGame } from "@/game/store";
import { engine } from "./gestures";
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
        stopLoop = startLoop(video, landmarker, (pts, t) =>
          engine.process(pts, t, video.videoWidth || 640, video.videoHeight || 480, window.innerWidth, window.innerHeight),
        );
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
