"use client";
// src/three/effects/Burst.tsx: one-shot instanced particle burst (confetti on correct, coral pop on wrong).
// ≤ 300 instances (05 §8 budget). Re-mount (change `key`) to fire again.
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/game/settings";
import { Color, InstancedMesh, Object3D, Vector3 } from "three";
import { rng } from "./rng";

export type BurstProps = {
  position: [number, number, number];
  colors: string[];
  count?: number;
  speed?: number;
  life?: number; // seconds
  size?: number;
};

export function Burst({ position, colors, count = 90, speed: fullSpeed = 3.2, life = 1.8, size = 0.06, seed = 7 }: BurstProps & { seed?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  // Reduced motion: a small, gentle burst instead of a big one (read once per mount).
  const [reduced] = useState(() => useSettings.getState().reducedMotion);
  const n = Math.min(300, reduced ? Math.ceil(count / 4) : count);
  const speed = reduced ? fullSpeed * 0.4 : fullSpeed;
  const parts = useMemo(
    () => {
      const rand = rng(seed + Math.round(position[0] * 1000));
      return Array.from({ length: n }, (_, i) => {
        const dir = new Vector3(rand() - 0.5, rand() * 0.9 + 0.2, rand() - 0.5).normalize();
        return {
          p: new Vector3(...position),
          v: dir.multiplyScalar(speed * (0.5 + rand() * 0.7)),
          spin: rand() * 6,
          color: new Color(colors[i % colors.length]),
        };
      });
    },
    // A new burst is a new mount; the inputs are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const age = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    parts.forEach((pt, i) => m.setColorAt(i, pt.color));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [parts]);

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 1 / 20); // a frame hitch must not skip the whole burst
    age.current += dt;
    const k = Math.max(0, 1 - age.current / life);
    parts.forEach((pt, i) => {
      pt.v.y -= 6 * dt; // gravity
      pt.v.multiplyScalar(1 - 0.8 * dt); // drag
      pt.p.addScaledVector(pt.v, dt);
      dummy.position.copy(pt.p);
      dummy.rotation.set(pt.spin * age.current, pt.spin * age.current * 0.7, 0);
      dummy.scale.setScalar(k);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.visible = k > 0;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, n]} frustumCulled={false}>
      <boxGeometry args={[size, size, size * 0.3]} />
      {/* Unlit + instance colors; bright enough to catch the bloom pass. */}
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
