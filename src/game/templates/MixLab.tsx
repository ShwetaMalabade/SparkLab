"use client";
// src/game/templates/MixLab.tsx: C1 Mix Lab (docs/plan/05 §3, 09 §4, 07 §3).
// Beakers = the 2 reactants from question.reaction + up to 2 AI decoys (params.decoys). Dwell a hand on a beaker
// → it attaches to that hand; dwell on its empty slot → it goes back. Clap is armed ONLY when both hands hold one.
// The question's pair plays reaction.visual (bubbles, precipitate, colour lerp 1.5 s, heat, flame), the code-verified
// equation (CPK colours) + observation, and a hazard card "In real life: … Virtual only." Any other pair:
// "Not the pair for this experiment. Try again." (we never claim "no reaction": that pair wasn't verified).
// Max 2 tries, every try goes into mixTries; then Answer Balloons.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { Color, Group, Mesh, MeshStandardMaterial, PointLight, Vector3, type Camera } from "three";
import type { TQuestion } from "@/lib/schema";
import { getTargetRect, useTarget } from "@/motion/targets";
import type { Side } from "@/motion/types";
import { Bubbles, type Place } from "@/three/effects/Bubbles";
import { Precipitate } from "@/three/effects/Precipitate";
import { ChemText } from "../ChemText";
import { playSfx } from "../sfx";
import { subscribe, useGame, type LockResult } from "../store";
import { AnswerBalloons } from "./AnswerBalloons";
import type { TemplateDef, TemplateProps } from "./types";

const MAX_WRONG = 2;
const POUR_MS = 1100;
const WRONG_MS = 1800;
const REACT_MS = 6000; // reaction on screen before the answer balloons
const MAGENTA = "#E879F9";

type Species = { formula: string; name: string };
type Status = "idle" | "pouring" | "wrong" | "reacting";
type MixState = {
  sub: "mix" | "answer";
  held: Record<Side, number | null>;
  status: Status;
  statusAt: number;
  tries: [string, string][];
  wrong: number;
  autoShown: boolean;
};
const fresh = (): MixState => ({ sub: "mix", held: { left: null, right: null }, status: "idle", statusAt: 0, tries: [], wrong: 0, autoShown: false });
const useMix = create<MixState>(() => fresh());

