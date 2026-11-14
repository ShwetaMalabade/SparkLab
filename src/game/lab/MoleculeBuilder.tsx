"use client";
// src/game/lab/MoleculeBuilder.tsx: "What is the formula of water?" — atoms float around you; close your palm (✊)
// on one to grab it, carry it into the glowing build ring and open your hand to drop it. Code checks every atom
// (src/game/molecules.ts): a wrong element flashes red and says why; too many says so; the right set snaps into
// the real molecule shape. Twins: point-hold / fist / click the atom buttons, keys 1–4, Backspace = undo, Enter = next.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { CanvasTexture, Color, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3 } from "three";
import { useTarget } from "@/motion/targets";
import type { Side } from "@/motion/types";
import { Confetti } from "@/three/effects/Confetti";
import { CPK } from "../ChemText";
import { addAtom, ELEMENT_NAME, moleculeLayout, targetCounts, type Counts, type MoleculeQuestion } from "../molecules";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";

// ---------------------------------------------------------------- state

type Tone = "info" | "bad" | "good";
type BState = { counts: Counts; built: string[]; message: string; tone: Tone; done: boolean; wrong: number; atomsVersion: number };
export const useBuilder = create<BState>(() => ({ counts: {}, built: [], message: "", tone: "info", done: false, wrong: 0, atomsVersion: 0 }));

/** Floating atoms (mutable, read every frame). */
type Atom = { id: number; el: string; home: Vector3; pos: Vector3; held: Side | null; flashUntil: number; phase: number };
const ATOMS: Atom[] = [];
/** Latest screen position of each floating atom + the build ring (for grabbing by cursor). */
const SCREEN = new Map<number, { x: number; y: number }>();
const ZONE = { x: 0, y: 0, r: 130 };
const ZONE_POS = new Vector3(0, 0.55, 0.9);

function spawnAtoms(palette: string[]) {
  ATOMS.length = 0;
  SCREEN.clear();
  let id = 0;
  // 3 of each element, spread on a wide arc around the student.
  const all = palette.flatMap((el) => [el, el, el]);
  all.forEach((el, i) => {
    const a = -Math.PI * 0.95 + (i / (all.length - 1)) * Math.PI * 0.9;
    const home = new Vector3(Math.cos(a) * 3.2, 1.2 + (i % 3) * 0.55, 0.3 + Math.sin(a) * 0.9 + 0.9);
    ATOMS.push({ id: id++, el, home, pos: home.clone(), held: null, flashUntil: 0, phase: i * 0.7 });
  });
  useBuilder.setState((s) => ({ atomsVersion: s.atomsVersion + 1 }));
}

function tryAdd(q: MoleculeQuestion, el: string) {
  const st = useBuilder.getState();
  if (st.done) return false;
  const r = addAtom(q, st.counts, el);
  if (!r.ok) {
    useBuilder.setState({ message: r.message, tone: "bad", wrong: st.wrong + 1 });
    playSfx("wrong", 0.5);
    return false;
  }
  useBuilder.setState({ counts: r.counts, built: [...st.built, el], message: r.message, tone: r.done ? "good" : "info", done: r.done });
  playSfx(r.done ? "correct" : "pop", r.done ? 0.7 : 0.4);
  return true;
}

function undo(q: MoleculeQuestion) {
  const st = useBuilder.getState();
  if (st.done || !st.built.length) return;
  const el = st.built[st.built.length - 1];
  const counts = { ...st.counts, [el]: (st.counts[el] ?? 1) - 1 };
  useBuilder.setState({ counts, built: st.built.slice(0, -1), message: `Took one ${ELEMENT_NAME[el] ?? el} back out.`, tone: "info" });
  void q;
}

// ---------------------------------------------------------------- DOM overlay

