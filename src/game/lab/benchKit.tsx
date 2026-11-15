"use client";
// src/game/lab/benchKit.tsx: the shared parts of every Experiments Lab bench, so each experiment is only its
// chemistry + its reaction visuals. ✊ Grab an item (nearest to your hand) → hold it over a target → tilt your hand
// to pour (powder / liquid / drops / drop-in solid). Open your hand = put it back. Twins: number keys or a click on
// an item's label pour one step automatically. The amounts live in one store; each experiment reads them.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { create } from "zustand";
import { Color, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import type { Side } from "@/motion/types";
import { useTarget } from "@/motion/targets";
import { ChemText } from "../ChemText";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";

export type PourKind = "powder" | "liquid" | "drops" | "solid";
export type BenchItem = {
  id: string;
  name: string;
  formula?: string; // shown on the label (ChemText)
  kind: PourKind;
  home: [number, number, number];
  color: string; // what comes out
  /** amount units per second while pouring; "limit" = full container (1 = all of it, or a count of drops/pieces) */
  rate: number;
  step: number; // one key press / click
  limit: number;
  unit: (v: number) => string; // label text for the amount, e.g. "5.0 g"
  /** where it pours: index into the scene's targets (default 0) or "nearest" to the item */
  target?: number | "nearest";
  look: "jar" | "bottle" | "dropper" | "beaker" | "jug" | "nail" | "tablet" | "balloon";
};

export type BState = {
  amounts: Record<string, number>; // per item: how much went in (total)
  into: Record<string, number[]>; // per item: how much went into each target
  held: Record<Side, string | null>;
  grabTilt: Record<Side, number>;
  auto: { item: string; until: number; target: number } | null;
  run: number; // bumps on "again"
  /** Guided steps: only these items can be used right now (null = all; [] = none, e.g. a "watch" step). */
  allowed: string[] | null;
  /** Guided steps: this item may only pour into this target. */
  lock: Record<string, number> | null;
  /** Things the scene saw happen ("erupted", "inflated"…), for "watch" steps. */
  flags: Record<string, boolean>;
};
const freshB = (run = 0): BState => ({ amounts: {}, into: {}, held: { left: null, right: null }, grabTilt: { left: 0, right: 0 }, auto: null, run, allowed: null, lock: null, flags: {} });
export const setFlag = (name: string) => {
  if (!useBench.getState().flags[name]) useBench.setState((s) => ({ flags: { ...s.flags, [name]: true } }));
};
const canUse = (st: BState, id: string) => !st.allowed || st.allowed.includes(id);
export const useBench = create<BState>(() => freshB());
export const resetBench = () => useBench.setState((s) => freshB(s.run + 1));
export const amountOf = (id: string) => useBench.getState().amounts[id] ?? 0;

/** Key / click twin: pour one step of an item (into target `t`, or its own target). */
export function autoPour(item: BenchItem, t?: number) {
  const st = useBench.getState();
  if (st.auto || !canUse(st, item.id)) return; // guided: not this step yet
  const now = st.amounts[item.id] ?? 0;
  if (now >= item.limit - 1e-6) return;
  const locked = st.lock?.[item.id];
  if (locked !== undefined && t !== undefined && t !== locked) return;
  useBench.setState({ auto: { item: item.id, until: Math.min(item.limit, now + item.step), target: locked ?? t ?? (typeof item.target === "number" ? item.target : 0) } });
}

// ---------------------------------------------------------------- 3D: hands + pouring

const ndc = new Vector3();
function toWorld(x: number, y: number, w: number, h: number, camera: never, z: number, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const cam = (camera as unknown as { position: Vector3 }).position;
  const dir = ndc.sub(cam).normalize();
  return out.copy(cam).addScaledVector(dir, (z - cam.z) / dir.z);
}

export type PourInfo = { item: BenchItem | null; target: number; lip: Vector3; to: Vector3 };

/** Moves the items (home / in your hand / auto-pour), pours into targets, draws the stream + drops.
 *  `targets` are world points (the mouth of each container). Calls onFrame each frame with what's pouring. */
export function BenchItems({ items, targets, onFrame }: { items: BenchItem[]; targets: Vector3[]; onFrame?: (p: PourInfo, dt: number) => void }) {
  const { camera, size } = useThree();
  const groups = useRef<Record<string, Group | null>>({});
  const stream = useRef<Mesh>(null);
  const drop = useRef<Mesh>(null);
  const arrow = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const sim = useRef({ screen: {} as Record<string, { x: number; y: number }>, targetsScreen: [] as { x: number; y: number }[], dropT: 0 });
  const tmp = useMemo(() => new Vector3(), []);

  useEffect(() => {
    const offs = [
      subscribe("grab", (e) => {
        if (!e.side) return;
        const st = useBench.getState();
        const c = useGame.getState().cursors[e.side];
        if (!c.visible || st.auto) return;
        let best: string | null = null, bestD = 140;
        for (const it of items) {
          if (!canUse(st, it.id) || st.held.left === it.id || st.held.right === it.id || (st.amounts[it.id] ?? 0) >= it.limit - 1e-6) continue;
          const p = sim.current.screen[it.id];
          if (!p) continue;
          const d = Math.hypot(p.x - c.x, p.y - c.y);
          if (d < bestD) {
            bestD = d;
            best = it.id;
          }
        }
        if (best) {
          useBench.setState({ held: { ...st.held, [e.side]: best }, grabTilt: { ...st.grabTilt, [e.side]: useGame.getState().hands[e.side].tilt } });
          playSfx("pop", 0.3);
        }
      }),
      subscribe("release", (e) => {
        if (!e.side) return;
        const st = useBench.getState();
        if (st.held[e.side]) useBench.setState({ held: { ...st.held, [e.side]: null } });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [items]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const S = sim.current;
    const st = useBench.getState();
    const G = useGame.getState();
    S.targetsScreen = targets.map((t) => {
      tmp.copy(t).project(camera);
      return { x: ((tmp.x + 1) / 2) * size.width, y: ((1 - tmp.y) / 2) * size.height };
    });
    let pouring: BenchItem | null = null, target = 0;
    let lip = new Vector3();

    for (const it of items) {
      const g = groups.current[it.id];
      if (!g) continue;
      const home = new Vector3(...it.home);
      const side = st.held.left === it.id ? "left" : st.held.right === it.id ? "right" : null;
      let want = home.clone();
      let tilt = 0;
      let tIdx = typeof it.target === "number" ? it.target : 0;
      if (st.auto?.item === it.id) {
        tIdx = st.auto.target;
        const to = targets[tIdx];
        const sign = home.x < to.x ? -1 : 1;
        want = new Vector3(to.x + sign * 0.5, to.y + 0.42, to.z);
        tilt = sign * (it.kind === "solid" ? 2.2 : 1.7);
        if (g.position.distanceTo(want) < 0.2) pouring = it;
      } else if (side) {
        const c = G.cursors[side];
        if (c.visible) want = toWorld(c.x, c.y, size.width, size.height, camera as never, 1.0, new Vector3());
        want.y = Math.max(0.35, want.y);
        const d = ((G.hands[side].tilt - st.grabTilt[side] + 540) % 360) - 180;
        tilt = (-d * Math.PI) / 180;
        // Pour into the target under the hand (nearest on screen).
        let bd = 170;
        S.targetsScreen.forEach((p, i) => {
          const lockT = st.lock?.[it.id];
          if (lockT !== undefined ? i !== lockT : it.target !== "nearest" && typeof it.target === "number" && i !== it.target) return;
          const dd = Math.hypot(c.x - p.x, c.y - p.y);
          if (dd < bd) {
            bd = dd;
            tIdx = i;
          }
        });
        if (bd < 170 && Math.abs(d) >= 30) pouring = it;
      }
      g.position.lerp(want, Math.min(1, dt * 10));
      g.rotation.z += (tilt - g.rotation.z) * Math.min(1, dt * 8);
      g.visible = !(it.kind === "solid" && (st.amounts[it.id] ?? 0) >= it.limit - 1e-6); // dropped in: gone from the bench
      tmp.copy(g.position).setY(g.position.y + 0.3).project(camera);
      S.screen[it.id] = { x: ((tmp.x + 1) / 2) * size.width, y: ((1 - tmp.y) / 2) * size.height };
      if (pouring === it) {
        target = tIdx;
        const sign = g.position.x < targets[tIdx].x ? 1 : -1;
        lip = new Vector3(g.position.x + sign * 0.28, g.position.y + 0.3, g.position.z);
      }
    }

    if (pouring) {
      const now = st.amounts[pouring.id] ?? 0;
      const cap = st.auto?.item === pouring.id ? st.auto.until : pouring.limit;
      const add = pouring.kind === "solid" ? Math.min(cap - now, 1) : Math.min(cap - now, pouring.rate * Math.min(rawDt, 0.25));
      if (add > 0) {
        const into = [...(st.into[pouring.id] ?? targets.map(() => 0))];
        into[target] = (into[target] ?? 0) + add;
        const next = now + add;
        const full = next >= pouring.limit - 1e-6;
        const doneAuto = st.auto?.item === pouring.id && next >= cap - 1e-6;
        useBench.setState({
          amounts: { ...st.amounts, [pouring.id]: next },
          into: { ...st.into, [pouring.id]: into },
          auto: doneAuto ? null : st.auto,
          // A full container, or a solid piece just dropped in, leaves your hand (grab again for the next piece).
          held: full || pouring.kind === "solid" ? { left: st.held.left === pouring.id ? null : st.held.left, right: st.held.right === pouring.id ? null : st.held.right } : st.held,
        });
        if (pouring.kind === "drops" && Math.floor(next) > Math.floor(now)) playSfx("pop", 0.15);
        if (pouring.kind === "solid") playSfx("pop", 0.4);
      } else if (st.auto?.item === pouring.id) useBench.setState({ auto: null });
    }

    const to = targets[target] ?? targets[0];
    const s = stream.current;
    if (s) {
      s.visible = !!pouring && (pouring.kind === "liquid" || pouring.kind === "powder");
      if (s.visible && pouring) {
        const bottom = to.clone().setY(to.y + 0.04);
        const len = Math.max(0.05, lip.distanceTo(bottom));
        s.position.copy(lip).add(bottom).multiplyScalar(0.5);
        const w = pouring.kind === "powder" ? 1.4 : 1;
        s.scale.set(w, len, w);
        s.lookAt(bottom);
        s.rotateX(Math.PI / 2);
        const m = s.material as MeshStandardMaterial;
        m.color.set(pouring.color);
        m.opacity = pouring.kind === "powder" ? 0.55 : 0.82;
      }
    }
    const dr = drop.current;
    if (dr) {
      S.dropT = pouring?.kind === "drops" ? (S.dropT + dt * 3.5) % 1 : 0;
      dr.visible = pouring?.kind === "drops";
      if (dr.visible && pouring) {
        dr.position.lerpVectors(lip, to, S.dropT);
        (dr.material as MeshStandardMaterial).color.set(pouring.color);
      }
    }
    // Guided step: an arrow bobs over the item to use now, a ring pulses on where it goes.
    const cur = st.allowed && st.allowed.length === 1 ? items.find((i) => i.id === st.allowed![0]) : undefined;
    const curG = cur ? groups.current[cur.id] : null;
    const busy = !!cur && (st.auto?.item === cur.id || st.held.left === cur.id || st.held.right === cur.id);
    if (arrow.current) {
      arrow.current.visible = !!curG && !busy;
      if (curG) arrow.current.position.set(curG.position.x, curG.position.y + 1.05 + Math.sin(clock.elapsedTime * 4) * 0.07, curG.position.z);
    }
    if (ring.current) {
      const tIdx = cur ? (st.lock?.[cur.id] ?? (typeof cur.target === "number" ? cur.target : cur.target === "nearest" ? -1 : 0)) : -1;
      ring.current.visible = !!cur && tIdx >= 0 && !!targets[tIdx];
      if (ring.current.visible) {
        ring.current.position.copy(targets[tIdx]).setY(targets[tIdx].y + 0.04);
        ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.08);
      }
    }
    onFrame?.({ item: pouring, target, lip, to }, dt);
  });

  return (
    <group>
      {items.map((it) => (
        <group key={it.id} ref={(el) => void (groups.current[it.id] = el)} position={it.home}>
          <Look it={it} />
        </group>
      ))}
      <mesh ref={stream} visible={false}>
        <cylinderGeometry args={[0.03, 0.045, 1, 12]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.8} />
      </mesh>
      <mesh ref={drop} visible={false}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#DC2626" emissive="#DC2626" emissiveIntensity={0.15} />
      </mesh>
      <group ref={arrow} visible={false}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 0.24, 20]} />
          <meshStandardMaterial color="#A3E635" emissive="#A3E635" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.18, 12]} />
          <meshStandardMaterial color="#A3E635" emissive="#A3E635" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.3, 0.018, 10, 40]} />
        <meshStandardMaterial color="#A3E635" emissive="#A3E635" emissiveIntensity={0.7} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// depthWrite off: glass must never hide what's inside it (three sorts transparent meshes by centre, so a liquid
