"use client";
// src/three/effects/Bubbles.tsx: rising gas bubbles inside a flask (reaction.visual.bubbles, 05 §3). ≤ 200 instanced.
// `at()` is read every frame, so the effect follows a container that is laid out from the DOM.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { InstancedMesh, Object3D } from "three";
import { rng } from "./rng";
import { particles, useQuality } from "../quality";

/** Bottom centre of the liquid + its radius and height, in world units. */
export type Place = { origin: [number, number, number]; radius: number; height: number };

export type BubblesProps = { at: () => Place; active: boolean; count?: number; color?: string };

const dummy = new Object3D();

export function Bubbles({ at, active, count = 160, color = "#E0F2FE" }: BubblesProps) {
  const mesh = useRef<InstancedMesh>(null);
  const quality = useQuality((q) => q.level);
  const n = particles(Math.min(200, count), quality); // P1-20: halved when the arena is slow
  // Normalised units: d = fraction of the radius, y = fraction of the height.
  const parts = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: n }, () => ({
      a: r() * Math.PI * 2, d: Math.sqrt(r()) * 0.85, y: r(), speed: 0.35 + r() * 0.6, size: 0.015 + r() * 0.03, wob: r() * 10,
    }));
  }, [n]);
  const level = useRef(0); // fades bubbles in/out

  useFrame((_, rawDt) => {
    const m = mesh.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.1);
    level.current += ((active ? 1 : 0) - level.current) * Math.min(1, dt * 3);
    m.visible = level.current > 0.02;
    if (!m.visible) return;
    const { origin, radius, height } = at();
    parts.forEach((p, i) => {
      p.y += p.speed * dt;
      if (p.y > 1) p.y = active ? 0 : 1; // respawn at the bottom only while reacting
      p.wob += dt * 6;
      dummy.position.set(
        origin[0] + Math.cos(p.a) * p.d * radius + Math.sin(p.wob) * 0.01,
        origin[1] + p.y * height,
        origin[2] + Math.sin(p.a) * p.d * radius,
      );
      dummy.scale.setScalar(p.size * (radius / 0.4) * level.current * (p.y >= 1 ? 0 : 1)); // sizes scale with the flask
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, n]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={0.8} roughness={0.1} />
    </instancedMesh>
  );
}
