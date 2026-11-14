"use client";
// src/three/lab/LabProps.tsx: procedural chemistry-lab furniture (no downloaded models → offline-safe).
// Units are metres. Every prop sits on y = 0 and faces +z unless rotated.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Quaternion, Vector3, type Group } from "three";
import { rng } from "../effects/rng";
import { periodicTexture, posterTexture, whiteboardTexture } from "./textures";

type P = { position?: [number, number, number]; rotation?: number; scale?: number };
const g = (p: P) => ({ position: p.position ?? [0, 0, 0], "rotation-y": p.rotation ?? 0, scale: p.scale ?? 1 });

const WOOD = "#A0643A";
const WOOD_DARK = "#7A4A2A";
const TOP = "#E5E7EB";
const CABINET = "#E9DCC6";
const METAL = "#94A3B8";

function Box({ size, position, color, rough = 0.7, metal = 0, emissive, ei = 0 }: {
  size: [number, number, number]; position: [number, number, number]; color: string; rough?: number; metal?: number; emissive?: string; ei?: number;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? "#000000"} emissiveIntensity={ei} />
    </mesh>
  );
}

/** Lab bench: cabinets below, a pale epoxy top, small drawer pulls. */
export function Bench({ length = 3, depth = 0.8, ...p }: P & { length?: number; depth?: number }) {
  const doors = Math.max(2, Math.round(length / 0.6));
  return (
    <group {...g(p)}>
      <Box size={[length, 0.86, depth]} position={[0, 0.43, 0]} color={CABINET} />
      <Box size={[length + 0.06, 0.06, depth + 0.06]} position={[0, 0.89, 0]} color={TOP} rough={0.35} />
      {Array.from({ length: doors }, (_, i) => (
        <group key={i} position={[-length / 2 + (i + 0.5) * (length / doors), 0, depth / 2 + 0.005]}>
          <Box size={[length / doors - 0.06, 0.7, 0.01]} position={[0, 0.42, 0]} color="#DCCBAE" />
          <Box size={[0.12, 0.02, 0.03]} position={[0, 0.72, 0.015]} color={METAL} metal={0.8} rough={0.3} />
        </group>
      ))}
    </group>
  );
}

const LIQUIDS = ["#60A5FA", "#F472B6", "#FDE047", "#4ADE80", "#FB923C", "#A78BFA", "#22D3EE", "#F87171"];

/** A beaker / flask with coloured liquid. */
export function Glass({ kind = "beaker", color = "#60A5FA", ...p }: P & { kind?: "beaker" | "flask" | "tube" | "bottle"; color?: string }) {
  if (kind === "flask")
    return (
      <group {...g(p)}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.035, 0.1, 0.18, 20, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} roughness={0.05} side={2} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.06, 0.095, 0.09, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 14, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} side={2} />
        </mesh>
      </group>
    );
  if (kind === "tube")
    return (
      <group {...g(p)}>
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.18, 12, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.35} side={2} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.09, 12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  if (kind === "bottle")
    return (
      <group {...g(p)}>
        <Box size={[0.1, 0.18, 0.1]} position={[0, 0.09, 0]} color={color} rough={0.3} />
        <Box size={[0.07, 0.05, 0.07]} position={[0, 0.2, 0]} color="#334155" />
        <Box size={[0.08, 0.07, 0.005]} position={[0, 0.09, 0.051]} color="#F8FAFC" />
      </group>
    );
  return (
    <group {...g(p)}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.07, 0.065, 0.16, 20, 1, true]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} roughness={0.05} side={2} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.062, 0.06, 0.09, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** A row of mixed glassware for a bench top (stable layout per seed). */
export function Glassware({ width = 2, seed = 1, y = 0.92, ...p }: P & { width?: number; seed?: number; y?: number }) {
  const items = useMemo(() => {
    const r = rng(seed);
    const n = Math.round(width * 3);
    const kinds = ["beaker", "flask", "tube", "beaker", "bottle"] as const;
    return Array.from({ length: n }, (_, i) => ({
      x: -width / 2 + (i + 0.5) * (width / n) + (r() - 0.5) * 0.08,
      z: (r() - 0.5) * 0.3,
      kind: kinds[Math.floor(r() * kinds.length)],
      color: LIQUIDS[Math.floor(r() * LIQUIDS.length)],
    }));
  }, [width, seed]);
  return (
    <group {...g(p)}>
      {items.map((it, i) => (
        <Glass key={i} kind={it.kind} color={it.color} position={[it.x, y, it.z]} />
      ))}
    </group>
  );
}

