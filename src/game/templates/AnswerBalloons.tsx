"use client";
// src/game/templates/AnswerBalloons.tsx: G1 Answer Balloons (docs/plan/05 §5), the generic template.
// 4 balloons in a row, ≥ 220 px wide, ≥ 60 px apart, kept between 35% and 75% of the screen height
// (never the top third, so raising both hands doesn't sweep the cursors through them).
// Pick: dwell 800 ms with either hand, or lean L/R to move the highlight + both hands up. Keys 1–4 or ←/→ + Enter.
// The DOM card is the dwell target (exact px layout + mouse twin); the 3D balloon is placed behind it every frame.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { Color, Mesh, MeshStandardMaterial, Vector3, type Camera } from "three";
import type { TQuestion } from "@/lib/schema";
import { getTargetRect, useTarget } from "@/motion/targets";
import type { InputSource } from "@/motion/types";
import { Burst } from "@/three/effects/Burst";
import { subscribe, useGame, type LockResult } from "../store";
import type { TemplateDef, TemplateProps } from "./types";

type ChoiceId = "A" | "B" | "C" | "D";
const IDS: ChoiceId[] = ["A", "B", "C", "D"];
const targetId = (id: ChoiceId) => `choice:${id}`;
const BALLOON_COLORS = ["#22D3EE", "#A78BFA", "#E879F9", "#60A5FA"];
const LIME = "#A3E635";
const CORAL = "#FB7185";

/** Shared between the DOM overlay and the 3D scene. */
const useBalloons = create<{ highlight: number | null }>(() => ({ highlight: null }));
/** Latest world position of each balloon, so effects can spawn at the right spot. */
const balloonWorld = new Map<ChoiceId, Vector3>();

// ---------------------------------------------------------------- DOM overlay (targets + labels + input)

