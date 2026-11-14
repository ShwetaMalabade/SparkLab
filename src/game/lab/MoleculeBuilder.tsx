"use client";
// src/game/lab/MoleculeBuilder.tsx: build a molecule by bonding pieces, like real chemistry.
// Atoms float around you, each labelled. ✊ close a hand on a piece to hold it; bring two pieces together (one in
// each hand, a "clap", or carry one into another) and they BOND: H + H → H₂, then H₂ + O → H₂O. Open your hand to
// put a piece down: it stays there, so you can work on several pieces. A bond that can't be part of the answer
// (carbon in water, a 3rd hydrogen) flashes red, pushes apart and says why. Rules: src/game/molecules.ts (tested).
// Twins: mouse drag a piece onto another · keys 1–4 / atom buttons add to the piece on the bench · Backspace undo.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { CanvasTexture, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector3 } from "three";
import { useTarget } from "@/motion/targets";
import type { Side } from "@/motion/types";
import { Confetti } from "@/three/effects/Confetti";
import { CPK } from "../ChemText";
import { ELEMENT_NAME, mergePieces, moleculeLayout, pieceFormula, subscript, targetCounts, type Counts, type MoleculeQuestion } from "../molecules";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";

// ---------------------------------------------------------------- state

type Tone = "info" | "bad" | "good";
type Holder = Side | "mouse";
type Piece = { id: number; counts: Counts; pos: Vector3; held: Holder | null; flashUntil: number; phase: number; bench: boolean };
type BState = { message: string; tone: Tone; done: boolean; wrong: number; version: number; best: Counts; doneId: number | null };
export const useBuilder = create<BState>(() => ({ message: "", tone: "info", done: false, wrong: 0, version: 0, best: {}, doneId: null }));

const PIECES: Piece[] = [];
let nextId = 0;
const SCREEN = new Map<number, { x: number; y: number }>();
const MOUSE = { x: 0, y: 0, down: false };
const BENCH = new Vector3(0, 0.75, 0.9);
const BOND_DIST = 0.62; // world units between piece centres to bond
const cooldown = new Map<string, number>();

const bump = () => useBuilder.setState((s) => ({ version: s.version + 1 }));
const size = (c: Counts) => Object.values(c).reduce((a, b) => a + b, 0);

function spawn(q: MoleculeQuestion) {
  PIECES.length = 0;
  SCREEN.clear();
  cooldown.clear();
  const all = q.palette.flatMap((el) => [el, el, el]);
  all.forEach((el, i) => {
    const a = -Math.PI * 0.95 + (i / (all.length - 1)) * Math.PI * 0.9;
    PIECES.push({ id: nextId++, counts: { [el]: 1 }, pos: new Vector3(Math.cos(a) * 3.1, 1.25 + (i % 3) * 0.5, 1.2 + Math.sin(a) * 0.6), held: null, flashUntil: 0, phase: i * 0.7, bench: false });
  });
  bump();
}

function updateBest(q: MoleculeQuestion) {
  const target = targetCounts(q.formula);
  const best = PIECES.filter((p) => Object.keys(p.counts).every((k) => target[k])).sort((a, b) => size(b.counts) - size(a.counts))[0];
  useBuilder.setState({ best: best ? { ...best.counts } : {} });
}

/** Bond piece b INTO piece a. Returns true if it bonded. */
function bond(q: MoleculeQuestion, a: Piece, b: Piece) {
  const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
  const now = performance.now();
  if ((cooldown.get(key) ?? 0) > now) return false;
  cooldown.set(key, now + 900);
  const r = mergePieces(q, a.counts, b.counts);
  if (!r.ok) {
    a.flashUntil = b.flashUntil = now + 1100;
    const away = b.pos.clone().sub(a.pos).setY(0);
    if (away.lengthSq() < 1e-4) away.set(1, 0, 0);
    if (!b.held) b.pos.add(away.normalize().multiplyScalar(0.9)); // push apart so they stop touching
    useBuilder.setState((s) => ({ message: r.message, tone: "bad", wrong: s.wrong + 1 }));
    playSfx("wrong", 0.5);
    return false;
  }
  a.counts = r.counts;
  a.pos.lerp(b.pos, 0.5);
  a.bench = a.bench || b.bench;
  if (b.held && !a.held) a.held = b.held;
  PIECES.splice(PIECES.indexOf(b), 1);
  SCREEN.delete(b.id);
  useBuilder.setState({ message: r.message, tone: r.done ? "good" : "info", done: r.done, doneId: r.done ? a.id : null });
  playSfx(r.done ? "correct" : "pop", r.done ? 0.7 : 0.45);
  if (r.done) PIECES.forEach((p) => (p.held = null));
  updateBest(q);
  bump();
  return true;
}