/** Wall shelf unit with reagent bottles. */
export function ReagentShelf({ width = 2, seed = 3, ...p }: P & { width?: number; seed?: number }) {
  const rows = [0.9, 1.35, 1.8];
  return (
    <group {...g(p)}>
      <Box size={[width, 2.1, 0.04]} position={[0, 1.05, -0.17]} color={WOOD_DARK} />
      {rows.map((y, i) => (
        <group key={i}>
          <Box size={[width, 0.04, 0.36]} position={[0, y, 0]} color={WOOD} />
          <Glassware width={width - 0.2} seed={seed * 7 + i} y={y + 0.02} />
        </group>
      ))}
      <Box size={[0.04, 2.1, 0.36]} position={[-width / 2, 1.05, 0]} color={WOOD} />
      <Box size={[0.04, 2.1, 0.36]} position={[width / 2, 1.05, 0]} color={WOOD} />
      <Bench length={width} depth={0.4} />
    </group>
  );
}

/** Fume hood: cabinet, glass sash, a soft inner light. */
export function FumeHood(p: P) {
  return (
    <group {...g(p)}>
      <Bench length={1.4} depth={0.8} />
      <Box size={[1.4, 1.2, 0.05]} position={[0, 1.5, -0.38]} color="#CBD5E1" />
      <Box size={[0.05, 1.2, 0.8]} position={[-0.68, 1.5, 0]} color="#CBD5E1" />
      <Box size={[0.05, 1.2, 0.8]} position={[0.68, 1.5, 0]} color="#CBD5E1" />
      <Box size={[1.45, 0.35, 0.85]} position={[0, 2.25, 0]} color="#E2E8F0" />
      <mesh position={[0, 1.55, 0.38]}>
        <boxGeometry args={[1.32, 0.9, 0.02]} />
        <meshStandardMaterial color="#BAE6FD" transparent opacity={0.25} roughness={0.05} />
      </mesh>
      <Box size={[1.2, 0.03, 0.4]} position={[0, 2.03, -0.1]} color="#FEF9C3" emissive="#FEF9C3" ei={1.2} />
      <Glassware width={1} seed={42} />
    </group>
  );
}

export function Sink(p: P) {
  return (
    <group {...g(p)}>
      <Bench length={1.2} depth={0.7} />
      <Box size={[0.6, 0.02, 0.45]} position={[0, 0.925, 0]} color="#64748B" metal={0.6} rough={0.3} />
      <mesh position={[0, 1.12, -0.25]}>
        <cylinderGeometry args={[0.02, 0.02, 0.38, 10]} />
        <meshStandardMaterial color={METAL} metalness={0.9} roughness={0.2} />
      </mesh>
      <Box size={[0.03, 0.03, 0.2]} position={[0, 1.3, -0.16]} color={METAL} metal={0.9} rough={0.2} />
    </group>
  );
}

export function Stool(p: P) {
  return (
    <group {...g(p)}>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 20]} />
        <meshStandardMaterial color="#1F2937" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.31, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.03, 20]} />
        <meshStandardMaterial color={METAL} metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function Plant({ size = 1, ...p }: P & { size?: number }) {
  const leaves = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + r() * 0.4, tilt: 0.5 + r() * 0.5, len: 0.35 + r() * 0.25 }));
  }, []);
  return (
    <group {...g(p)} scale={size}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.16, 0.12, 0.3, 16]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.5} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={[Math.cos(l.a) * 0.08, 0.3 + l.len * 0.45, Math.sin(l.a) * 0.08]} rotation={[Math.sin(l.a) * l.tilt, 0, -Math.cos(l.a) * l.tilt]}>
          <boxGeometry args={[0.07, l.len, 0.015]} />
          <meshStandardMaterial color={i % 2 ? "#22C55E" : "#16A34A"} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** A flat picture on a wall (texture map), with a thin frame. */
function Framed({ map, w, h, ...p }: P & { map: ReturnType<typeof periodicTexture>; w: number; h: number }) {
  return (
    <group {...g(p)}>
      <Box size={[w + 0.08, h + 0.08, 0.03]} position={[0, 0, -0.02]} color={WOOD_DARK} />
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={map} roughness={0.8} emissive="#ffffff" emissiveIntensity={0.08} emissiveMap={map} />
      </mesh>
    </group>
  );
}