// layer whose centre is nearer the camera than the glass's would otherwise fail the depth test and vanish).
const GLASS = { color: "#E0F2FE", transparent: true, opacity: 0.3, roughness: 0.05, side: 2 as const, depthWrite: false };

/** Simple, readable containers (glass + contents + a label sticker). */
function Look({ it }: { it: BenchItem }) {
  switch (it.look) {
    case "jar":
      return (
        <>
          <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.24, 0.24, 0.44, 28, 1, true]} /><meshStandardMaterial {...GLASS} /></mesh>
          <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.22, 0.22, 0.24, 28]} /><meshStandardMaterial color={it.color} roughness={0.9} /></mesh>
          <mesh position={[0, 0.27, 0.242]}><planeGeometry args={[0.34, 0.12]} /><meshStandardMaterial color="#F97316" /></mesh>
        </>
      );
    case "dropper":
      return (
        <>
          <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.1, 0.1, 0.26, 20]} /><meshStandardMaterial color={it.color} roughness={0.3} /></mesh>
          <mesh position={[0, 0.31, 0]}><coneGeometry args={[0.06, 0.12, 16]} /><meshStandardMaterial color="#F8FAFC" /></mesh>
        </>
      );
    case "bottle":
      return (
        <>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.2, 0.2, 0.6, 28, 1, true]} /><meshStandardMaterial {...GLASS} /></mesh>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.185, 0.185, 0.48, 28]} /><meshStandardMaterial color={it.color} transparent opacity={0.85} /></mesh>
          <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.06, 0.12, 0.22, 20]} /><meshStandardMaterial {...GLASS} opacity={0.4} /></mesh>
          <mesh position={[0, 0.3, 0.205]}><planeGeometry args={[0.28, 0.18]} /><meshStandardMaterial color="#FDE68A" /></mesh>
        </>
      );
    case "jug":
      return (
        <>
          <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.24, 0.26, 0.56, 28, 1, true]} /><meshStandardMaterial {...GLASS} /></mesh>
          <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.23, 0.25, 0.42, 28]} /><meshStandardMaterial color={it.color} transparent opacity={0.88} /></mesh>
          <mesh position={[0.29, 0.32, 0]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[0.1, 0.025, 8, 16, Math.PI]} /><meshStandardMaterial {...GLASS} opacity={0.5} /></mesh>
        </>
      );
    case "beaker":
      return (
        <>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.22, 0.21, 0.5, 28, 1, true]} /><meshStandardMaterial {...GLASS} /></mesh>
          <mesh position={[0, 0.16, 0]}><cylinderGeometry args={[0.2, 0.2, 0.3, 28]} /><meshStandardMaterial color={it.color} transparent opacity={0.85} /></mesh>
        </>
      );
    case "nail":
      return (
        <group rotation={[0, 0, 0.15]}>
          <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.025, 0.025, 0.5, 10]} /><meshStandardMaterial color="#8E9196" metalness={0.8} roughness={0.35} /></mesh>
          <mesh position={[0, 0.51, 0]}><cylinderGeometry args={[0.06, 0.06, 0.025, 16]} /><meshStandardMaterial color="#8E9196" metalness={0.8} roughness={0.35} /></mesh>
          <mesh position={[0, -0.01, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.025, 0.05, 10]} /><meshStandardMaterial color="#8E9196" metalness={0.8} /></mesh>
        </group>
      );
    case "tablet":
      return (
        <>
          <mesh position={[0, 0.04, 0]}><boxGeometry args={[0.5, 0.06, 0.34]} /><meshStandardMaterial color="#C0C6D0" metalness={0.5} roughness={0.4} /></mesh>
          {[-0.12, 0.12].map((x) => (
            <mesh key={x} position={[x, 0.09, 0]}><cylinderGeometry args={[0.09, 0.09, 0.04, 20]} /><meshStandardMaterial color="#F8FAFC" roughness={0.8} /></mesh>
          ))}
        </>
      );
    case "balloon":
      return (
        <>
          <mesh position={[0, 0.17, 0]} scale={[1, 1.25, 1]}><sphereGeometry args={[0.15, 20, 16]} /><meshStandardMaterial color={it.color} roughness={0.4} /></mesh>
          <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.035, 0.05, 0.08, 12]} /><meshStandardMaterial color={it.color} roughness={0.4} /></mesh>
        </>
      );
  }
}