/** Keyboard / buttons: add one atom to the piece on the bench (made if missing). */
function addToBench(q: MoleculeQuestion, el: string) {
  if (useBuilder.getState().done) return;
  const atom: Piece = { id: nextId++, counts: { [el]: 1 }, pos: BENCH.clone().add(new Vector3(0, 0.8, 0)), held: null, flashUntil: 0, phase: 0, bench: false };
  const bench = PIECES.find((p) => p.bench);
  if (!bench) {
    atom.bench = true;
    atom.pos.copy(BENCH);
    PIECES.push(atom);
    useBuilder.setState({ message: `${subscript(el)} is on the bench. Add more atoms to bond them.`, tone: "info" });
    playSfx("pop", 0.4);
    updateBest(q);
    return bump();
  }
  PIECES.push(atom);
  if (!bond(q, bench, atom)) {
    PIECES.splice(PIECES.indexOf(atom), 1);
    bump();
  }
}

function undoBench(q: MoleculeQuestion) {
  const bench = PIECES.find((p) => p.bench);
  if (!bench || useBuilder.getState().done) return;
  const els = Object.keys(bench.counts).filter((k) => bench.counts[k] > 0);
  const el = els[els.length - 1];
  bench.counts = { ...bench.counts, [el]: bench.counts[el] - 1 };
  if (!size(bench.counts)) PIECES.splice(PIECES.indexOf(bench), 1);
  useBuilder.setState({ message: `Took one ${ELEMENT_NAME[el] ?? el} off the bench.`, tone: "info" });
  updateBest(q);
  bump();
}

// ---------------------------------------------------------------- DOM overlay