/** Beakers: reactants + decoys, in a stable shuffled order (so the pair isn't always the first two). */
function beakersFor(q: TQuestion): Species[] {
  const r = q.reaction!;
  const list: Species[] = [...r.reactants.slice(0, 2), ...(q.params.decoys ?? []).slice(0, 2)].map((s) => ({ formula: s.formula, name: s.name }));
  let h = 0;
  for (const ch of q.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list
    .map((s, i) => ({ s, k: ((h ^ (i * 2654435761)) >>> 0) % 1000 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.s);
}
const isPair = (q: TQuestion, a: string, b: string) => {
  const [r1, r2] = q.reaction!.reactants;
  return (a === r1.formula && b === r2.formula) || (a === r2.formula && b === r1.formula);
};
const slotId = (i: number) => `beaker:${i}`;

// ================================================================ DOM overlay

function Overlay(props: TemplateProps) {
  const { question, phase, paused, onLock } = props;
  const beakers = useMemo(() => beakersFor(question), [question]);
  const sub = useMix((s) => s.sub);
  const held = useMix((s) => s.held);
  const status = useMix((s) => s.status);
  const wrong = useMix((s) => s.wrong);
  const autoShown = useMix((s) => s.autoShown);
  const reaction = question.reaction!;

  const live = useRef({ phase, paused });
  useEffect(() => {
    live.current = { phase, paused };
  });

  useEffect(() => {
    useMix.setState(fresh());
    return () => useGame.getState().setGame({ templateHint: null, skipHandler: null });
  }, [question.id]);

  const goAnswer = () => useMix.setState({ sub: "answer" });

  // Clap armed only when both hands hold a beaker (09 §4); hint + N-skip per sub-phase.
  useEffect(() => {
    const G = useGame.getState();
    const mixing = phase === "play" && sub === "mix";
    G.arm("clap", mixing && status === "idle" && held.left !== null && held.right !== null);
    if (mixing) {
      const both = held.left !== null && held.right !== null;
      G.setGame({
        templateHint:
          status === "reacting" ? "Watch the reaction…"
          : status === "pouring" ? "Pouring…"
          : both ? "👏 Clap to mix (C)"
          : "Hover a hand on a beaker to grab it · 👏 Clap to mix (keys 1–4, C)",
        skipHandler: () => (useMix.getState().sub === "mix" ? (goAnswer(), true) : false),
      });
    } else G.setGame({ templateHint: null, skipHandler: null });
  }, [phase, sub, status, held]);

  // Grab / return (dwell, mouse click, keys 1–4) and clap.
  useEffect(() => {
    const toggle = (i: number, side: Side | undefined) => {
      const L = live.current;
      const st = useMix.getState();
      if (L.phase !== "play" || L.paused || st.sub !== "mix" || st.status !== "idle") return;
      const holder = (["left", "right"] as const).find((s) => st.held[s] === i);
      if (holder) return useMix.setState({ held: { ...st.held, [holder]: null } }); // put it back
      const hand = side && st.held[side] === null ? side : (["left", "right"] as const).find((s) => st.held[s] === null);
      if (hand) useMix.setState({ held: { ...st.held, [hand]: i } });
    };
    const offs = [
      subscribe("dwell", (e) => {
        const i = beakers.findIndex((_, k) => slotId(k) === e.targetId);
        if (i >= 0) toggle(i, e.source === "gesture" ? e.side : undefined);
      }),
      subscribe("command", (e) => {
        if (e.cmd === "pick" && e.value !== undefined && e.value < beakers.length) toggle(e.value, undefined);
      }),
      subscribe("clap", () => {
        const st = useMix.getState();
        if (live.current.phase !== "play" || st.sub !== "mix" || st.status !== "idle") return;
        if (st.held.left === null || st.held.right === null) return;
        useMix.setState({ status: "pouring", statusAt: performance.now() });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [beakers]);

  // Pour → judge the pair; wrong → beakers return; reaction → answer phase.
  useEffect(() => {
    const id = setInterval(() => {
      if (live.current.paused) return;
      const st = useMix.getState();
      const now = performance.now();
      const el = now - st.statusAt;
      if (st.status === "pouring" && el >= POUR_MS) {
        const a = beakers[st.held.left!].formula;
        const b = beakers[st.held.right!].formula;
        const tries = [...st.tries, [a, b] as [string, string]].slice(0, 4);
        if (isPair(question, a, b)) {
          useMix.setState({ status: "reacting", statusAt: now, tries });
          playSfx("fizz", 0.5);
        }
        else useMix.setState({ status: "wrong", statusAt: now, tries, wrong: st.wrong + 1 });
      } else if (st.status === "wrong" && el >= WRONG_MS) {
        if (st.wrong >= MAX_WRONG) {
          // Out of tries: show the worksheet's own pair so the student still sees the real reaction.
          const r = question.reaction!.reactants;
          const li = beakers.findIndex((x) => x.formula === r[0].formula);
          const ri = beakers.findIndex((x) => x.formula === r[1].formula);
          useMix.setState({ held: { left: li, right: ri }, status: "pouring", statusAt: now, autoShown: true });
        } else useMix.setState({ held: { left: null, right: null }, status: "idle", statusAt: now });
      } else if (st.status === "reacting" && el >= REACT_MS && st.sub === "mix") goAnswer();
    }, 100);
    return () => clearInterval(id);
  }, [beakers, question]);

  const lockWithTries = (r: LockResult) => onLock({ ...r, mixTries: useMix.getState().tries });

  if (sub === "answer" || phase === "reveal" || phase === "next") {
    return sub === "answer" ? <AnswerBalloons.Overlay {...props} onLock={lockWithTries} /> : null;
  }

  const reacting = status === "reacting";
  return (
    <>
      {/* Row: beaker slots around the central flask, in the 42–72% band. */}
      <div className="pointer-events-none absolute inset-x-0 top-[42vh] z-20 flex h-[30vh] items-end justify-center gap-[48px] px-6">
        {beakers.map((b, i) => {
          const holder = held.left === i ? "left" : held.right === i ? "right" : null;
          const slot = <BeakerSlot key={b.formula} index={i} species={b} holder={holder} interactive={phase === "play" && status === "idle"} />;
          return i === Math.ceil(beakers.length / 2) - 1 ? [slot, <FlaskAnchor key="flask" />] : slot;
        })}
      </div>

      {/* Messages */}
      {status === "wrong" && (
        <Banner tone="coral">✗ Not the pair for this experiment. Try again. ({MAX_WRONG - wrong} {MAX_WRONG - wrong === 1 ? "try" : "tries"} left)</Banner>
      )}
      {reacting && (
        <div className="pointer-events-none absolute inset-x-0 top-[17vh] z-30 flex flex-col items-center gap-3 px-6">
          {autoShown && <span className="text-lg text-muted">Here is the pair from the worksheet:</span>}
          <div className="animate-[slidein_0.6s_ease-out] rounded-2xl border border-magenta/50 bg-navy/90 px-6 py-3 text-3xl font-display">
            <ChemText text={reaction.equation} />
          </div>
          <span className="rounded-full bg-navy/85 px-4 py-1 text-xl">{reaction.observation}</span>
          {reaction.hazard && (
            <div className="rounded-xl border border-amber/60 bg-amber/10 px-4 py-2 text-lg text-amber">
              ⚠️ In real life: {reaction.hazard}. <b>Virtual only.</b>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes slidein { from { opacity: 0; transform: translateY(-16px) } to { opacity: 1; transform: none } }`}</style>
    </>
  );
}

function BeakerSlot({ index, species, holder, interactive }: { index: number; species: Species; holder: Side | null; interactive: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(slotId(index), ref, interactive);
  const over = useGame((s) => s.cursors.left.targetId === slotId(index) || s.cursors.right.targetId === slotId(index));
  return (
    <div
      ref={ref}
      {...mouse}
      role="button"
      aria-label={`${holder ? "Put back" : "Grab"} ${species.name}`}
      className={`pointer-events-auto relative flex h-full max-h-[260px] w-[170px] cursor-pointer select-none flex-col items-center justify-end rounded-2xl border-2 pb-2 text-center transition-colors ${
        holder ? "border-dashed border-line" : over ? "border-magenta/80 bg-magenta/5" : "border-transparent"
      }`}
    >
      <span className="rounded-lg bg-navy/85 px-2 py-1 leading-tight">
        <span className="block text-sm text-muted">{index + 1} · {species.name}</span>
        <ChemText text={species.formula} className="text-xl" />
      </span>
      {holder && <span className="absolute top-3 text-sm text-muted">in your {holder} hand · hover to put back</span>}
    </div>
  );
}

/** Invisible anchor: the 3D flask is drawn here. */
function FlaskAnchor() {
  const ref = useRef<HTMLDivElement>(null);
  useTarget("mix:flask", ref, false);
  return <div ref={ref} className="h-full w-[220px]" />;
}

function Banner({ tone, children }: { tone: "coral"; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22vh] z-30 flex justify-center">
      <span className={`rounded-full border bg-navy/90 px-5 py-2 text-2xl ${tone === "coral" ? "border-coral/60 text-coral" : ""}`}>{children}</span>
    </div>
  );
}

// ================================================================ 3D scene

const ndc = new Vector3();
function toPlane(x: number, y: number, w: number, h: number, camera: Camera, z: number, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  return out.copy(camera.position).addScaledVector(dir, (z - camera.position.z) / dir.z);
}
const Z = 0.4;

function Scene(props: TemplateProps) {
  const { question, phase } = props;
  const beakers = useMemo(() => beakersFor(question), [question]);
  const sub = useMix((s) => s.sub);
  const status = useMix((s) => s.status);
  const v = question.reaction!.visual;
  const reacting = status === "reacting";

  if (sub === "answer" || phase === "reveal" || phase === "next") {
    return sub === "answer" && AnswerBalloons.Scene ? <AnswerBalloons.Scene {...props} /> : null;
  }
  return (
    <group>
      <Bench />
      <Flask visual={v} reacting={reacting} />
      {beakers.map((b, i) => (
        <Beaker key={b.formula} index={i} color={v.colorFrom} />
      ))}
      <FlaskEffects visual={v} reacting={reacting} />
    </group>
  );
}

function Bench() {
  const ref = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const tmp = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const r = getTargetRect("mix:flask");
    if (!r || !ref.current) return;
    toPlane(r.x + r.w / 2, r.y + r.h, size.width, size.height, camera, Z, tmp);
    ref.current.position.set(0, tmp.y - 0.06, Z - 0.2);
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[11, 0.1, 1.6]} />
      <meshStandardMaterial color="#1a2340" metalness={0.3} roughness={0.5} emissive={MAGENTA} emissiveIntensity={0.03} />
    </mesh>
  );
}

/** Where the flask is this frame (only one Mix Lab at a time). Written by <Flask>, read by beakers + effects. */
const FLASK = { x: 0, y: 0.6, r: 0.5, h: 0.55 };

function Flask({ visual, reacting }: { visual: NonNullable<TQuestion["reaction"]>["visual"]; reacting: boolean }) {
  const group = useRef<Group>(null);
  const liquid = useRef<Mesh>(null);
  const glass = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const flame = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const tmp = useMemo(() => ({ c: new Vector3(), e: new Vector3() }), []);
  const from = useMemo(() => new Color(visual.colorFrom), [visual.colorFrom]);
  const to = useMemo(() => new Color(visual.colorTo), [visual.colorTo]);
  const t = useRef(0);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const r = getTargetRect("mix:flask");
    if (!r || !group.current) return;
    toPlane(r.x + r.w / 2, r.y + r.h, size.width, size.height, camera, Z, tmp.c); // bottom centre on the bench
    toPlane(r.x + r.w, r.y + r.h, size.width, size.height, camera, Z, tmp.e);
    const scale = tmp.c.distanceTo(tmp.e) / 0.75;
    group.current.position.copy(tmp.c);
    group.current.scale.setScalar(scale);
    FLASK.x = tmp.c.x;
    FLASK.y = tmp.c.y;
    FLASK.r = 0.42 * scale;
    FLASK.h = 0.5 * scale;

    t.current = reacting ? Math.min(1.5, t.current + dt) : 0;
    const k = t.current / 1.5; // colour lerp over 1.5 s
    if (liquid.current) (liquid.current.material as MeshStandardMaterial).color.copy(from).lerp(to, k);
    const g = glass.current?.material as MeshStandardMaterial | undefined;
    if (g) {
      const frost = reacting && visual.heat === "endo" ? k : 0;
      g.emissive.set("#BAE6FD");
      g.emissiveIntensity = frost * 0.6;
      g.opacity = 0.22 + frost * 0.3;
    }
    if (light.current) light.current.intensity = reacting && visual.heat === "exo" ? (2 + Math.sin(state.clock.elapsedTime * 9) * 0.6) * k : 0;
    if (flame.current) {
      flame.current.visible = reacting && !!visual.flame;
      flame.current.scale.set(1, 1 + Math.sin(state.clock.elapsedTime * 14) * 0.12, 1);
    }
  });

  return (
    <group ref={group}>
      {/* Erlenmeyer: body + neck */}
      <mesh ref={glass} position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.16, 0.45, 0.6, 32, 1, true]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.22} roughness={0.05} metalness={0.1} side={2} emissive="#BAE6FD" emissiveIntensity={0} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.26, 24, 1, true]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.22} roughness={0.05} side={2} />
      </mesh>
      <mesh ref={liquid} position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.33, 0.43, 0.24, 32]} />
        <meshStandardMaterial color={visual.colorFrom} transparent opacity={0.85} roughness={0.2} />
      </mesh>
      <pointLight ref={light} position={[0, 0.4, 0.3]} color="#FB923C" intensity={0} distance={3} />
      <mesh ref={flame} position={[0, 1.08, 0]} visible={false}>
        <coneGeometry args={[0.1, 0.42, 20]} />
        <meshBasicMaterial color={visual.flame ?? "#FB923C"} toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function FlaskEffects({ visual, reacting }: { visual: NonNullable<TQuestion["reaction"]>["visual"]; reacting: boolean }) {
  // Read every frame inside the effects (the flask is laid out from the DOM).
  const at = (): Place => {
    const a = FLASK;
    return { origin: [a.x, a.y + 0.03, Z], radius: a.r, height: a.h };
  };
  return (
    <>
      {visual.bubbles && <Bubbles at={at} active={reacting} />}
      {visual.precipitateColor && <Precipitate at={() => ({ ...at(), height: at().height * 0.9 })} color={visual.precipitateColor} active={reacting} />}
    </>
  );
}

function Beaker({ index, color }: { index: number; color: string }) {
  const group = useRef<Group>(null);
  const { camera, size } = useThree();
  const tmp = useMemo(() => ({ home: new Vector3(), e: new Vector3(), target: new Vector3() }), []);
  const tilt = useRef(0);

  useFrame((_, rawDt) => {
    const g = group.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.1);
    const r = getTargetRect(slotId(index));
    if (!r) return;
    toPlane(r.x + r.w / 2, r.y + r.h - 46, size.width, size.height, camera, Z, tmp.home); // stands on the bench above the label
    toPlane(r.x + r.w, r.y + r.h, size.width, size.height, camera, Z, tmp.e);
    const scale = Math.min(1.4, (tmp.home.distanceTo(tmp.e) / 0.45) * 0.85);

    const st = useMix.getState();
    const side: Side | null = st.held.left === index ? "left" : st.held.right === index ? "right" : null;
    let wantTilt = 0;
    if (!side) tmp.target.copy(tmp.home);
    else {
      const f = FLASK;
      const dir = side === "left" ? -1 : 1; // left hand on the screen's left (mirrored view)
      if (st.status === "pouring" || st.status === "reacting") {
        tmp.target.set(f.x + dir * 0.42, f.y + f.h * 2.1, Z + 0.05); // above the flask neck
        wantTilt = -dir * 1.05;
      } else {
        const c = useGame.getState().cursors[side];
        if (c.visible) toPlane(c.x, c.y, size.width, size.height, camera, Z + 0.1, tmp.target);
        else tmp.target.set(f.x + dir * 0.9, f.y + f.h * 1.7, Z + 0.1); // keyboard/mouse: hold it up beside the flask
      }
    }
    g.position.lerp(tmp.target, Math.min(1, dt * 8));
    tilt.current += (wantTilt - tilt.current) * Math.min(1, dt * 6);
    g.rotation.z = tilt.current;
    g.scale.setScalar(scale);
    // Wrong pair: a small wobble.
    if (st.status === "wrong" && side) g.rotation.z = Math.sin(performance.now() / 60) * 0.12;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 24, 1, true]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.25} roughness={0.05} side={2} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.26, 24]} />
        <meshStandardMaterial color={color} transparent opacity={0.75} emissive={MAGENTA} emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

export const MixLab: TemplateDef = {
  Scene,
  Overlay,
  hint: () => "Hover a hand on a beaker to grab it · 👏 Clap to mix",
  avatar: { position: [0, 0.2, -2.6], scale: 0.85 },
};

