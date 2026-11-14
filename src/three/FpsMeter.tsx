"use client";
// src/three/FpsMeter.tsx: render-loop fps, reported once a second through a callback. Dev + perf checks (05 §8).
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

export function FpsProbe({ onFps }: { onFps: (fps: number) => void }) {
  const acc = useRef({ frames: 0, since: 0 });
  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    acc.current.frames++;
    if (now - acc.current.since >= 1) {
      onFps(Math.round(acc.current.frames / (now - acc.current.since)));
      acc.current = { frames: 0, since: now };
    }
  });
  return null;
}
