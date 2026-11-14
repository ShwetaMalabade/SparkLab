"use client";
// src/three/effects/Trail.tsx: glowing dotted trail along a precomputed arc (Launcher flights, 05 §2).
// `progress()` (0..1) says how much of the arc is drawn; `dashed` draws pairs of dots with gaps (ghost trail).
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import { InstancedMesh, Object3D } from "three";

export type TrailProps = {
  points: [number, number, number][];
  progress: () => number;
  color: string;
  size?: number;
  dashed?: boolean;
  opacity?: number;
};

const dummy = new Object3D();

export function Trail({ points, progress, color, size = 0.05, dashed = false, opacity = 1 }: TrailProps) {
  const mesh = useRef<InstancedMesh>(null);
  const shown = points.filter((_, i) => !dashed || i % 4 < 2);
  const idx = points.map((_, i) => i).filter((i) => !dashed || i % 4 < 2);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    shown.forEach((p, i) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.count = 0;
  }, [shown]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const upto = Math.floor(Math.min(1, Math.max(0, progress())) * (points.length - 1));
    let n = 0;
    while (n < idx.length && idx[n] <= upto) n++;
    m.count = n;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, shown.length)]} frustumCulled={false}>
      <sphereGeometry args={[size, 10, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
    </instancedMesh>
  );
}
