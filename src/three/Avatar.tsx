"use client";
// src/three/Avatar.tsx: glowing upper-body stick robot driven by the smoothed landmarks (docs/plan/04 §9).
// Joints 0 (head), 11–16; bones 11-12, 11-13, 13-15, 12-14, 14-16. Emissive cyan (physics) / magenta (chemistry).
// Reads engine.latest inside useFrame: no React re-render per pose frame.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { engine } from "@/motion/gestures";

const JOINTS = [0, 11, 12, 13, 14, 15, 16] as const;
const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];
const UP = new Vector3(0, 1, 0);

export type AvatarProps = {
  color?: string;
  position?: [number, number, number];
  scale?: number;
};

export function Avatar({ color = "#22D3EE", position = [0, 0, -1.5], scale = 1 }: AvatarProps) {
  const group = useRef<Group>(null);
  const joints = useRef<(Mesh | null)[]>([]);
  const bones = useRef<(Mesh | null)[]>([]);
  const neck = useRef<Mesh>(null);
  const pos = useMemo(() => new Map<number, Vector3>(JOINTS.map((j) => [j, new Vector3()])), []);
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3(), d: new Vector3(), q: new Quaternion(), mid: new Vector3() }), []);
  const seen = useRef(false);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const f = engine.latest;
    const pts = f.norm;
    if (!pts) {
      g.visible = seen.current; // keep the last pose on brief dropouts
      return;
    }
    // Keep the true aspect so angles on screen match the real arm: 4 world units across the frame width.
    const aspect = (f.videoH || 480) / (f.videoW || 640);
    const k = 1 - Math.exp(-dt * 18); // extra visual smoothing on top of the engine's EMA
    for (const j of JOINTS) {
      const p = pts[j];
      const target = tmp.a.set((0.5 - p.x) * 4, (1 - p.y) * 4 * aspect, 0); // mirrored: (1 − x)
      const cur = pos.get(j)!;
      if (!seen.current) cur.copy(target);
      else cur.lerp(target, k);
    }
    seen.current = true;
    g.visible = true;

    JOINTS.forEach((j, i) => {
      const m = joints.current[i];
      if (!m) return;
      m.position.copy(pos.get(j)!);
      m.visible = pts[j].visibility > 0.4;
    });
    BONES.forEach(([a, b], i) => {
      const m = bones.current[i];
      if (!m) return;
      placeBone(m, pos.get(a)!, pos.get(b)!, tmp);
      m.visible = pts[a].visibility > 0.4 && pts[b].visibility > 0.4;
    });
    if (neck.current) {
      tmp.mid.copy(pos.get(11)!).add(pos.get(12)!).multiplyScalar(0.5);
      placeBone(neck.current, pos.get(0)!, tmp.mid, tmp);
    }
  });

  return (
    <group ref={group} position={position} scale={scale} visible={false}>
      {/* A typical seated framing puts the shoulders ≈ 1.3 units up: chest height on the stage. */}
      <group position={[0, 0, 0]}>
        {JOINTS.map((j, i) => (
          <mesh key={j} ref={(m) => { joints.current[i] = m; }}>
            <sphereGeometry args={[j === 0 ? 0.26 : 0.09, 24, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={j === 0 ? 1.4 : 2} roughness={0.3} />
          </mesh>
        ))}
        {BONES.map((_, i) => (
          <mesh key={i} ref={(m) => { bones.current[i] = m; }}>
            <cylinderGeometry args={[0.045, 0.045, 1, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} roughness={0.4} />
          </mesh>
        ))}
        <mesh ref={neck}>
          <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
        </mesh>
      </group>
    </group>
  );
}

function placeBone(m: Mesh, a: Vector3, b: Vector3, tmp: { d: Vector3; q: Quaternion; mid: Vector3 }) {
  const len = tmp.d.copy(b).sub(a).length();
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.scale.set(1, Math.max(0.001, len), 1);
  if (len > 1e-6) m.quaternion.copy(tmp.q.setFromUnitVectors(UP, tmp.d.normalize()));
}
