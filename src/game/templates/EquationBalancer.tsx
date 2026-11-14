"use client";
// src/game/templates/EquationBalancer.tsx: C2 Equation Balancer (docs/plan/05 §4, P1-TASKS P1-16).
// Species come from question.equation (splitEquation); every coefficient starts at 1. Under each molecule:
// [+] n [−] dwell buttons (≥ 160 px, range 1–9). Per-element atom counters (a mismatch pulses coral) and a 3D scale
// that tilts by the total atom difference. "Check" = dwell / both hands up / Enter. A "change a subscript" button is
// there on purpose (the trap). The verdict comes from src/game/balancer.ts (code, via @/lib/chem).
// Keys: ←/→ pick a molecule · ↑/↓ change its number · 1–4 jump to a molecule · Enter check · X subscript trap.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { create } from "zustand";
import { Group, Vector3, type Camera } from "three";
import { parseFormula } from "@/lib/chem";
import type { TQuestion } from "@/lib/schema";
import { getTargetRect, useTarget } from "@/motion/targets";
import type { InputSource } from "@/motion/types";
import { Confetti } from "@/three/effects/Confetti";
import {
  MAX_COEF, MIN_COEF, answerCoefs, atomCounts, build, flat, judge, ones, speciesOf, trapped,
  type Coefs,
} from "../balancer";
import { ChemText, cpk } from "../ChemText";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";
import type { TemplateDef, TemplateProps } from "./types";

type BalState = {
  coefs: Coefs;
  selected: number; // index into flat(coefs)
  steps: number[][];
  trap: boolean;
  simplify: boolean; // "Balanced! Now simplify" was shown
  locked: boolean;
};
const useBal = create<BalState>(() => ({ coefs: { left: [], right: [] }, selected: 0, steps: [], trap: false, simplify: false, locked: false }));

const plusId = (i: number) => `bal:plus:${i}`;
const minusId = (i: number) => `bal:minus:${i}`;
const CHECK = "bal:check";
const TRAP = "bal:trap";
const PAN = { left: "bal:pan:left", right: "bal:pan:right" } as const;

function setFlat(c: Coefs, i: number, v: number): Coefs {
  const n = c.left.length;
  return i < n ? { left: c.left.map((x, k) => (k === i ? v : x)), right: c.right } : { left: c.left, right: c.right.map((x, k) => (k === i - n ? v : x)) };
}

/** What the screen shows: during the reveal of a wrong answer, the answer key's numbers animate in. */
function useShown(question: TQuestion, phase: TemplateProps["phase"]) {
  const sp = useMemo(() => speciesOf(question)!, [question]);
  const coefs = useBal((s) => s.coefs);
  const trap = useBal((s) => s.trap);
  const lastResult = useGame((s) => s.lastResult);
  const revealing = (phase === "reveal" || phase === "next") && !!lastResult;
  const fix = revealing && !lastResult!.correct;
  const answer = useMemo(() => answerCoefs(question), [question]);
  const shownSp = trap && !fix ? trapped(sp) : sp;
  // First frame of a new question: the store still holds the previous question's numbers → start at all 1s.
  const own = coefs.left.length === sp.left.length && coefs.right.length === sp.right.length ? coefs : ones(sp);
  const shownC = fix && answer ? answer : own;
  return { sp, shownSp, shownC, revealing, fix, correct: revealing && lastResult!.correct };
}

// ================================================================ DOM overlay