/** The lab bench (top + cabinet). */
export function Bench({ children }: { children?: ReactNode }) {
  return (
    <group>
      <mesh position={[0, -0.05, 0.6]} receiveShadow>
        <boxGeometry args={[9, 0.1, 2.6]} />
        <meshStandardMaterial color="#E5E7EB" roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.52, 0.65]}>
        <boxGeometry args={[8.8, 0.85, 2.4]} />
        <meshStandardMaterial color="#E9DCC6" roughness={0.8} />
      </mesh>
      {children}
    </group>
  );
}

/** Glass container with a liquid whose level (0..1) and colour animate. */
export function Vessel({ at, r = 0.3, h = 0.7, level, color, open = true, liquidRef, glow = 0, opacity = 0.85 }: { at: [number, number, number]; r?: number; h?: number; level: number; color: string; open?: boolean; liquidRef?: (m: Mesh | null) => void; glow?: number; opacity?: number }) {
  return (
    <group position={at}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[r, r * 0.97, h, 32, 1, open]} />
        <meshStandardMaterial {...GLASS} />
      </mesh>
      <mesh ref={liquidRef} position={[0, 0.02 + (h * 0.9 * Math.max(0.02, level)) / 2, 0]} scale={[1, Math.max(0.02, level), 1]} visible={level > 0.01}>
        <cylinderGeometry args={[r * 0.93, r * 0.9, h * 0.9, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} transparent opacity={Math.min(1, opacity + glow * 0.3)} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- 3D: foam particles (volcano / elephant toothpaste)

/** Rising foam: emitted at `from` with an upward speed; falls under weak gravity; slides along `surface(x, z)`
 *  (the height of whatever it lands on) and settles. `energy.current` (0..~2) sets how much comes out. */
export function Foam({ from, energy, color, up = 2.4, spread = 0.6, gravity = 4, size = 0.08, count = 240, surface }: {
  from: Vector3; energy: { current: number }; color: string; up?: number; spread?: number; gravity?: number; size?: number; count?: number;
  surface: (x: number, z: number) => number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const sim = useRef({ p: new Float32Array(count * 3), v: new Float32Array(count * 3), life: new Float32Array(count), s: new Float32Array(count), next: 0 });
  const tmp = useMemo(() => ({ o: new Object3D(), c: new Color(), base: new Color(), white: new Color("#FFF4EC") }), []);
  const run = useBench((s) => s.run);
  useEffect(() => void sim.current.life.fill(0), [run]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const S = sim.current, m = mesh.current;
    if (!m) return;
    const n = energy.current > 0.02 ? Math.ceil(energy.current * 100 * dt) : 0;
    for (let k = 0; k < n; k++) {
      const i = S.next;
      S.next = (S.next + 1) % count;
      const a = Math.random() * Math.PI * 2, o = Math.random() * spread;
      S.p[i * 3] = from.x; S.p[i * 3 + 1] = from.y; S.p[i * 3 + 2] = from.z;
      S.v[i * 3] = Math.cos(a) * o; S.v[i * 3 + 1] = up * (0.7 + Math.random() * 0.6) * (0.6 + energy.current * 0.5); S.v[i * 3 + 2] = Math.sin(a) * o * 0.6;
      S.life[i] = 4 + Math.random() * 3; S.s[i] = size * (0.7 + Math.random() * 0.8);
    }
    tmp.base.set(color);
    for (let i = 0; i < count; i++) {
      if (S.life[i] <= 0) { tmp.o.scale.setScalar(0); tmp.o.updateMatrix(); m.setMatrixAt(i, tmp.o.matrix); continue; }
      S.life[i] -= dt;
      let x = S.p[i * 3], y = S.p[i * 3 + 1], z = S.p[i * 3 + 2];
      let vx = S.v[i * 3], vy = S.v[i * 3 + 1], vz = S.v[i * 3 + 2];
      vy -= gravity * dt;
      const floor = surface(x, z) + S.s[i];
      if (y <= floor && vy < 0) { y = floor; vy = 0; vx *= 0.9; vz *= 0.9; }
      x += vx * dt; y += vy * dt; z += vz * dt;
      S.p[i * 3] = x; S.p[i * 3 + 1] = y; S.p[i * 3 + 2] = z;
      S.v[i * 3] = vx; S.v[i * 3 + 1] = vy; S.v[i * 3 + 2] = vz;
      tmp.o.position.set(x, y, z);
      tmp.o.scale.setScalar(S.s[i] * (0.5 + Math.min(1, S.life[i] / 1.5) * 0.7));
      tmp.o.updateMatrix();
      m.setMatrixAt(i, tmp.o.matrix);
      m.setColorAt(i, tmp.c.copy(tmp.white).lerp(tmp.base, 0.75 + ((i * 37) % 10) / 45));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial roughness={0.45} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------- DOM

/** Number keys (1..9) and R, for the experiment that's open. */
export function useExpKeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const f = ref.current[e.key.toLowerCase()];
      if (f) f();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

export function ExpHeader({ kicker, title, chips, hint }: { kicker: string; title: string; chips: { ok: boolean; text: string; tone?: "lime" }[]; hint?: string | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex flex-col items-center gap-3 px-6">
      <div className="max-w-[1000px] rounded-2xl border border-magenta/40 bg-navy/90 px-6 py-3 text-center">
        <div className="text-sm text-muted">{kicker}</div>
        <div className="font-display text-2xl">{title}</div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {chips.map((c) => (
          <span key={c.text} className={`rounded-full border bg-navy/85 px-3 py-1 ${c.tone === "lime" ? "border-lime/60 text-lime" : c.ok ? "border-cyan/60 text-text" : "border-line text-muted"}`}>
            {c.ok ? "✓ " : "· "}{c.text}
          </span>
        ))}
      </div>
      {hint && <div className="rounded-full border border-violet/50 bg-navy/85 px-5 py-2 text-lg">{hint}</div>}
    </div>
  );
}

/** Bottom labels: one per item, with its key and amount; a click (or dwell) pours one step. */
export function ItemLabels({ items, onPick }: { items: BenchItem[]; onPick: (it: BenchItem) => void }) {
  const amounts = useBench((s) => s.amounts);
  const allowed = useBench((s) => s.allowed);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[3vh] z-20 flex justify-center gap-3 px-[12vw]">
      {items.map((it, i) => (
        <ItemLabel key={it.id} it={it} n={i + 1} amount={amounts[it.id] ?? 0} onPick={onPick} state={!allowed ? "free" : allowed.includes(it.id) ? "now" : "locked"} />
      ))}
    </div>
  );
}

function ItemLabel({ it, n, amount, onPick, state }: { it: BenchItem; n: number; amount: number; onPick: (it: BenchItem) => void; state: "free" | "now" | "locked" }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `bench:${it.id}`;
  const full = amount >= it.limit - 1e-6;
  const mouse = useTarget(id, ref, !full && state !== "locked");
  useEffect(
    () =>
      subscribe("dwell", (e) => {
        if (e.targetId === id && e.source !== "gesture") onPick(it);
      }),
    [id, it, onPick],
  );
  return (
    <div ref={ref} {...mouse} role="button"
      className={`pointer-events-auto w-[190px] rounded-xl border bg-navy/85 px-3 py-2 text-center transition-all ${
        state === "now" ? "scale-105 cursor-pointer border-2 border-lime shadow-[0_0_18px_rgba(163,230,53,0.45)]" : state === "locked" ? "cursor-not-allowed border-line opacity-45" : full ? "border-lime/60 opacity-70" : "cursor-pointer border-line"
      }`}>
      {it.formula ? <ChemText text={it.formula} className="block font-display text-lg" /> : <span className="block font-display text-lg" style={{ color: it.color }}>●</span>}
      <span className="text-sm text-muted">{it.name}</span>
      <span className={`block text-xs ${state === "now" ? "font-semibold text-lime" : "text-muted"}`}>
        {state === "locked" ? (amount > 0 ? `✓ ${it.unit(amount)}` : "🔒 later step") : state === "now" ? `← do this now · key ${n} · ${it.unit(amount)}` : full ? "✓ all used" : `${n} · or click · ${it.unit(amount)}`}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- Guided steps

/** One step of a guided experiment. `item` (+ optional `target`) is the only thing usable during it; a step
 *  with no item is a "watch" step that finishes when `done` sees what happened (amounts or scene flags). */
export type Step = { text: string; item?: string; target?: number; why: string; done: (b: BState) => boolean };

/** The current step = the first one not done. Gates the bench to that step's item (and target). */
export function useGuide(steps: Step[]) {
  const b = useBench();
  const found = steps.findIndex((s) => !s.done(b));
  const current = found === -1 ? steps.length : found;
  useEffect(() => {
    const s = steps[current];
    useBench.setState({
      allowed: s ? (s.item ? [s.item] : []) : null, // all done: free play (pour more, bigger reaction)
      lock: s?.item !== undefined && s.target !== undefined ? { [s.item]: s.target } : null,
    });
  }, [current, b.run, steps]);
  return { current, finished: current >= steps.length, total: steps.length };
}

/** Left panel: the numbered steps, current one highlighted, finished ones ticked with their "why". */
export function GuidePanel({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div className="pointer-events-none absolute left-4 top-[9.5rem] z-30 w-[min(330px,28vw)] rounded-2xl border border-cyan/40 bg-navy/90 p-3 shadow-xl">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted">{current >= steps.length ? "✓ All steps done" : `Step ${current + 1} of ${steps.length}`}</div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s, i) => {
          const done = i < current, now = i === current;
          return (
            <li key={s.text} className={`flex gap-2 rounded-xl px-2 py-1.5 ${now ? "bg-lime/15 ring-2 ring-lime" : ""}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-lime text-navy" : now ? "bg-cyan text-navy" : "bg-panel text-muted"}`}>{done ? "✓" : i + 1}</span>
              <div className={done ? "text-text" : now ? "text-text" : "text-muted"}>
                <div className={`leading-snug ${now ? "font-semibold" : ""}`}>{s.text}</div>
                {done && <div className="text-xs leading-snug text-lime/90">{s.why}</div>}
                {now && !s.item && <div className="text-xs text-cyan">👀 watch the bench…</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The explanation card with Again / Next. */
export function ResultCard({ title, equation, why, numbers, onNext, recap, nextLabel = "Experiments ▶" }: { title: string; equation?: string; why: string[]; numbers?: ReactNode; onNext: () => void; recap?: Step[]; nextLabel?: string }) {
  useEffect(() => {
    const offs = [
      subscribe("dwell", (e) => {
        if (e.targetId === "exp:again") resetBench();
        if (e.targetId === "exp:next") onNext();
      }),
      subscribe("bothUp", () => onNext()),
    ];
    return () => offs.forEach((o) => o());
  }, [onNext]);
  return (
    <div className="absolute right-4 top-[13vh] z-50 w-[min(560px,46vw)] animate-[slidein_0.5s_ease-out]">
      <style>{`@keyframes slidein { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }`}</style>
      <div className="flex max-h-[calc(87vh-140px)] flex-col gap-2 overflow-y-auto rounded-3xl border border-lime/50 bg-navy/95 p-4 shadow-2xl">
        <div className="font-display text-xl text-lime">✓ {title}</div>
        <div className="grid grid-cols-2 gap-3">
          <Btn id="exp:again" title="↺ Again" sub="R · from step 1" />
          <Btn id="exp:next" title={nextLabel} sub="✊ / Enter / both hands up" />
        </div>
        {recap && (
          <div className="rounded-xl border border-cyan/30 bg-panel px-3 py-2">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted">What you did, step by step</div>
            <ol className="flex flex-col gap-1 text-sm">
              {recap.map((s, i) => (
                <li key={s.text}><b className="text-cyan">{i + 1}.</b> {s.text} <span className="text-muted">→ {s.why}</span></li>
              ))}
            </ol>
          </div>
        )}
        <div className="text-xs uppercase tracking-wider text-muted">The science</div>
        {equation && <div className="rounded-xl bg-panel px-3 py-1.5 font-display text-lg"><ChemText text={equation} /></div>}
        <ul className="list-disc pl-5 text-base leading-snug text-text">
          {why.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        {numbers && (
          <div className="rounded-xl border border-line bg-panel px-3 py-2 text-sm">
            {numbers}
            <div className="mt-1 text-xs text-muted">Every number here is computed by code from the balanced equation and what you added.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ id, title, sub }: { id: string; title: string; sub: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref);
  return (
    <div ref={ref} {...mouse} role="button" className="pointer-events-auto grid h-[72px] cursor-pointer place-items-center rounded-2xl border-2 border-lime/70 text-center text-lime">
      <span className="font-display text-xl">{title}</span>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
}

/** Shows the result card a moment after the reaction starts (watch first), and again after each reset. */
export function useDelayedCard(active: boolean, ms = 3000) {
  const run = useBench((s) => s.run);
  const [shownRun, setShownRun] = useState(-1);
  useEffect(() => {
    if (!active) return;
    const r = run;
    const id = setTimeout(() => setShownRun(r), ms);
    return () => clearTimeout(id);
  }, [active, run, ms]);
  return active && shownRun === run;
}