function Overlay({ question, phase, paused, onLock }: TemplateProps) {
  const highlight = useBalloons((s) => s.highlight);
  const lastResult = useGame((s) => s.lastResult);
  const interactive = phase === "play" && !paused;

  // Live values for the bus handlers (subscribed once).
  const live = useRef({ question, interactive, onLock, locked: false, trace: [] as LockResult["hoverTrace"] });
  useEffect(() => {
    live.current.question = question;
    live.current.interactive = interactive;
    live.current.onLock = onLock;
  });
  useEffect(() => {
    live.current.locked = false;
    live.current.trace = [];
    useBalloons.setState({ highlight: null });
  }, [question.id]);

  useEffect(() => {
    const lock = (idx: number, input: InputSource) => {
      const L = live.current;
      if (!L.interactive || L.locked) return;
      const c = L.question.choices[idx];
      if (!c) return;
      L.locked = true;
      const result: LockResult = {
        chosen: c.id, chosenText: c.text, correct: c.correct, misconceptionId: c.misconceptionId,
        input, hoverTrace: L.trace.slice(-20),
      };
      console.info("[balloons] lock-in", result);
      L.onLock(result);
    };
    const offs = [
      subscribe("dwell", (e) => {
        const idx = IDS.findIndex((id) => targetId(id) === e.targetId);
        if (idx >= 0) lock(idx, e.source === "mouse" ? "mouse" : "gesture");
      }),
      subscribe("hover", (e) => {
        const id = IDS.find((x) => targetId(x) === e.targetId);
        if (id && live.current.interactive && !live.current.locked && e.ms) live.current.trace.push({ choice: id, ms: e.ms });
      }),
      subscribe("lean", (e) => {
        if (!live.current.interactive || live.current.locked) return;
        const h = useBalloons.getState().highlight;
        const next = h === null ? (e.side === "left" ? 3 : 0) : Math.min(3, Math.max(0, h + (e.side === "left" ? -1 : 1)));
        useBalloons.setState({ highlight: next });
      }),
      subscribe("bothUp", (e) => {
        const h = useBalloons.getState().highlight;
        if (h !== null) lock(h, e.source);
      }),
      subscribe("command", (e) => {
        if (e.cmd === "pick" && e.value !== undefined) lock(e.value, e.source);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const revealing = (phase === "reveal" || phase === "next") && !!lastResult;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[37vh] z-20 flex h-[34vh] items-center justify-center gap-[60px] px-6">
      {question.choices.map((c, i) => (
        <BalloonCard
          key={c.id}
          id={c.id}
          text={c.text}
          index={i}
          interactive={interactive}
          highlighted={highlight === i && !revealing}
          state={!revealing ? "idle" : c.correct ? "correct" : lastResult!.chosen === c.id ? "wrong" : "dim"}
        />
      ))}
    </div>
  );
}

function BalloonCard({ id, text, index, interactive, highlighted, state }: {
  id: ChoiceId; text: string; index: number; interactive: boolean; highlighted: boolean;
  state: "idle" | "correct" | "wrong" | "dim";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(targetId(id), ref, interactive);
  const hovered = useGame((s) => s.cursors.left.targetId === targetId(id) || s.cursors.right.targetId === targetId(id));
  const ring =
    state === "correct" ? "ring-4 ring-lime" : state === "wrong" ? "ring-4 ring-coral" : highlighted ? "ring-4 ring-violet" : hovered ? "ring-2 ring-text/70" : "";
  return (
    <div
      ref={ref}
      {...mouse}
      role="button"
      aria-label={`Answer ${id}: ${text}`}
      className={`pointer-events-auto relative flex aspect-[1/1.12] h-full max-h-[300px] min-w-[220px] cursor-pointer select-none flex-col items-center justify-center rounded-full px-5 text-center transition-[opacity,box-shadow] duration-300 ${ring} ${
        state === "dim" ? "opacity-40" : "opacity-100"
      }`}
    >
      <span className="mb-1 grid h-9 w-9 place-items-center rounded-full bg-navy/70 font-display text-lg font-bold">
        {state === "correct" ? "✓" : state === "wrong" ? "✗" : id}
      </span>
      <span className="font-display text-[clamp(20px,1.9vw,28px)] font-bold leading-tight text-white [text-shadow:0_2px_10px_rgb(11_16_32/0.9)]">
        {text}
      </span>
      <span className="sr-only">Key {index + 1}</span>
      {state === "correct" && <span className="absolute -bottom-8 rounded-full bg-lime px-3 py-0.5 text-sm font-bold text-navy">✓ Correct</span>}
      {state === "wrong" && <span className="absolute -bottom-8 rounded-full bg-coral px-3 py-0.5 text-sm font-bold text-navy">✗ Your pick</span>}
    </div>
  );
}

// ---------------------------------------------------------------- 3D scene (balloons behind the cards)

function Scene({ question, phase }: TemplateProps) {
  const lastResult = useGame((s) => s.lastResult);
  const revealing = (phase === "reveal" || phase === "next") && !!lastResult;
  const chosen = revealing ? (lastResult!.chosen as ChoiceId) : null;
  const burstAt = chosen ? balloonWorld.get(chosen) : undefined;

  return (
    <group>
      {question.choices.map((c, i) => (
        <BalloonMesh
          key={c.id}
          id={c.id}
          index={i}
          color={BALLOON_COLORS[i]}
          state={!revealing ? "idle" : c.correct ? "correct" : chosen === c.id ? "wrong" : "dim"}
        />
      ))}
      {revealing && burstAt && (
        <Burst
          key={`${question.id}-burst`}
          position={[burstAt.x, burstAt.y, burstAt.z]}
          colors={lastResult!.correct ? [LIME, "#22D3EE", "#E879F9", "#FBBF24", "#ffffff"] : [CORAL, "#fda4af"]}
          count={lastResult!.correct ? 160 : 70}
          speed={lastResult!.correct ? 4 : 2.6}
        />
      )}
    </group>
  );
}

const PLANE_Z = 0.6;
const ndc = new Vector3();
function screenToPlane(x: number, y: number, w: number, h: number, camera: Camera, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const dist = (PLANE_Z - camera.position.z) / dir.z;
  return out.copy(camera.position).addScaledVector(dir, dist);
}

function BalloonMesh({ id, index, color, state }: { id: ChoiceId; index: number; color: string; state: "idle" | "correct" | "wrong" | "dim" }) {
  const body = useRef<Mesh>(null);
  const string = useRef<Mesh>(null);
  const ring = useRef<Mesh>(null);
  const { camera, size } = useThree();
  const tmp = useMemo(() => ({ c: new Vector3(), e: new Vector3() }), []);
  const bob = useRef(index * 1.7);
  const pop = useRef(1);
  const base = useMemo(() => new Color(color), [color]);
  const target = useMemo(() => new Color(), []);

  useFrame((_, dt) => {
    const m = body.current;
    if (!m) return;
    const rect = getTargetRect(targetId(id));
    if (!rect) {
      m.visible = false;
      return;
    }
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.46;
    screenToPlane(cx, cy, size.width, size.height, camera, tmp.c);
    screenToPlane(rect.x + rect.w, cy, size.width, size.height, camera, tmp.e);
    const radius = tmp.c.distanceTo(tmp.e) * 0.92;

    // <Float>-style bob, frozen while a cursor is inside (so dwell doesn't drift off).
    const cur = useGame.getState().cursors;
    const hovered = cur.left.targetId === targetId(id) || cur.right.targetId === targetId(id);
    if (!hovered && state === "idle") bob.current += dt;
    const y = tmp.c.y + Math.sin(bob.current * 1.4) * radius * 0.05;

    // Wrong pick pops (shrinks away); everything else eases back to full size.
    pop.current += ((state === "wrong" ? 0 : 1) - pop.current) * Math.min(1, dt * (state === "wrong" ? 7 : 4));
    m.visible = pop.current > 0.02;
    m.position.set(tmp.c.x, y, PLANE_Z);
    m.scale.set(radius * pop.current, radius * 1.12 * pop.current, radius * pop.current);
    balloonWorld.set(id, (balloonWorld.get(id) ?? new Vector3()).set(tmp.c.x, y, PLANE_Z));

    const mat = m.material as MeshStandardMaterial;
    target.set(state === "correct" ? LIME : state === "wrong" ? CORAL : base);
    mat.color.lerp(target, Math.min(1, dt * 6));
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = state === "correct" ? 1.1 : hovered ? 0.75 : 0.45;
    mat.opacity = state === "dim" ? 0.25 : 0.88;

    if (string.current) {
      string.current.visible = m.visible && state !== "dim";
      string.current.position.set(tmp.c.x, y - radius * 1.12 - radius * 0.55, PLANE_Z);
      string.current.scale.set(1, radius * 1.1, 1);
    }
    if (ring.current) {
      const show = useBalloons.getState().highlight === index && state === "idle";
      ring.current.visible = show;
      ring.current.position.set(tmp.c.x, y, PLANE_Z + 0.01);
      ring.current.scale.setScalar(radius * 1.25);
    }
  });

  return (
    <>
      <mesh ref={body}>
        <sphereGeometry args={[1, 40, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.22} metalness={0.05} transparent opacity={0.88} />
      </mesh>
      <mesh ref={string}>
        <cylinderGeometry args={[0.008, 0.008, 1, 6]} />
        <meshBasicMaterial color="#94A3B8" transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring} visible={false}>
        <torusGeometry args={[1, 0.035, 12, 64]} />
        <meshBasicMaterial color="#A78BFA" toneMapped={false} />
      </mesh>
    </>
  );
}

// ----------------------------------------------------------------

export const AnswerBalloons: TemplateDef = {
  Scene,
  Overlay,
  hint: (q: TQuestion) => {
    void q;
    return "Hover on an answer · or lean and raise both hands";
  },
};
