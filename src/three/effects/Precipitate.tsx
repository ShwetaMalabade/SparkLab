"use client";
// src/three/effects/Precipitate.tsx: solid particles in reaction.visual.precipitateColor that fall and settle
// at the bottom of the flask (05 §3). ≤ 150 instanced. `at()` is read every frame (see Bubbles).
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import type { Place } from "./Bubbles";
import { rng } from "./rng";
import { particles, useQuality } from "../quality";

export type PrecipitateProps = { at: () => Place; color: string; active: boolean; count?: number };

const dummy = new Object3D();

export function Precipitate({ at, color, active, count = 140 }: PrecipitateProps) {
  const mesh = useRef<InstancedMesh>(null);
  const level = useQuality((q) => q.level);
  const n = particles(Math.min(150, count), level); // P1-20: halved when the arena is slow
  // Normalised units (fractions of radius / height).
  const parts = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: n }, () => {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.8;
      return {
        x: Math.cos(a) * d, z: Math.sin(a) * d,
        y0: 0.35 + r() * 0.65, // starts suspended in the liquid
        rest: r() * 0.12 * (1 - d), // a small mound, higher in the middle
        speed: 0.12 + r() * 0.25, delay: r() * 0.9, size: 0.018 + r() * 0.02, y: 1,
      };
    });
  }, [n]);
  const age = useRef(0);

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    m.visible = active;
    if (!active) {
      age.current = 0;
      parts.forEach((p) => (p.y = p.y0));
      return;
    }
    const dt = Math.min(rawDt, 0.1);
    age.current += dt;
    const { origin, radius, height } = at();
    parts.forEach((p, i) => {
      const shown = age.current > p.delay;
      if (shown && p.y > p.rest) p.y = Math.max(p.rest, p.y - p.speed * dt);
      dummy.position.set(origin[0] + p.x * radius, origin[1] + p.y * height, origin[2] + p.z * radius);
      dummy.scale.setScalar(shown ? p.size * (radius / 0.4) * Math.min(1, (age.current - p.delay) * 3) : 0); // sizes scale with the flask
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, n]} frustumCulled={false} visible={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.6} />
    </instancedMesh>
  );
}
