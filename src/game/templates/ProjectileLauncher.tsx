"use client";
// src/game/templates/ProjectileLauncher.tsx: P1 Projectile Launcher (docs/plan/05 §2, 04 §6, 07 §3).
// Experiment (≤ 20 s, ≤ 3 test shots): forearm θ, power hand → v = 5 + p·25, params.lock honoured (locked control
// shows 🔒 + the question's value and is ignored by hold-steady). Fire = hold steady 1.2 s (or Space). bothUp is
// disarmed while aiming. Each flight is analytic and time-scaled to ~2.5 s; experiments[] go to the coach.
// Answer: Answer Balloons with the question's choices. Reveal: the real v, θ lands on the flag; a wrong numeric pick
// gets a dashed coral ghost trail (same θ, code-scaled) labelled with its misconception.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import type { Mesh, Group } from "three";
import type { TQuestion } from "@/lib/schema";
import { engine } from "@/motion/gestures";
import { useTarget } from "@/motion/targets";
import { Confetti } from "@/three/effects/Confetti";
import { Trail } from "@/three/effects/Trail";
import { Pinned, WorldAnchor } from "@/three/WorldLabels";
import { arc, choiceNumber, fieldLength, G, position, range, speedForRange, speedFromPower } from "../physics";
import { subscribe, useGame, type LockResult } from "../store";
import { AnswerBalloons } from "./AnswerBalloons";
import type { TemplateDef, TemplateProps } from "./types";

const EXPERIMENT_MS = 20_000;
const MAX_SHOTS = 3;
const FLIGHT_MS = 2500;
const LAND_PAUSE_MS = 700;
const CYAN = "#22D3EE";
const LIME = "#A3E635";
const CORAL = "#FB7185";
const AMBER = "#FBBF24";

type Shot = { thetaDeg: number; speed: number; landedM: number };
type Flight = Shot & { id: number; elapsed: number; landedAt: number | null };

type LauncherState = {
  sub: "experiment" | "answer";
  shots: Shot[];
  flight: Flight | null;
  aim: { theta: number; speed: number };
  msLeft: number;
  /** Hold-steady ring progress 0..1. */
  ring: number;
};
const useLauncher = create<LauncherState>(() => ({ sub: "experiment", shots: [], flight: null, aim: { theta: 45, speed: 20 }, msLeft: EXPERIMENT_MS, ring: 0 }));

/** Question knobs, all from the worksheet (never invented). */
function knobs(q: TQuestion) {
  const lock = q.params.lock ?? "none";
  const v = q.given.v?.value ?? 20;
  const theta = q.given.theta?.value ?? 45;
  const g = q.given.g?.value ?? G;
  const L = fieldLength(lock === "speed" ? v : null, g);
  return { lock, v, theta, g, L };
}

const fmtM = (m: number) => `${m.toFixed(1)} m`;

// ================================================================ DOM overlay: input, timers, HUD, answer phase