export function PeriodicPoster(p: P & { w?: number }) {
  const map = useMemo(() => periodicTexture(), []);
  const w = p.w ?? 1.6;
  return <Framed {...p} map={map} w={w} h={w * 0.586} />;
}

export function Poster({ title, lines, band, ...p }: P & { title: string; lines: string[]; band: string }) {
  const map = useMemo(() => posterTexture(title, lines, band), [title, lines, band]);
  return <Framed {...p} map={map} w={0.55} h={0.75} />;
}

export function Whiteboard({ lines, ...p }: P & { lines: string[] }) {
  const map = useMemo(() => whiteboardTexture(lines), [lines]);
  return <Framed {...p} map={map} w={2} h={1} />;
}

/** A window: frame, glass glowing like evening sky, a sill plant. */
export function LabWindow(p: P) {
  return (
    <group {...g(p)}>
      <Box size={[1.3, 1.1, 0.05]} position={[0, 0, -0.01]} color="#F8FAFC" />
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.18, 0.98]} />
        <meshStandardMaterial color="#1E3A8A" emissive="#3B82F6" emissiveIntensity={0.35} />
      </mesh>
      <Box size={[0.04, 0.98, 0.04]} position={[0, 0, 0.04]} color="#F8FAFC" />
      <Box size={[1.18, 0.04, 0.04]} position={[0, 0, 0.04]} color="#F8FAFC" />
      <Box size={[1.4, 0.05, 0.2]} position={[0, -0.58, 0.08]} color="#F8FAFC" />
    </group>
  );
}

