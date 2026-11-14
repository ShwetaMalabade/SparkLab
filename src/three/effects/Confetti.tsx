"use client";
// src/three/effects/Confetti.tsx: the correct-answer celebration (multicolor Burst). Re-mount (new key) to fire again.
import { Burst } from "./Burst";

const COLORS = ["#A3E635", "#22D3EE", "#E879F9", "#FBBF24", "#ffffff"];

export function Confetti({ position, count = 160 }: { position: [number, number, number]; count?: number }) {
  return <Burst position={position} colors={COLORS} count={count} speed={4} />;
}