function Overlay(props: TemplateProps) {
  const { question, phase, paused, onLock } = props;
  const K = useMemo(() => knobs(question), [question]);
  const sub = useLauncher((s) => s.sub);
  const shots = useLauncher((s) => s.shots);
  const flight = useLauncher((s) => s.flight);
  const aim = useLauncher((s) => s.aim);
  const msLeft = useLauncher((s) => s.msLeft);
  const lastResult = useGame((s) => s.lastResult);

  // Live values for handlers/timers.
  const live = useRef({ phase, paused, manualTheta: null as number | null, manualSpeed: null as number | null, lastKeyT: -Infinity, nextId: 1 });
  useEffect(() => {
    live.current.phase = phase;
    live.current.paused = paused;
  });

  // Fresh state per question.
  useEffect(() => {
    useLauncher.setState({ sub: "experiment", shots: [], flight: null, aim: { theta: K.lock === "angle" ? K.theta : 45, speed: K.lock === "speed" ? K.v : 20 }, msLeft: EXPERIMENT_MS });
    engine.setOptions({ lockAngle: K.lock === "angle", lockSpeed: K.lock === "speed" });
    return () => {
      engine.setOptions({ lockAngle: false, lockSpeed: false });
      useGame.getState().setGame({ templateHint: null, skipHandler: null });
    };
  }, [K]);

  const goAnswer = () => {
    const st = useLauncher.getState();
    if (st.sub === "answer") return;
    // A shot already fired still counts (its landing distance is known at launch), even if skipped mid-air.
    const f = st.flight;
    const shots = f ? [...st.shots, { thetaDeg: f.thetaDeg, speed: f.speed, landedM: f.landedM }].slice(0, MAX_SHOTS) : st.shots;
    useLauncher.setState({ sub: "answer", flight: null, shots });
  };

  // Arming + hint + N-skip per sub-phase (09 §4: bothUp ignored while aiming).
  useEffect(() => {
    const G0 = useGame.getState();
    if (phase === "play" && sub === "experiment") {
      G0.arm("fire", true);
      G0.arm("bothUp", false);
      const other = engine.opts.leftHanded ? "Right hand" : "Left hand";
      const hint =
        K.lock === "speed" ? `Forearm = angle · Speed is 🔒 ${K.v} m/s · Hold still to fire`
        : K.lock === "angle" ? `${other} = power · Angle is 🔒 ${K.theta}° · Hold still to fire`
        : `Forearm = angle · ${other} = power · Hold still to fire`;
      G0.setGame({ templateHint: `${hint} (Space · ↑↓ · W/S)`, skipHandler: () => (useLauncher.getState().sub === "experiment" ? (goAnswer(), true) : false) });
    } else {
      G0.arm("fire", false);
      G0.arm("bothUp", true);
      G0.setGame({ templateHint: null, skipHandler: null });
    }
  }, [phase, sub, K]);

  // Aim (camera or keyboard), experiment timer, landing → next shot / answer phase.
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const L = live.current;
      const st = useLauncher.getState();
      if (L.phase !== "play" || L.paused || st.sub !== "experiment") return;

      const f = engine.latest;
      const camAim = f.tracking && now - L.lastKeyT > 3000; // keyboard wins for 3 s after a key press
      const theta = K.lock === "angle" ? K.theta : camAim ? f.theta : (L.manualTheta ?? st.aim.theta);
      const speed = K.lock === "speed" ? K.v : camAim ? speedFromPower(f.power) : (L.manualSpeed ?? st.aim.speed);
      if (camAim) {
        L.manualTheta = theta;
        L.manualSpeed = speed;
      }
      const msLeft = st.flight ? st.msLeft : Math.max(0, st.msLeft - dt);
      const ring = st.flight ? 0 : Math.min(1, f.steadyMs / 1200);
      useLauncher.setState({ aim: { theta, speed }, msLeft, ring: Math.abs(ring - st.ring) > 0.03 || ring === 0 ? ring : st.ring });

      const fl = st.flight;
      if (fl && fl.landedAt !== null && now - fl.landedAt > LAND_PAUSE_MS) {
        const shots = [...st.shots, { thetaDeg: fl.thetaDeg, speed: fl.speed, landedM: fl.landedM }];
        useLauncher.setState({ shots, flight: null });
        if (shots.length >= MAX_SHOTS) goAnswer();
      } else if (!fl && msLeft <= 0) goAnswer();
    }, 50);
    return () => clearInterval(id);
  }, [K]);

  // Fire (hold-steady gesture or Space) + keyboard aim.
  useEffect(() => {
    const offs = [
      subscribe("fire", () => {
        const L = live.current;
        const st = useLauncher.getState();
        if (L.phase !== "play" || L.paused || st.sub !== "experiment" || st.flight || st.shots.length >= MAX_SHOTS) return;
        // Use the newest keyboard aim even if the 50 ms aim tick hasn't applied it yet.
        const kb = performance.now() - L.lastKeyT <= 3000;
        const th = K.lock === "angle" ? K.theta : kb && L.manualTheta !== null ? L.manualTheta : st.aim.theta;
        const sp = K.lock === "speed" ? K.v : kb && L.manualSpeed !== null ? L.manualSpeed : st.aim.speed;
        const thetaDeg = Math.round(Math.min(85, Math.max(5, th)) * 10) / 10;
        const speed = Math.round(sp * 10) / 10;
        const landedM = Math.round(range(speed, thetaDeg, K.g) * 10) / 10;
        useLauncher.setState({ flight: { id: L.nextId++, thetaDeg, speed, landedM, elapsed: 0, landedAt: null } });
      }),
      subscribe("command", (e) => {
        const L = live.current;
        if (e.cmd === "angle" && K.lock !== "angle") {
          L.lastKeyT = performance.now();
          L.manualTheta = Math.min(85, Math.max(5, (L.manualTheta ?? useLauncher.getState().aim.theta) + (e.value ?? 0)));
        }
        if (e.cmd === "power" && K.lock !== "speed") {
          L.lastKeyT = performance.now();
          const cur = L.manualSpeed ?? useLauncher.getState().aim.speed;
          L.manualSpeed = Math.min(30, Math.max(5, cur + (e.value ?? 0) * 25)); // W/S = ±0.04 power = ±1 m/s
        }
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [K]);

  const lockWithExperiments = (r: LockResult) => onLock({ ...r, experiments: useLauncher.getState().shots.slice(0, 5) });

  const revealing = (phase === "reveal" || phase === "next") && !!lastResult;
  if (revealing) return <RevealCard question={question} />;
  if (sub === "answer" || phase !== "play") {
    return sub === "answer" ? <AnswerBalloons.Overlay {...props} onLock={lockWithExperiments} /> : null;
  }

  return (
    <>
      {/* Aim HUD (bottom-left, above the hints). Every number here is computed by code from the motion. */}
      <div className="pointer-events-none absolute bottom-28 left-4 z-30 flex flex-col gap-1 rounded-2xl border border-line bg-navy/85 px-5 py-4 font-display text-2xl backdrop-blur">
        <span>
          θ <b className="tabular-nums">{Math.round(aim.theta)}°</b> {K.lock === "angle" && "🔒"}
        </span>
        <span>
          v <b className="tabular-nums">{aim.speed.toFixed(1)} m/s</b> {K.lock === "speed" && "🔒"}
        </span>
        <span className="text-base text-muted">
          Test shot {Math.min(shots.length + (flight ? 1 : 0), MAX_SHOTS)}/{MAX_SHOTS} · {Math.ceil(msLeft / 1000)} s
        </span>
        {shots.map((s, i) => (
          <span key={i} className="text-base text-muted">
            #{i + 1}: {s.thetaDeg}°, {s.speed} m/s → <b className="text-text">{fmtM(s.landedM)}</b>
          </span>
        ))}
      </div>
      <SkipToAnswers onSkip={goAnswer} />
      <Pinned id="launcher:cannon" className="z-20">
        <HoldRing />
      </Pinned>
    </>
  );
}

function SkipToAnswers({ onSkip }: { onSkip: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget("launcher:skip", ref);
  useEffect(() => subscribe("dwell", (e) => e.targetId === "launcher:skip" && onSkip()), [onSkip]);
  return (
    <div
      ref={ref}
      {...mouse}
      className="pointer-events-auto absolute bottom-28 right-4 z-30 grid h-[160px] w-[200px] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line bg-navy/70 text-center text-lg text-muted hover:border-cyan"
    >
      <span>
        Ready to answer?
        <br />
        <b className="text-text">Hover here</b> or press N
      </span>
    </div>
  );
}

function RevealCard({ question }: { question: TQuestion }) {
  const r = useGame((s) => s.lastResult)!;
  const correct = question.choices.find((c) => c.correct)!;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[24vh] z-20 flex justify-center gap-4">
      {!r.correct && (
        <span className="rounded-full border border-coral/60 bg-navy/85 px-4 py-2 text-xl text-coral">✗ Your pick: {r.chosenText}</span>
      )}
      <span className="rounded-full border border-lime/60 bg-navy/85 px-4 py-2 text-xl text-lime">✓ {correct.text}</span>
    </div>
  );
}

// ================================================================ 3D scene: field, cannon, flights, reveal

function Scene(props: TemplateProps) {
  const { question, worksheet, phase } = props;
  const K = useMemo(() => knobs(question), [question]);
  const sub = useLauncher((s) => s.sub);
  const shots = useLauncher((s) => s.shots);
  const flight = useLauncher((s) => s.flight);
  const lastResult = useGame((s) => s.lastResult);
  const revealing = (phase === "reveal" || phase === "next") && !!lastResult;

  // World mapping: cannon at x0, 1 m = S world units so the field fits ~9.2 units.
  const x0 = -4.6;
  const S = 9.2 / K.L;
  const W = (m: { x: number; y: number }): [number, number, number] => [x0 + m.x * S, 0.12 + m.y * S, 0];

  const ghostValue = revealing && !lastResult!.correct ? choiceNumber(lastResult!.chosenText) : null;
  const ghostLabel = useMemo(() => {
    if (ghostValue === null) return "";
    const mc = worksheet.misconceptions.find((m) => m.id === lastResult?.misconceptionId);
    return `${mc?.label ?? "Your pick"} → ${fmtM(ghostValue)}`;
  }, [ghostValue, worksheet, lastResult]);

  return (
    <group>
      <Field L={K.L} x0={x0} S={S} />
      <Cannon x0={x0} active={phase === "play" && sub === "experiment"} />

      {/* Past test shots: faint trails + landing labels */}
      {shots.map((s, i) => (
        <group key={i}>
          <Trail points={arc(s.speed, s.thetaDeg, 50, K.g).map(W)} progress={() => 1} color={CYAN} size={0.025} opacity={0.35} />
          <LandMark id={`shot:${i}`} at={W({ x: s.landedM, y: 0 })} label={fmtM(s.landedM)} color={CYAN} dim />
        </group>
      ))}

      {flight && <FlightView key={flight.id} flight={flight} K={K} W={W} />}

      {revealing && (
        <>
          <Flag at={W({ x: question.answer.value ?? range(K.v, K.theta, K.g), y: 0 })} />
          <RevealShot v={K.v} theta={K.theta} g={K.g} W={W} color={LIME} label={question.answer.text} burst={lastResult!.correct} />
          {ghostValue !== null && ghostValue > 0 && (
            <RevealShot v={speedForRange(ghostValue, K.theta, K.g)} theta={K.theta} g={K.g} W={W} color={CORAL} label={ghostLabel} dashed />
          )}
        </>
      )}

      {sub === "answer" && !revealing && AnswerBalloons.Scene && <AnswerBalloons.Scene {...props} />}
    </group>
  );
}

function Field({ L, x0, S }: { L: number; x0: number; S: number }) {
  const marks = Array.from({ length: L / 10 + 1 }, (_, i) => i * 10);
  return (
    <group>
      <mesh position={[x0 + (L * S) / 2, 0.01, 0]}>
        <boxGeometry args={[L * S, 0.02, 0.6]} />
        <meshStandardMaterial color="#0f1730" emissive={CYAN} emissiveIntensity={0.05} />
      </mesh>
      {marks.map((m) => (
        <group key={m} position={[x0 + m * S, 0.03, 0]}>
          <mesh>
            <boxGeometry args={[0.02, 0.02, 0.7]} />
            <meshBasicMaterial color={CYAN} toneMapped={false} />
          </mesh>
          {m > 0 && <WorldAnchor id={`tick:${m}`} position={[0, -0.12, 0.45]} label={{ text: `${m} m`, variant: "tick" }} />}
        </group>
      ))}
    </group>
  );
}

function Cannon({ x0, active }: { x0: number; active: boolean }) {
  const barrel = useRef<Group>(null);
  useFrame(() => {
    const theta = useLauncher.getState().aim.theta;
    if (barrel.current) barrel.current.rotation.z = (theta * Math.PI) / 180;
  });
  return (
    <group position={[x0, 0.12, 0]}>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.16, 24]} />
        <meshStandardMaterial color="#1f2a4a" metalness={0.6} roughness={0.3} />
      </mesh>
      <group ref={barrel}>
        <mesh position={[0.32, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.09, 0.64, 20]} />
          <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.6} metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
      {active && <WorldAnchor id="launcher:cannon" />}
    </group>
  );
}