export function BuilderOverlay({ q, onNext, index, total }: { q: MoleculeQuestion; onNext: () => void; index: number; total: number }) {
  const { counts, message, tone, done } = useBuilder();
  const target = useMemo(() => targetCounts(q.formula), [q.formula]);

  useEffect(() => {
    useBuilder.setState({ counts: {}, built: [], message: "Close your hand on an atom to grab it, then drop it in the glowing ring.", tone: "info", done: false, wrong: 0 });
    spawnAtoms(q.palette);
  }, [q]);

  // Atom buttons (point-hold / fist / click / keys), undo, next.
  useEffect(() => {
    const offs = [
      subscribe("dwell", (e) => {
        const id = e.targetId ?? "";
        if (id.startsWith("mol:add:")) tryAdd(q, id.slice(8));
        if (id === "mol:undo") undo(q);
        if (id === "mol:next" && useBuilder.getState().done) onNext();
      }),
      subscribe("command", (e) => {
        if (e.cmd === "pick" && e.value !== undefined && q.palette[e.value]) tryAdd(q, q.palette[e.value]);
      }),
      subscribe("bothUp", () => useBuilder.getState().done && onNext()),
    ];
    const key = (e: KeyboardEvent) => e.key === "Backspace" && undo(q);
    window.addEventListener("keydown", key);
    return () => {
      offs.forEach((o) => o());
      window.removeEventListener("keydown", key);
    };
  }, [q, onNext]);

  const toneCls = tone === "bad" ? "border-coral/70 text-coral" : tone === "good" ? "border-lime/70 text-lime" : "border-violet/50 text-text";
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex flex-col items-center gap-3 px-6">
        <div className="rounded-2xl border border-magenta/40 bg-navy/90 px-6 py-3 text-center">
          <div className="text-sm text-muted">Molecule {index + 1} of {total} · build it with your hands</div>
          <div className="font-display text-3xl">{q.prompt}</div>
        </div>
        {/* Live atom count, computed by code */}
        <div className="flex gap-2">
          {Object.keys(target).map((el) => {
            const have = counts[el] ?? 0;
            const full = have === target[el];
            return (
              <span key={el} className={`rounded-full border px-4 py-1 font-display text-2xl tabular-nums ${full ? "border-lime/70 text-lime" : "border-line text-text"} bg-navy/85`}>
                <b style={{ color: CPK[el] ?? "#fff" }}>{el}</b> {have} / {target[el]}
              </span>
            );
          })}
        </div>
        <div className={`max-w-[900px] rounded-full border bg-navy/90 px-5 py-2 text-center text-xl ${toneCls}`}>{tone === "bad" ? "✗ " : tone === "good" ? "✓ " : ""}{message}</div>
        {done && <div className="max-w-[800px] rounded-xl bg-navy/85 px-4 py-2 text-center text-lg text-muted">{q.fact}</div>}
      </div>

      {/* Atom buttons (left column) + undo / next (right column): the centre stays clear for the drop ring */}
      <div className="pointer-events-none absolute left-4 top-[22vh] z-30 grid grid-cols-2 gap-3">
        {q.palette.map((el, i) => (
          <AtomButton key={el} el={el} n={i + 1} disabled={done} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-4 top-[30vh] z-30 flex flex-col gap-3">
        <Btn id="mol:undo" label="↶ Undo" sub="Backspace" disabled={done} />
        {done && <Btn id="mol:next" label="Next ▶" sub="Enter / both hands up" accent />}
      </div>
    </>
  );
}

function AtomButton({ el, n, disabled }: { el: string; n: number; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(`mol:add:${el}`, ref, !disabled);
  const over = useGame((s) => s.cursors.left.targetId === `mol:add:${el}` || s.cursors.right.targetId === `mol:add:${el}`);
  return (
    <div ref={ref} {...mouse} role="button" aria-label={`Add ${ELEMENT_NAME[el] ?? el}`}
      className={`pointer-events-auto flex h-[150px] w-[160px] cursor-pointer select-none flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-navy/85 ${over ? "border-magenta bg-magenta/10" : "border-line"} ${disabled ? "opacity-40" : ""}`}>
      <span className="grid h-14 w-14 place-items-center rounded-full font-display text-2xl font-bold text-navy" style={{ background: CPK[el] ?? "#9CA3AF" }}>{el}</span>
      <span className="text-sm text-muted">{ELEMENT_NAME[el] ?? el} · {n}</span>
    </div>
  );
}

function Btn({ id, label, sub, disabled, accent }: { id: string; label: string; sub: string; disabled?: boolean; accent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref, !disabled);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  return (
    <div ref={ref} {...mouse} role="button"
      className={`pointer-events-auto flex h-[130px] w-[160px] cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-2 bg-navy/85 ${accent ? "border-lime/70 text-lime" : over ? "border-cyan" : "border-line"} ${disabled ? "opacity-40" : ""}`}>
      <span className="font-display text-2xl">{label}</span>
      <span className="text-xs text-muted">{sub}</span>
    </div>
  );
}

// ---------------------------------------------------------------- 3D scene

const ndc = new Vector3();
function cursorToWorld(x: number, y: number, w: number, h: number, camera: { position: Vector3 } & Parameters<Vector3["unproject"]>[0], z: number, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(dir, (z - camera.position.z) / dir.z);
}

const labelCache = new Map<string, CanvasTexture>();
function labelTex(el: string) {
  const hit = labelCache.get(el);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "bold 72px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 8;
  g.strokeStyle = "#0B1020";
  g.strokeText(el, 64, 68);
  g.fillStyle = "#FFFFFF";
  g.fillText(el, 64, 68);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  labelCache.set(el, t);
  return t;
}

export function BuilderScene({ q }: { q: MoleculeQuestion }) {
  const { camera, size } = useThree();
  const groups = useRef<(Group | null)[]>([]);
  const tmp = useMemo(() => new Vector3(), []);
  const done = useBuilder((s) => s.done);
  const built = useBuilder((s) => s.built);
  const version = useBuilder((s) => s.atomsVersion); // re-render when atoms are re-spawned

  // Grab with a fist on a floating atom; open the hand to drop it.
  useEffect(() => {
    const offs = [
      subscribe("grab", (e) => {
        if (!e.side || useBuilder.getState().done) return;
        const c = useGame.getState().cursors[e.side];
        if (!c.visible) return;
        let best: Atom | null = null, bestD = 95;
        for (const a of ATOMS) {
          const p = SCREEN.get(a.id);
          if (!p || a.held) continue;
          const dd = Math.hypot(p.x - c.x, p.y - c.y);
          if (dd < bestD) {
            bestD = dd;
            best = a;
          }
        }
        if (best) {
          best.held = e.side;
          playSfx("pop", 0.25);
        }
      }),
      subscribe("release", (e) => {
        const a = ATOMS.find((x) => x.held === e.side);
        if (!a) return;
        a.held = null;
        const p = SCREEN.get(a.id);
        if (p && Math.hypot(p.x - ZONE.x, p.y - ZONE.y) < ZONE.r) {
          if (tryAdd(q, a.el)) a.pos.copy(a.home).add(new Vector3(0, 3, 0)); // used: re-spawn from above
          else a.flashUntil = performance.now() + 1200; // wrong: flash red and float back
        }
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [q]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    // Build ring on screen (for the drop test).
    tmp.copy(ZONE_POS).project(camera);
    ZONE.x = ((tmp.x + 1) / 2) * size.width;
    ZONE.y = ((1 - tmp.y) / 2) * size.height;
    const cursors = useGame.getState().cursors;
    ATOMS.forEach((a, i) => {
      const g = groups.current[i];
      if (a.held) {
        const c = cursors[a.held];
        if (c.visible) cursorToWorld(c.x, c.y, size.width, size.height, camera as never, 1.2, tmp);
        a.pos.lerp(tmp, Math.min(1, dt * 14));
      } else {
        tmp.copy(a.home).add(new Vector3(Math.sin(t * 0.6 + a.phase) * 0.12, Math.sin(t * 0.9 + a.phase) * 0.12, 0));
        a.pos.lerp(tmp, Math.min(1, dt * 2.5));
      }
      if (g) {
        g.position.copy(a.pos);
        const flash = performance.now() < a.flashUntil;
        const m = (g.children[0] as Mesh).material as MeshStandardMaterial;
        m.emissive.set(flash ? "#FF2D55" : a.held ? "#FFFFFF" : CPK[a.el] ?? "#9CA3AF");
        m.emissiveIntensity = flash ? 0.9 + Math.sin(t * 30) * 0.3 : a.held ? 0.45 : 0.15;
        g.scale.setScalar(a.held ? 1.25 : 1);
      }
      tmp.copy(a.pos).project(camera);
      SCREEN.set(a.id, { x: ((tmp.x + 1) / 2) * size.width, y: ((1 - tmp.y) / 2) * size.height });
    });
  });

  return (
    <group>
      {/* Bench */}
      <mesh position={[0, -0.05, 0.6]} receiveShadow>
        <boxGeometry args={[9, 0.1, 2.4]} />
        <meshStandardMaterial color="#E5E7EB" roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.52, 0.65]}>
        <boxGeometry args={[8.8, 0.85, 2.2]} />
        <meshStandardMaterial color="#E9DCC6" roughness={0.8} />
      </mesh>
      <BuildRing done={done} />
      {/* Floating atoms */}
      {ATOMS.map((a, i) => (
        <group key={`${version}-${a.id}`} ref={(el) => void (groups.current[i] = el)}>
          <mesh>
            <sphereGeometry args={[a.el === "H" ? 0.22 : 0.3, 28, 22]} />
            <meshStandardMaterial color={CPK[a.el] ?? "#9CA3AF"} roughness={0.3} metalness={0.05} emissive={CPK[a.el] ?? "#9CA3AF"} emissiveIntensity={0.15} />
          </mesh>
          <sprite position={[0, 0, 0.36]} scale={[0.36, 0.36, 1]}>
            <spriteMaterial map={labelTex(a.el)} depthTest={false} transparent />
          </sprite>
        </group>
      ))}
      <Built q={q} built={built} done={done} />
      {done && <Confetti key={`c-${q.id}`} position={[ZONE_POS.x, ZONE_POS.y + 0.6, ZONE_POS.z]} />}
    </group>
  );
}

function BuildRing({ done }: { done: boolean }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.05;
    ring.current.scale.set(s, s, 1);
    (ring.current.material as MeshStandardMaterial).color = new Color(done ? "#A3E635" : "#E879F9");
  });
  return (
    <mesh ref={ring} position={[ZONE_POS.x, 0.02, ZONE_POS.z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.6, 0.78, 48]} />
      <meshStandardMaterial color="#E879F9" emissive="#E879F9" emissiveIntensity={0.8} transparent opacity={0.9} />
    </mesh>
  );
}

/** The atoms already dropped in: a loose cluster while building; the real molecule shape when done. */
function Built({ q, built, done }: { q: MoleculeQuestion; built: string[]; done: boolean }) {
  const spin = useRef<Group>(null);
  const layout = useMemo(() => moleculeLayout(q.formula), [q.formula]);
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += Math.min(dt, 0.05) * (done ? 0.9 : 0.3);
  });
  // While building: place each dropped atom at the matching layout slot (so it "grows" into the molecule).
  const slots = useMemo(() => {
    const used = new Set<number>();
    return built.map((el) => {
      const i = layout.findIndex((s, k) => s.el === el && !used.has(k));
      used.add(i);
      return { el, at: layout[Math.max(0, i)].at };
    });
  }, [built, layout]);
  const k = 0.9;
  return (
    <group ref={spin} position={[ZONE_POS.x, ZONE_POS.y + 0.25, ZONE_POS.z]}>
      {done &&
        slots.slice(1).map((s, j) => {
          // Bond each atom to its nearest heavy (non-H) atom: works for H2O, CH4 and chains like C2H6 / CH3OH.
          const i = j + 1;
          const me = new Vector3(...s.at).multiplyScalar(k);
          let best = new Vector3(...slots[0].at).multiplyScalar(k), bd = Infinity;
          slots.forEach((o, n) => {
            if (n === i || o.el === "H" || (s.el !== "H" && n > i)) return;
            const p = new Vector3(...o.at).multiplyScalar(k);
            const d = p.distanceTo(me);
            if (d < bd) {
              bd = d;
              best = p;
            }
          });
          const dir = me.clone().sub(best);
          const q4 = new Group().quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
          return (
            <mesh key={`b${j}`} position={best.clone().add(me).multiplyScalar(0.5)} quaternion={q4}>
              <cylinderGeometry args={[0.05, 0.05, dir.length(), 10]} />
              <meshStandardMaterial color="#CBD5E1" />
            </mesh>
          );
        })}
      {slots.map((s, i) => (
        <mesh key={i} position={new Vector3(...s.at).multiplyScalar(done ? k : k * 1.25)}>
          <sphereGeometry args={[s.el === "H" ? 0.2 : 0.28, 28, 22]} />
          <meshStandardMaterial color={CPK[s.el] ?? "#9CA3AF"} roughness={0.3} emissive={CPK[s.el] ?? "#9CA3AF"} emissiveIntensity={done ? 0.35 : 0.15} />
        </mesh>
      ))}
    </group>
  );
}