function Overlay({ question, worksheet, phase, paused, onLock }: TemplateProps) {
  const { sp, shownSp, shownC, revealing, fix, correct } = useShown(question, phase);
  const selected = useBal((s) => s.selected);
  const simplify = useBal((s) => s.simplify);
  const trap = useBal((s) => s.trap);
  const interactive = phase === "play" && !paused;
  const counts = atomCounts(shownSp, shownC);

  const live = useRef({ question, worksheet, interactive, onLock, sp });
  useEffect(() => {
    live.current = { question, worksheet, interactive, onLock, sp };
  });

  useEffect(() => {
    const start = ones(sp);
    useBal.setState({ coefs: start, selected: 0, steps: [flat(start)], trap: false, simplify: false, locked: false });
    return () => useGame.getState().setGame({ templateHint: null });
  }, [question.id, sp]);

  useEffect(() => {
    useGame.getState().setGame({
      templateHint: phase === "play" ? "Hover on + / − to change numbers · Both hands up to check (←/→ ↑/↓ · Enter · X)" : null,
    });
  }, [phase]);

  // All input goes through the bus (gesture dwell, mouse click, keys).
  useEffect(() => {
    const ok = () => live.current.interactive && !useBal.getState().locked;
    const change = (i: number, d: number) => {
      if (!ok()) return;
      const st = useBal.getState();
      const cur = flat(st.coefs)[i];
      if (cur === undefined) return;
      const v = Math.min(MAX_COEF, Math.max(MIN_COEF, cur + d));
      if (v === cur) return useBal.setState({ selected: i });
      const coefs = setFlat(st.coefs, i, v);
      useBal.setState({ coefs, selected: i, steps: [...st.steps, flat(coefs)].slice(-30) });
      playSfx("pop", 0.25);
    };
    const lock = (input: InputSource, trapNow: boolean) => {
      if (!ok()) return;
      const L = live.current;
      const st = useBal.getState();
      const shown = trapNow ? trapped(L.sp) : L.sp;
      const v = judge(L.question, L.worksheet, shown, st.coefs, { trap: trapNow, secondSimplify: st.simplify });
      if (v.kind === "simplify") return useBal.setState({ simplify: true });
      useBal.setState({ locked: true, trap: trapNow });
      console.info("[balancer] lock-in", v, st.steps);
      L.onLock({
        chosen: v.chosen, chosenText: v.chosenText, correct: v.correct, misconceptionId: v.misconceptionId,
        input, hoverTrace: [], balancerSteps: st.steps,
      });
    };
    const offs = [
      subscribe("dwell", (e) => {
        const id = e.targetId ?? "";
        const total = flat(useBal.getState().coefs).length;
        for (let i = 0; i < total; i++) {
          if (id === plusId(i)) return change(i, +1);
          if (id === minusId(i)) return change(i, -1);
        }
        if (id === CHECK) lock(e.source, false);
        if (id === TRAP) lock(e.source, true);
      }),
      subscribe("bothUp", (e) => lock(e.source, false)),
      subscribe("lean", (e) => {
        if (!ok()) return;
        const st = useBal.getState();
        const total = flat(st.coefs).length;
        useBal.setState({ selected: Math.min(total - 1, Math.max(0, st.selected + (e.side === "left" ? -1 : 1))) });
      }),
      subscribe("command", (e) => {
        if (e.cmd === "angle" && e.value) change(useBal.getState().selected, e.value > 0 ? +1 : -1);
        else if (e.cmd === "pick" && e.value !== undefined && ok() && e.value < flat(useBal.getState().coefs).length) useBal.setState({ selected: e.value });
        else if (e.cmd === "subscript") lock(e.source, true);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const column = (formula: string, coef: number, i: number) => (
    <Column key={i} index={i} formula={formula} coef={coef} interactive={interactive} selected={interactive && selected === i} fixed={fix} />
  );
  const nl = shownSp.left.length;

  return (
    <>
      {/* Equation row: left molecules · counters · right molecules (the 3D pans sit above each group). */}
      <div className="pointer-events-none absolute inset-x-0 top-[34vh] z-20 flex h-[40vh] items-stretch justify-center gap-6 px-6">
        <PanGroup id={PAN.left}>{shownSp.left.map((f, i) => column(f, shownC.left[i], i))}</PanGroup>
        <div className="flex w-[230px] flex-col items-center justify-center gap-3">
          <span className="font-display text-5xl text-muted">→</span>
          <Counters rows={counts.rows} fixed={fix || correct} />
        </div>
        <PanGroup id={PAN.right}>{shownSp.right.map((f, i) => column(f, shownC.right[i], nl + i))}</PanGroup>
      </div>

      {/* The equation as built, with code-computed state. */}
      <div className="pointer-events-none absolute inset-x-0 top-[76vh] z-20 flex justify-center">
        <span className="rounded-2xl border border-magenta/40 bg-navy/85 px-5 py-2 font-display text-3xl">
          <ChemText text={build(shownSp, shownC)} />
        </span>
      </div>

      {simplify && !revealing && <Banner tone="lime">Balanced! Now make the numbers as small as possible.</Banner>}
      {revealing && trap && <Banner tone="coral">✗ That&apos;s a different chemical! Only the big numbers can change.</Banner>}
      {revealing && correct && <Banner tone="lime">✓ Balanced!</Banner>}

      {phase === "play" && (
        <>
          <BigButton id={TRAP} side="left" interactive={interactive} tone="amber">
            <span className="text-base text-muted">Change a subscript</span>
            <ChemText text={sp.right[0]} className="text-2xl" />
            <span className="text-sm text-muted">→</span>
            <ChemText text={trapped(sp).right[0]} className="text-2xl" />
            <span className="text-xs text-muted">(X)</span>
          </BigButton>
          <BigButton id={CHECK} side="right" interactive={interactive} tone="lime">
            <span className="text-3xl">✓ Check</span>
            <span className="text-sm text-muted">both hands up · Enter</span>
          </BigButton>
        </>
      )}
      <style>{`@keyframes balpulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } } @keyframes slidein { from { opacity: 0; transform: translateY(-12px) } to { opacity: 1; transform: none } }`}</style>
    </>
  );
}

function PanGroup({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useTarget(id, ref, false); // anchor for the 3D pan (never a dwell target)
  return (
    <div ref={ref} className="flex items-stretch gap-4">
      {children}
    </div>
  );
}

function Column({ index, formula, coef, interactive, selected, fixed }: {
  index: number; formula: string; coef: number; interactive: boolean; selected: boolean; fixed: boolean;
}) {
  return (
    <div className={`flex w-[170px] flex-col items-center justify-between rounded-2xl py-1 ${selected ? "ring-4 ring-violet/80" : ""}`}>
      <Step id={plusId(index)} label="+" interactive={interactive && coef < MAX_COEF} />
      <div className="flex items-baseline gap-1 rounded-xl bg-navy/85 px-3 py-1">
        <span key={`${coef}-${fixed}`} className={`font-display text-5xl tabular-nums transition-colors ${fixed ? "text-lime animate-[slidein_0.5s_ease-out]" : "text-text"}`}>
          {coef}
        </span>
        <ChemText text={formula} className="text-3xl" />
      </div>
      <Step id={minusId(index)} label="−" interactive={interactive && coef > MIN_COEF} />
    </div>
  );
}

function Step({ id, label, interactive }: { id: string; label: string; interactive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref, interactive);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  return (
    <div
      ref={ref}
      {...mouse}
      role="button"
      aria-label={label === "+" ? "Increase" : "Decrease"}
      className={`pointer-events-auto grid h-[76px] w-[160px] cursor-pointer select-none place-items-center rounded-2xl border-2 bg-navy/80 font-display text-4xl transition-colors ${
        !interactive ? "border-line text-muted/40" : over ? "border-magenta bg-magenta/10 text-text" : "border-line text-text hover:border-magenta/70"
      }`}
    >
      {label}
    </div>
  );
}

function Counters({ rows, fixed }: { rows: { el: string; left: number; right: number }[]; fixed: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-navy/85 px-4 py-3">
      <span className="text-center text-sm text-muted">atoms · left | right</span>
      {rows.map((r) => {
        const ok = r.left === r.right;
        const tone = fixed || ok ? "text-lime" : "text-coral";
        return (
          <div key={r.el} className={`flex items-center justify-between gap-3 font-display text-2xl tabular-nums ${tone}`} style={!ok && !fixed ? { animation: "balpulse 0.9s ease-in-out infinite" } : undefined}>
            <span className="w-10 font-semibold" style={{ color: cpk(r.el) }}>{r.el}</span>
            <span className="w-8 text-right">{r.left}</span>
            <span className="text-muted">{ok ? "=" : "≠"}</span>
            <span className="w-8">{r.right}</span>
            <span className="w-5 text-base">{ok ? "✓" : "✗"}</span>
          </div>
        );
      })}
    </div>
  );
}

function BigButton({ id, side, interactive, tone, children }: { id: string; side: "left" | "right"; interactive: boolean; tone: "lime" | "amber"; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref, interactive);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  const border = tone === "lime" ? (over ? "border-lime bg-lime/10" : "border-lime/50") : over ? "border-amber bg-amber/10" : "border-dashed border-amber/50";
  return (
    <div
      ref={ref}
      {...mouse}
      role="button"
      className={`pointer-events-auto absolute bottom-28 z-30 flex h-[160px] w-[200px] cursor-pointer select-none flex-col items-center justify-center gap-0.5 rounded-2xl border-2 bg-navy/80 text-center ${border} ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      {children}
    </div>
  );
}

function Banner({ tone, children }: { tone: "lime" | "coral"; children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[29vh] z-30 flex justify-center px-6">
      <span className={`rounded-full border bg-navy/90 px-5 py-1 text-xl ${tone === "lime" ? "border-lime/60 text-lime" : "border-coral/60 text-coral"}`}>{children}</span>
    </div>
  );
}

// ================================================================ 3D scene: a balance scale with atom-sphere molecules

const ndc = new Vector3();
function toPlane(x: number, y: number, w: number, h: number, camera: Camera, z: number, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(dir, (z - camera.position.z) / dir.z);
}
const Z = -0.4;
const MAX_MOLS = 12; // per pan, drawn (the counters always show the real numbers)
const MAX_ATOMS = 12; // per molecule, drawn

/** Atom layout for one molecule: the rarest element in the middle, the rest in a ring around it. */
function moleculeAtoms(formula: string): { el: string; p: [number, number, number]; r: number }[] {
  const counts = Object.entries(parseFormula(formula));
  const atoms = counts.flatMap(([el, k]) => Array.from({ length: k }, () => el)).slice(0, MAX_ATOMS);
  if (atoms.length === 1) return [{ el: atoms[0], p: [0, 0, 0], r: atoms[0] === "H" ? 0.07 : 0.1 }];
  const centre = [...counts].sort((a, b) => a[1] - b[1])[0][0];
  const ci = atoms.indexOf(centre);
  const rest = atoms.filter((_, i) => i !== ci);
  const out: { el: string; p: [number, number, number]; r: number }[] = [{ el: centre, p: [0, 0, 0], r: centre === "H" ? 0.07 : 0.1 }];
  if (atoms.length === 2 && atoms[0] === atoms[1]) return [{ el: atoms[0], p: [-0.06, 0, 0], r: atoms[0] === "H" ? 0.07 : 0.1 }, { el: atoms[1], p: [0.06, 0, 0], r: atoms[1] === "H" ? 0.07 : 0.1 }];
  rest.forEach((el, i) => {
    const a = (i / rest.length) * Math.PI * 2 + Math.PI / 2;
    out.push({ el, p: [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.02], r: el === "H" ? 0.07 : 0.1 });
  });
  return out;
}

function Molecule({ formula, position }: { formula: string; position: [number, number, number] }) {
  const atoms = useMemo(() => moleculeAtoms(formula), [formula]);
  return (
    <group position={position}>
      {atoms.map((a, i) => (
        <mesh key={i} position={a.p}>
          <sphereGeometry args={[a.r, 16, 12]} />
          <meshStandardMaterial color={cpk(a.el)} emissive={cpk(a.el)} emissiveIntensity={0.25} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

/** The molecules piled on one pan: `coef` copies of each species on that side. */
function PanLoad({ species, coefs }: { species: string[]; coefs: number[] }) {
  const mols = species.flatMap((f, i) => Array.from({ length: coefs[i] ?? 0 }, () => f)).slice(0, MAX_MOLS);
  const perRow = 4;
  return (
    <>
      {mols.map((f, k) => {
        const row = Math.floor(k / perRow);
        const inRow = Math.min(perRow, mols.length - row * perRow);
        const x = ((k % perRow) - (inRow - 1) / 2) * 0.34;
        return <Molecule key={k} formula={f} position={[x, 0.16 + row * 0.3, 0]} />;
      })}
    </>
  );
}

function Scene({ question, phase }: TemplateProps) {
  const { shownSp, shownC, correct } = useShown(question, phase);
  const beam = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const panL = useRef<Group>(null);
  const panR = useRef<Group>(null);
  const { camera, size } = useThree();
  const tmp = useMemo(() => ({ a: new Vector3(), b: new Vector3() }), []);
  const tilt = useRef(0);
  const geo = useRef({ half: 1.5, scale: 1, x: 0, y: 1 });
  const { leftTotal, rightTotal } = atomCounts(shownSp, shownC);
  const diff = leftTotal - rightTotal;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const L = getTargetRect(PAN.left);
    const R = getTargetRect(PAN.right);
    if (!L || !R || !beam.current || !pivot.current || !panL.current || !panR.current) return;
    // Pans sit just above each group of columns; the pivot halfway between them.
    toPlane(L.x + L.w / 2, L.y - 70, size.width, size.height, camera, Z, tmp.a);
    toPlane(R.x + R.w / 2, R.y - 70, size.width, size.height, camera, Z, tmp.b);
    const g = geo.current;
    g.half = (tmp.b.x - tmp.a.x) / 2;
    g.x = (tmp.a.x + tmp.b.x) / 2;
    g.y = (tmp.a.y + tmp.b.y) / 2 + 0.55;
    g.scale = Math.max(0.6, Math.min(1.4, g.half / 1.6));
    pivot.current.position.set(g.x, g.y, Z - 0.05);
    pivot.current.scale.setScalar(g.scale);

    // Heavier side goes down (left heavier → positive rotation lowers the left end).
    const want = Math.max(-0.3, Math.min(0.3, diff * 0.05));
    tilt.current += (want - tilt.current) * Math.min(1, dt * 4);
    beam.current.position.set(g.x, g.y, Z);
    beam.current.rotation.z = tilt.current;
    beam.current.scale.set(g.half, g.scale, g.scale);
    const c = Math.cos(tilt.current), s = Math.sin(tilt.current);
    const drop = 0.5 * g.scale;
    panL.current.position.set(g.x - g.half * c, g.y - g.half * s - drop, Z);
    panR.current.position.set(g.x + g.half * c, g.y + g.half * s - drop, Z);
    panL.current.scale.setScalar(g.scale);
    panR.current.scale.setScalar(g.scale);
  });

  const MAG = "#E879F9";
  return (
    <group>
      {/* Post + base */}
      <group ref={pivot}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.6, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} emissive={MAG} emissiveIntensity={0.05} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshStandardMaterial color={MAG} emissive={MAG} emissiveIntensity={0.6} />
        </mesh>
        {correct && <Confetti key="bal-confetti" position={[0, -0.5, 0.3]} />}
      </group>
      {/* Beam (unit length, scaled to the gap between the groups) */}
      <group ref={beam}>
        <mesh>
          <boxGeometry args={[2, 0.05, 0.08]} />
          <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} emissive={MAG} emissiveIntensity={0.12} />
        </mesh>
      </group>
      {/* Pans hang level from the beam ends */}
      {([["left", panL], ["right", panR]] as const).map(([side, ref]) => (
        <group key={side} ref={ref}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
            <meshStandardMaterial color="#64748B" />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.75, 0.6, 0.06, 32]} />
            <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.35} emissive={correct ? "#A3E635" : MAG} emissiveIntensity={correct ? 0.35 : 0.08} />
          </mesh>
          <PanLoad species={side === "left" ? shownSp.left : shownSp.right} coefs={side === "left" ? shownC.left : shownC.right} />
        </group>
      ))}
    </group>
  );
}

export const EquationBalancer: TemplateDef = {
  Scene,
  Overlay,
  hint: () => "Hover on + / − to change numbers · Both hands up to check",
  avatar: { position: [0, 0.1, -3.2], scale: 0.7 },
  still: true,
};