/** Hold-to-fire ring around the cannon (DOM, pinned to the cannon anchor). */
function HoldRing() {
  const ring = useLauncher((s) => s.ring);
  const R = 30, C = 2 * Math.PI * R;
  return (
    <svg width={2 * R + 12} height={2 * R + 12} aria-hidden>
      <circle cx={R + 6} cy={R + 6} r={R} fill="none" stroke="#ffffff22" strokeWidth={5} />
      <circle cx={R + 6} cy={R + 6} r={R} fill="none" stroke={LIME} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - ring)} transform={`rotate(-90 ${R + 6} ${R + 6})`} />
    </svg>
  );
}

/** A test shot in flight: ball + growing trail; marks itself landed for the overlay's timer. */
function FlightView({ flight, K, W }: { flight: Flight; K: ReturnType<typeof knobs>; W: (m: { x: number; y: number }) => [number, number, number] }) {
  const ball = useRef<Mesh>(null);
  const pts = useMemo(() => arc(flight.speed, flight.thetaDeg, 60, K.g).map(W), [flight, K.g, W]);
  const prog = useRef(0);
  const [landed, setLanded] = useState(false);
  useFrame((_, rawDt) => {
    if (useGame.getState().paused) return;
    const dt = Math.min(rawDt, 0.25) * 1000 // flights keep ~2.5 s even at low fps;
    prog.current = Math.min(1, prog.current + dt / FLIGHT_MS);
    const T = (2 * flight.speed * Math.sin((flight.thetaDeg * Math.PI) / 180)) / K.g;
    const p = position(flight.speed, flight.thetaDeg, T * prog.current, K.g);
    if (ball.current) ball.current.position.set(...W({ x: p.x, y: Math.max(0, p.y) }));
    if (prog.current >= 1 && !landed) {
      setLanded(true);
      const st = useLauncher.getState();
      if (st.flight?.id === flight.id) useLauncher.setState({ flight: { ...st.flight, landedAt: performance.now() } });
    }
  });
  return (
    <group>
      <Trail points={pts} progress={() => prog.current} color={CYAN} />
      <mesh ref={ball} position={pts[0]}>
        <sphereGeometry args={[0.1, 20, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {landed && <LandMark id={`flight:${flight.id}`} at={pts[pts.length - 1]} label={fmtM(flight.landedM)} color={CYAN} />}
    </group>
  );
}

/** Reveal flight (real answer or ghost of a wrong pick). */
function RevealShot({ v, theta, g, W, color, label, dashed = false, burst = false }: {
  v: number; theta: number; g: number; W: (m: { x: number; y: number }) => [number, number, number];
  color: string; label: string; dashed?: boolean; burst?: boolean;
}) {
  const ball = useRef<Mesh>(null);
  const pts = useMemo(() => arc(v, theta, 60, g).map(W), [v, theta, g, W]);
  const prog = useRef(0);
  const [landed, setLanded] = useState(false);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25) * 1000 // flights keep ~2.5 s even at low fps;
    prog.current = Math.min(1, prog.current + dt / FLIGHT_MS);
    const T = (2 * v * Math.sin((theta * Math.PI) / 180)) / g;
    const p = position(v, theta, T * prog.current, g);
    if (ball.current) ball.current.position.set(...W({ x: p.x, y: Math.max(0, p.y) }));
    if (prog.current >= 1 && !landed) setLanded(true);
  });
  const end = pts[pts.length - 1];
  return (
    <group>
      <Trail points={pts} progress={() => prog.current} color={color} dashed={dashed} size={dashed ? 0.04 : 0.055} />
      {!dashed && (
        <mesh ref={ball} position={pts[0]}>
          <sphereGeometry args={[0.11, 20, 16]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
      {landed && <LandMark id={dashed ? "reveal:ghost" : "reveal:real"} at={end} label={label} color={color} big={!dashed} />}
      {landed && burst && <Confetti position={[end[0], end[1] + 0.2, end[2]]} />}
    </group>
  );
}

function LandMark({ id, at, label, color, dim = false, big = false }: { id: string; at: [number, number, number]; label: string; color: string; dim?: boolean; big?: boolean }) {
  return (
    <group position={at}>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={dim ? 0.4 : 0.9} />
      </mesh>
      <WorldAnchor id={id} position={[0, big ? 0.55 : 0.35, 0]} label={{ text: label, color, variant: big ? "big" : dim ? "dim" : "small" }} />
    </group>
  );
}

function Flag({ at }: { at: [number, number, number] }) {
  return (
    <group position={[at[0], 0, at[2] - 0.15]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.9, 8]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      <mesh position={[0.16, 0.78, 0]}>
        <boxGeometry args={[0.3, 0.18, 0.01]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
    </group>
  );
}

export const ProjectileLauncher: TemplateDef = {
  Scene,
  Overlay,
  hint: () => "Forearm = angle · Hold still to fire",
  avatar: { position: [4.4, -0.1, -2.6], scale: 0.7 },
  still: true,
};