export function BuilderOverlay({ q, onNext, index, total }: { q: MoleculeQuestion; onNext: () => void; index: number; total: number }) {
  const { message, tone, done, best } = useBuilder();
  const target = useMemo(() => targetCounts(q.formula), [q.formula]);

  useEffect(() => {
    useBuilder.setState({ message: "✊ Grab an atom with each hand and bring them together to bond them.", tone: "info", done: false, wrong: 0, best: {}, doneId: null });
    spawn(q);
  }, [q]);

  useEffect(() => {
    const offs = [
      subscribe("dwell", (e) => {
        const id = e.targetId ?? "";
        if (id.startsWith("mol:add:")) addToBench(q, id.slice(8));
        if (id === "mol:undo") undoBench(q);
        if (id === "mol:next" && useBuilder.getState().done) onNext();
      }),
      subscribe("command", (e) => {
        if (e.cmd === "pick" && e.value !== undefined && q.palette[e.value]) addToBench(q, q.palette[e.value]);
      }),
      subscribe("bothUp", () => useBuilder.getState().done && onNext()),
    ];
    const key = (e: KeyboardEvent) => e.key === "Backspace" && undoBench(q);
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
          <div className="text-sm text-muted">Molecule {index + 1} of {total} · bond the atoms with your hands</div>
          <div className="font-display text-3xl">{q.prompt}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">biggest piece:</span>
          {Object.keys(target).map((el) => {
            const have = best[el] ?? 0;
            const full = have === target[el];
            return (
              <span key={el} className={`rounded-full border px-4 py-1 font-display text-2xl tabular-nums ${full ? "border-lime/70 text-lime" : "border-line text-text"} bg-navy/85`}>
                <b style={{ color: CPK[el] ?? "#fff" }}>{el}</b> {have} / {target[el]}
              </span>
            );
          })}
        </div>
        <div className={`max-w-[900px] rounded-full border bg-navy/90 px-5 py-2 text-center text-xl ${toneCls}`}>
          {tone === "bad" ? "✗ " : tone === "good" ? "✓ " : ""}
          {message}
        </div>
        {done && <div className="max-w-[800px] rounded-xl bg-navy/85 px-4 py-2 text-center text-lg text-muted">{q.fact}</div>}
      </div>

      <div className="pointer-events-none absolute left-4 top-[22vh] z-30 grid grid-cols-2 gap-3">
        {q.palette.map((el, i) => (
          <AtomButton key={el} el={el} n={i + 1} disabled={done} />
        ))}
      </div>
      <div className="pointer-events-none absolute right-4 top-[30vh] z-30 flex flex-col gap-3">
        <Btn id="mol:undo" label="↶ Undo" sub="Backspace" disabled={done} />
        {done && <Btn id="mol:next" label="Next ▶" sub="Enter / both hands up" accent />}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-navy/80 px-4 py-1 text-sm text-muted">
        ✊ hold a piece · bring two together to bond · ✋ open to put it down · mouse: drag one onto another · keys 1–4 add to the bench
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

// ---------------------------------------------------------------- 3D

const ndc = new Vector3();
function toWorld(x: number, y: number, w: number, h: number, camera: never, z: number, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const cam = (camera as unknown as { position: Vector3 }).position;
  const dir = ndc.sub(cam).normalize();
  return out.copy(cam).addScaledVector(dir, (z - cam.z) / dir.z);
}

const labelCache = new Map<string, CanvasTexture>();
function labelTex(text: string) {
  const hit = labelCache.get(text);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "bold 80px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 12;
  g.strokeStyle = "#0B1020";
  g.strokeText(text, 128, 66);
  g.fillStyle = "#FFFFFF";
  g.fillText(text, 128, 66);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  labelCache.set(text, t);
  return t;
}

/** Where each atom of a (partial) piece sits around its centre; the finished molecule uses its real shape. */
function clusterLayout(counts: Counts, q: MoleculeQuestion, done: boolean): { el: string; at: [number, number, number] }[] {
  if (done) return moleculeLayout(q.formula).map((a) => ({ el: a.el, at: [a.at[0] * 0.9, a.at[1] * 0.9, a.at[2] * 0.9] as [number, number, number] }));
  const atoms = Object.keys(counts).flatMap((k) => Array.from({ length: counts[k] }, () => k));
  atoms.sort((a, b) => (a === "H" ? 1 : 0) - (b === "H" ? 1 : 0)); // heavy atoms in the middle, H around
  const n = atoms.length;
  if (n === 1) return [{ el: atoms[0], at: [0, 0, 0] }];
  if (n === 2) return [{ el: atoms[0], at: [-0.21, 0, 0] }, { el: atoms[1], at: [0.21, 0, 0] }];
  return atoms.map((el, i) => ({ el, at: i === 0 ? [0, 0, 0] : [Math.cos((i / (n - 1)) * Math.PI * 2) * 0.36, Math.sin((i / (n - 1)) * Math.PI * 2) * 0.36, 0.05] }));
}

export function BuilderScene({ q }: { q: MoleculeQuestion }) {
  const { camera, size: view, gl } = useThree();
  const groups = useRef(new Map<number, Group>());
  const tmp = useMemo(() => new Vector3(), []);
  const version = useBuilder((s) => s.version);
  const done = useBuilder((s) => s.done);
  const doneId = useBuilder((s) => s.doneId);

  // Hands: ✊ grabs the nearest piece; ✋ puts it down where it is. Mouse: drag a piece onto another.
  useEffect(() => {
    const grab = (holder: Holder, x: number, y: number, radius: number) => {
      if (useBuilder.getState().done) return;
      let best: Piece | null = null, bd = radius;
      for (const p of PIECES) {
        const s = SCREEN.get(p.id);
        if (!s || p.held) continue;
        const d = Math.hypot(s.x - x, s.y - y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) {
        best.held = holder;
        best.bench = false;
        playSfx("pop", 0.25);
      }
    };
    const release = (holder: Holder) => PIECES.forEach((p) => p.held === holder && (p.held = null));
    const offs = [
      subscribe("grab", (e) => {
        if (!e.side) return;
        const c = useGame.getState().cursors[e.side];
        if (c.visible) grab(e.side, c.x, c.y, 115);
      }),
      subscribe("release", (e) => e.side && release(e.side)),
    ];
    const el = gl.domElement;
    const rel = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      MOUSE.x = e.clientX - r.left;
      MOUSE.y = e.clientY - r.top;
    };
    const down = (e: PointerEvent) => {
      rel(e);
      MOUSE.down = true;
      grab("mouse", MOUSE.x, MOUSE.y, 80);
    };
    const up = () => {
      MOUSE.down = false;
      release("mouse");
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", rel);
    window.addEventListener("pointerup", up);
    return () => {
      offs.forEach((o) => o());
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", rel);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const cursors = useGame.getState().cursors;
    const { done: doneNow, doneId: did } = useBuilder.getState();
    for (const p of PIECES) {
      if (doneNow && p.id === did) p.pos.lerp(tmp.copy(BENCH).setY(1.1), Math.min(1, dt * 3));
      else if (p.held) {
        let x = MOUSE.x, y = MOUSE.y, ok = MOUSE.down;
        if (p.held !== "mouse") {
          const c = cursors[p.held];
          x = c.x;
          y = c.y;
          ok = c.visible;
        }
        if (ok) p.pos.lerp(toWorld(x, y, view.width, view.height, camera as never, 1.2, new Vector3()), Math.min(1, dt * 14));
      } else if (!p.bench) p.pos.y += Math.sin(t * 0.9 + p.phase) * 0.0015; // gentle float where you left it
      const g = groups.current.get(p.id);
      if (g) {
        g.position.copy(p.pos);
        const flash = performance.now() < p.flashUntil;
        g.traverse((o) => {
          if (o instanceof Mesh && o.userData.atom) {
            const m = o.material as MeshStandardMaterial;
            m.emissive.set(flash ? "#FF2D55" : p.held ? "#FFFFFF" : o.userData.color);
            m.emissiveIntensity = flash ? 0.9 + Math.sin(t * 30) * 0.3 : p.held ? 0.4 : 0.15;
          }
        });
        g.scale.setScalar(p.held ? 1.15 : 1);
        if (doneNow && p.id === did) g.rotation.y += dt * 0.9;
      }
      tmp.copy(p.pos).project(camera);
      SCREEN.set(p.id, { x: ((tmp.x + 1) / 2) * view.width, y: ((1 - tmp.y) / 2) * view.height });
    }
    // Bond: a held piece touching any other piece (both hands together = a "clap" bond).
    if (!doneNow) {
      for (const a of [...PIECES]) {
        if (!a.held || !PIECES.includes(a)) continue;
        for (const b of [...PIECES]) {
          if (a === b || !PIECES.includes(b)) continue;
          if (a.pos.distanceTo(b.pos) < BOND_DIST && bond(q, a, b)) break;
        }
      }
    }
  });

  const shown = done ? PIECES.filter((p) => p.id === doneId) : PIECES;
  return (
    <group>
      <mesh position={[0, -0.05, 0.6]} receiveShadow>
        <boxGeometry args={[9, 0.1, 2.4]} />
        <meshStandardMaterial color="#E5E7EB" roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.52, 0.65]}>
        <boxGeometry args={[8.8, 0.85, 2.2]} />
        <meshStandardMaterial color="#E9DCC6" roughness={0.8} />
      </mesh>
      <mesh position={[BENCH.x, 0.02, BENCH.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.55, 0.7, 48]} />
        <meshStandardMaterial color={done ? "#A3E635" : "#E879F9"} emissive={done ? "#A3E635" : "#E879F9"} emissiveIntensity={0.7} transparent opacity={0.8} />
      </mesh>
      {shown.map((p) => (
        <PieceView key={`${p.id}-${version}`} p={p} q={q} done={done && p.id === doneId} register={(g) => (g ? groups.current.set(p.id, g) : groups.current.delete(p.id))} />
      ))}
      {done && <Confetti key={`c-${q.id}`} position={[BENCH.x, BENCH.y + 0.8, BENCH.z]} />}
    </group>
  );
}

function PieceView({ p, q, done, register }: { p: Piece; q: MoleculeQuestion; done: boolean; register: (g: Group | null) => void }) {
  const atoms = useMemo(() => clusterLayout(p.counts, q, done), [p.counts, q, done]);
  const label = subscript(pieceFormula(p.counts, q.formula));
  const bonds = useMemo(() => {
    if (atoms.length < 2) return [];
    return atoms.slice(1).map((a, j) => {
      const i = j + 1;
      const me = new Vector3(...a.at);
      let best = new Vector3(...atoms[0].at), bd = Infinity;
      atoms.forEach((o, n) => {
        if (n === i || o.el === "H" || (a.el !== "H" && n > i)) return;
        const d = new Vector3(...o.at).distanceTo(me);
        if (d < bd) {
          bd = d;
          best = new Vector3(...o.at);
        }
      });
      const dir = me.clone().sub(best);
      return { mid: best.clone().add(me).multiplyScalar(0.5), len: dir.length(), q: new Group().quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()) };
    });
  }, [atoms]);
  return (
    <group ref={register} position={p.pos.toArray()}>
      {bonds.map((b, i) => (
        <mesh key={`b${i}`} position={b.mid} quaternion={b.q}>
          <cylinderGeometry args={[0.045, 0.045, b.len, 10]} />
          <meshStandardMaterial color="#CBD5E1" />
        </mesh>
      ))}
      {atoms.map((a, i) => (
        <mesh key={i} position={a.at} userData={{ atom: true, color: CPK[a.el] ?? "#9CA3AF" }}>
          <sphereGeometry args={[a.el === "H" ? 0.19 : 0.27, 26, 20]} />
          <meshStandardMaterial color={CPK[a.el] ?? "#9CA3AF"} roughness={0.3} emissive={CPK[a.el] ?? "#9CA3AF"} emissiveIntensity={0.15} />
        </mesh>
      ))}
      <sprite position={[0, atoms.length > 1 ? 0.62 : 0.48, 0.1]} scale={[0.7, 0.35, 1]}>
        <spriteMaterial map={labelTex(label)} depthTest={false} transparent />
      </sprite>
    </group>
  );
}