/** Desk with a chair (study room). */
export function Desk(p: P) {
  return (
    <group {...g(p)}>
      <Box size={[1.2, 0.05, 0.6]} position={[0, 0.74, 0]} color={WOOD} />
      {[[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].map(([x, z], i) => (
        <Box key={i} size={[0.05, 0.72, 0.05]} position={[x, 0.36, z]} color={WOOD_DARK} />
      ))}
      <Box size={[0.3, 0.02, 0.22]} position={[-0.2, 0.775, 0]} color="#DC2626" />
      <Box size={[0.3, 0.02, 0.22]} position={[0.25, 0.775, 0.05]} color="#2563EB" />
      <group position={[0, 0, 0.55]}>
        <Box size={[0.45, 0.05, 0.42]} position={[0, 0.45, 0]} color="#334155" />
        <Box size={[0.45, 0.45, 0.05]} position={[0, 0.7, 0.2]} color="#334155" />
        <Box size={[0.04, 0.45, 0.04]} position={[0, 0.22, 0]} color={METAL} metal={0.8} />
      </group>
    </group>
  );
}

export function Bookshelf(p: P) {
  const books = useMemo(() => {
    const r = rng(17);
    const cols = ["#DC2626", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0EA5E9", "#BE185D"];
    return [0.1, 0.55, 1.0, 1.45].flatMap((y) => {
      let x = -0.55;
      const row: { x: number; y: number; w: number; h: number; c: string }[] = [];
      while (x < 0.5) {
        const w = 0.05 + r() * 0.04;
        const h = 0.28 + r() * 0.1;
        row.push({ x: x + w / 2, y: y + h / 2, w, h, c: cols[Math.floor(r() * cols.length)] });
        x += w + 0.008;
      }
      return row;
    });
  }, []);
  return (
    <group {...g(p)}>
      <Box size={[1.25, 1.9, 0.04]} position={[0, 0.95, -0.15]} color={WOOD_DARK} />
      {[0.08, 0.53, 0.98, 1.43, 1.88].map((y, i) => (
        <Box key={i} size={[1.25, 0.04, 0.32]} position={[0, y, 0]} color={WOOD} />
      ))}
      <Box size={[0.04, 1.9, 0.32]} position={[-0.62, 0.95, 0]} color={WOOD} />
      <Box size={[0.04, 1.9, 0.32]} position={[0.62, 0.95, 0]} color={WOOD} />
      {books.map((b, i) => (
        <Box key={i} size={[b.w, b.h, 0.24]} position={[b.x, b.y, 0]} color={b.c} />
      ))}
    </group>
  );
}

const CPK: Record<string, string> = { H: "#FFFFFF", O: "#FF0D0D", C: "#333333", N: "#3050F8", Cl: "#1FF01F", Na: "#A020F0" };

/** Ball-and-stick molecule model on a little stand; slowly turns. */
export function MoleculeModel({ atoms, ...p }: P & { atoms: { el: string; at: [number, number, number] }[] }) {
  const spin = useRef<Group>(null);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += Math.min(dt, 0.1) * 0.6;
  });
  // Bonds from the first (central) atom to each other atom: a Y-cylinder turned to point along the bond.
  const bonds = useMemo(() => {
    const c = new Vector3(...atoms[0].at);
    return atoms.slice(1).map((a) => {
      const end = new Vector3(...a.at);
      const dir = end.clone().sub(c);
      const len = dir.length();
      return { mid: c.clone().add(end).multiplyScalar(0.5), len, q: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()) };
    });
  }, [atoms]);
  return (
    <group {...g(p)}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.8, 10]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.06, 24]} />
        <meshStandardMaterial color="#475569" roughness={0.5} />
      </mesh>
      <group ref={spin} position={[0, 1.05, 0]}>
        {bonds.map((b, i) => (
          <mesh key={`b${i}`} position={b.mid} quaternion={b.q}>
            <cylinderGeometry args={[0.025, 0.025, b.len, 8]} />
            <meshStandardMaterial color="#CBD5E1" />
          </mesh>
        ))}
        {atoms.map((a, i) => (
          <mesh key={i} position={a.at}>
            <sphereGeometry args={[a.el === "H" ? 0.09 : 0.14, 20, 16]} />
            <meshStandardMaterial color={CPK[a.el] ?? "#9CA3AF"} roughness={0.3} emissive={CPK[a.el] ?? "#9CA3AF"} emissiveIntensity={0.1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export const WATER = [{ el: "O", at: [0, 0, 0] as [number, number, number] }, { el: "H", at: [0.2, -0.14, 0] as [number, number, number] }, { el: "H", at: [-0.2, -0.14, 0] as [number, number, number] }];
export const CO2 = [{ el: "C", at: [0, 0, 0] as [number, number, number] }, { el: "O", at: [0.26, 0, 0] as [number, number, number] }, { el: "O", at: [-0.26, 0, 0] as [number, number, number] }];
export const CH4 = [
  { el: "C", at: [0, 0, 0] as [number, number, number] }, { el: "H", at: [0.15, 0.15, 0.15] as [number, number, number] }, { el: "H", at: [-0.15, -0.15, 0.15] as [number, number, number] },
  { el: "H", at: [-0.15, 0.15, -0.15] as [number, number, number] }, { el: "H", at: [0.15, -0.15, -0.15] as [number, number, number] },
];

/** Big balance scale (Balance Lab centrepiece). */
export function BigScale(p: P) {
  const beam = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (beam.current) beam.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.06;
  });
  return (
    <group {...g(p)}>
      <Box size={[0.8, 0.1, 0.5]} position={[0, 0.05, 0]} color={WOOD_DARK} />
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 1.4, 12]} />
        <meshStandardMaterial color="#B45309" metalness={0.6} roughness={0.3} />
      </mesh>
      <group ref={beam} position={[0, 1.45, 0]}>
        <Box size={[1.6, 0.05, 0.06]} position={[0, 0, 0]} color="#B45309" metal={0.6} rough={0.3} />
        {[-0.75, 0.75].map((x) => (
          <group key={x} position={[x, -0.35, 0]}>
            <mesh>
              <cylinderGeometry args={[0.28, 0.22, 0.04, 24]} />
              <meshStandardMaterial color="#D97706" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.17, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.34, 6]} />
              <meshStandardMaterial color="#B45309" />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <sphereGeometry args={[0.07, 16, 12]} />
              <meshStandardMaterial color={x < 0 ? "#FF0D0D" : "#FFFFFF"} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Titration stand: base, rod, clamp, burette, pink flask. */
export function TitrationStand(p: P) {
  return (
    <group {...g(p)}>
      <Box size={[0.3, 0.02, 0.2]} position={[0, 0.91, 0]} color="#1F2937" />
      <mesh position={[-0.1, 1.4, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.8} />
      </mesh>
      <Box size={[0.14, 0.03, 0.03]} position={[-0.04, 1.6, 0]} color={METAL} metal={0.8} />
      <mesh position={[0.03, 1.55, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 10, 1, true]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.4} side={2} />
      </mesh>
      <mesh position={[0.03, 1.65, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.45, 10]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.6} />
      </mesh>
      <Glass kind="flask" color="#F472B6" position={[0.03, 0.92, 0]} />
    </group>
  );
}
