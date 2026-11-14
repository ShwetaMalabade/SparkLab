"use client";
// src/game/lab/PourLab.tsx: pour two liquids into a flask with your hands, see it happen, then learn why.
// ✊ close your hand on a beaker to pick it up → hold it over the flask → tilt your hand: a stream pours and the
// flask fills. Open your hand anywhere else and the beaker goes back. When both are in, the reaction plays
// (precipitate / colour change / bubbles) and an info card explains it. Twins: keys 1 / 2 (or click a label) pour.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Color, Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { Side } from "@/motion/types";
import { useTarget } from "@/motion/targets";
import { Bubbles, type Place } from "@/three/effects/Bubbles";
import { Precipitate } from "@/three/effects/Precipitate";
import { ChemText } from "../ChemText";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";
import type { PourExperiment } from "./lessons";

const POUR_TILT = 30; // degrees of hand roll from the grab pose
const POUR_RATE = 0.7; // beaker fraction per second while pouring

type PState = {
  left: number; // liquid left in beaker A / B (0..1)
  right: number;
  flask: number; // flask fill (0..1)
  poured: { a: boolean; b: boolean };
  reacted: boolean;
  held: Record<Side, "a" | "b" | null>;
  grabTilt: Record<Side, number>;
  auto: "a" | "b" | null; // keyboard / mouse auto-pour in progress
  queued: "a" | "b" | null; // asked for while another pour was running
};
const fresh = (): PState => ({ left: 1, right: 1, flask: 0, poured: { a: false, b: false }, reacted: false, held: { left: null, right: null }, grabTilt: { left: 0, right: 0 }, auto: null, queued: null });
export const usePour = create<PState>(() => fresh());

const HOME = { a: new Vector3(-2.3, 0, 0.7), b: new Vector3(2.3, 0, 0.7) };
const FLASK = new Vector3(0, 0, 0.7);
const SCREEN = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, flask: { x: 0, y: 0 } };

function startPour(which: "a" | "b") {
  const st = usePour.getState();
  if (st.poured[which] || st.reacted || st.auto === which) return;
  if (st.auto) return usePour.setState({ queued: which }); // runs right after the current pour
  usePour.setState({ auto: which });
}

// ---------------------------------------------------------------- DOM

export function PourOverlay({ x, onNext }: { x: PourExperiment; onNext: () => void }) {
  const reacted = usePour((s) => s.reacted);
  const poured = usePour((s) => s.poured);
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => usePour.setState(fresh()), [x]);
  // Watch the reaction first; the explanation slides in after 2.5 s.
  useEffect(() => {
    if (!reacted) return;
    const id = setTimeout(() => setShowInfo(true), 2500);
    return () => {
      clearTimeout(id);
      setShowInfo(false);
    };
  }, [reacted]);

  useEffect(() => {
    const offs = [
      subscribe("command", (e) => {
        if (e.cmd === "pick" && e.value === 0) startPour("a");
        if (e.cmd === "pick" && e.value === 1) startPour("b");
      }),
      subscribe("dwell", (e) => {
        if (e.source === "gesture") return; // gestures grab + tilt; clicks / keys auto-pour
        if (e.targetId === "pour:a") startPour("a");
        if (e.targetId === "pour:b") startPour("b");
        if (e.targetId === "pour:next" && usePour.getState().reacted) onNext();
      }),
      subscribe("dwell", (e) => e.source === "gesture" && e.targetId === "pour:next" && usePour.getState().reacted && onNext()),
      subscribe("bothUp", () => usePour.getState().reacted && onNext()),
    ];
    return () => offs.forEach((o) => o());
  }, [onNext]);

  const r = x.result;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex flex-col items-center gap-3 px-6">
        <div className="max-w-[1000px] rounded-2xl border border-magenta/40 bg-navy/90 px-6 py-3 text-center font-display text-2xl">{x.prompt}</div>
        {!reacted && (
          <div className="rounded-full border border-violet/50 bg-navy/85 px-5 py-2 text-lg">
            ✊ Grab a beaker · hold it over the flask · tilt your hand to pour <span className="text-muted">(keys 1 / 2)</span>
          </div>
        )}
      </div>
      <style>{`@keyframes slidein { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }`}</style>
      <Label id="pour:a" side="left" l={x.a} done={poured.a} n={1} />
      <Label id="pour:b" side="right" l={x.b} done={poured.b} n={2} />
      {reacted && showInfo && (
        <div className="absolute right-4 top-[16vh] z-30 w-[min(560px,46vw)] animate-[slidein_0.5s_ease-out]">
          <div className="flex flex-col gap-3 rounded-3xl border border-lime/50 bg-navy/92 p-5 shadow-2xl">
            <div className="flex flex-col gap-2">
              <div className="font-display text-2xl text-lime">✓ {r.observation}</div>
              <div className="rounded-xl bg-panel px-3 py-2 font-display text-2xl"><ChemText text={r.equation} /></div>
              <ul className="list-disc pl-6 text-lg leading-snug text-text">
                {r.why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              {r.hazard && <div className="text-amber">⚠️ In real life: {r.hazard}. <b>Virtual only.</b></div>}
            </div>
            <NextBtn />
          </div>
        </div>
      )}
    </>
  );
}

function Label({ id, side, l, done, n }: { id: string; side: "left" | "right"; l: PourExperiment["a"]; done: boolean; n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref, !done);
  return (
    <div ref={ref} {...mouse} role="button"
      className={`pointer-events-auto absolute top-[64vh] z-20 w-[230px] cursor-pointer rounded-xl border bg-navy/85 px-3 py-2 text-center ${side === "left" ? "left-[14vw]" : "right-[14vw]"} ${done ? "border-lime/60 opacity-70" : "border-line"}`}>
      <ChemText text={l.formula} className="block font-display text-2xl" />
      <span className="text-sm text-muted">{l.name}</span>
      <span className="block text-xs text-muted">{done ? "✓ poured in" : `${n} · or click to pour`}</span>
    </div>
  );
}

function NextBtn() {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget("pour:next", ref);
  return (
    <div ref={ref} {...mouse} role="button" className="pointer-events-auto grid h-[110px] cursor-pointer place-items-center rounded-2xl border-2 border-lime/70 text-center text-lime">
      <span className="font-display text-2xl">Next ▶</span>
      <span className="text-xs text-muted">✊ / Enter / both hands up</span>
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

export function PourScene({ x }: { x: PourExperiment }) {
  const { camera, size } = useThree();
  const beakers = useRef<Record<"a" | "b", Group | null>>({ a: null, b: null });
  const liquids = useRef<Record<"a" | "b", Mesh | null>>({ a: null, b: null });
  const stream = useRef<Mesh>(null);
  const flaskLiquid = useRef<Mesh>(null);
  const tmp = useMemo(() => ({ v: new Vector3(), p: new Vector3() }), []);
  const reacted = usePour((s) => s.reacted);
  const startColor = useMemo(() => new Color(x.a.color), [x]);
  const endColor = useMemo(() => new Color(x.result.kind === "color" ? x.result.color : x.a.color), [x]);
  const react = useRef(0);

  // Grab a beaker with a fist (nearest to the cursor); open the hand = put it back.
  useEffect(() => {
    const offs = [
      subscribe("grab", (e) => {
        if (!e.side) return;
        const st = usePour.getState();
        const c = useGame.getState().cursors[e.side];
        if (!c.visible || st.reacted || st.auto) return;
        for (const w of ["a", "b"] as const) {
          if (st.poured[w] || st.held.left === w || st.held.right === w) continue;
          if (Math.hypot(SCREEN[w].x - c.x, SCREEN[w].y - c.y) < 140) {
            usePour.setState({ held: { ...st.held, [e.side]: w }, grabTilt: { ...st.grabTilt, [e.side]: useGame.getState().hands[e.side].tilt } });
            playSfx("pop", 0.3);
            return;
          }
        }
      }),
      subscribe("release", (e) => {
        if (!e.side) return;
        const st = usePour.getState();
        if (st.held[e.side]) usePour.setState({ held: { ...st.held, [e.side]: null } });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = usePour.getState();
    const G = useGame.getState();
    let pouringNow: "a" | "b" | null = null;
    let lip = tmp.p.set(0, 0, 0);

    // Flask on screen (for "over the flask").
    tmp.v.copy(FLASK).setY(0.6).project(camera);
    SCREEN.flask = { x: ((tmp.v.x + 1) / 2) * size.width, y: ((1 - tmp.v.y) / 2) * size.height };

    for (const w of ["a", "b"] as const) {
      const g = beakers.current[w];
      if (!g) continue;
      const side = st.held.left === w ? "left" : st.held.right === w ? "right" : null;
      let want = HOME[w].clone();
      let tilt = 0;
      if (st.auto === w) {
        // Keyboard / click: lift over the flask and tip it.
        want = new Vector3(w === "a" ? -0.75 : 0.75, 1.3, FLASK.z);
        tilt = (w === "a" ? -1 : 1) * 1.6;
        if (g.position.distanceTo(want) < 0.2) pouringNow = w;
      } else if (side) {
        const c = G.cursors[side];
        if (c.visible) want = toWorld(c.x, c.y, size.width, size.height, camera as never, 1.0, new Vector3());
        want.y = Math.max(0.3, want.y);
        const d = ((G.hands[side].tilt - st.grabTilt[side] + 540) % 360) - 180; // follows your real hand roll
        tilt = (-d * Math.PI) / 180;
        const over = Math.hypot(c.x - SCREEN.flask.x, c.y - SCREEN.flask.y) < 170;
        if (over && Math.abs(d) >= POUR_TILT) pouringNow = w;
      }
      g.position.lerp(want, Math.min(1, dt * 10));
      g.rotation.z += (tilt - g.rotation.z) * Math.min(1, dt * 8);
      tmp.v.copy(g.position).setY(g.position.y + 0.3).project(camera);
      SCREEN[w] = { x: ((tmp.v.x + 1) / 2) * size.width, y: ((1 - tmp.v.y) / 2) * size.height };
      const level = w === "a" ? st.left : st.right;
      const lq = liquids.current[w];
      if (lq) {
        lq.scale.y = Math.max(0.02, level);
        lq.position.y = 0.2 * Math.max(0.02, level); // drains from the top, stays on the bottom
        lq.visible = level > 0.02;
      }
      if (pouringNow === w) lip = new Vector3(g.position.x + (w === "a" ? 0.25 : -0.25), g.position.y + 0.35, g.position.z);
    }

    // Pour: stream from the beaker lip to the flask mouth; beaker empties, flask fills.
    if (pouringNow) {
      const key = pouringNow === "a" ? "left" : "right";
      const pdt = Math.min(rawDt, 0.25); // real time, so a pour takes ~1.5 s even on a slow machine
      const left = Math.max(0, st[key] - POUR_RATE * pdt);
      const flask = Math.min(1, st.flask + POUR_RATE * pdt * 0.5);
      const done = left <= 0.01;
      const poured = done ? { ...st.poured, [pouringNow]: true } : st.poured;
      const held = done ? { left: st.held.left === pouringNow ? null : st.held.left, right: st.held.right === pouringNow ? null : st.held.right } : st.held;
      const finishedAuto = done && st.auto === pouringNow;
      usePour.setState({
        [key]: left, flask, poured, held,
        auto: finishedAuto ? (st.queued && !poured[st.queued] ? st.queued : null) : st.auto,
        queued: finishedAuto ? null : st.queued,
      } as Partial<PState>);
      if (done) playSfx("pop", 0.35);
      if (poured.a && poured.b && !st.reacted) {
        usePour.setState({ reacted: true });
        playSfx(x.result.kind === "bubbles" ? "fizz" : "correct", 0.6);
      }
    }
    const s = stream.current;
    if (s) {
      s.visible = !!pouringNow;
      if (pouringNow) {
        const top = lip, bottom = new Vector3(FLASK.x, 0.95, FLASK.z);
        const len = Math.max(0.05, top.distanceTo(bottom));
        s.position.copy(top).add(bottom).multiplyScalar(0.5);
        s.scale.set(1, len, 1);
        s.lookAt(bottom);
        s.rotateX(Math.PI / 2);
        (s.material as MeshStandardMaterial).color.set(pouringNow === "a" ? x.a.color : x.b.color);
      }
    }
    // Flask liquid rises; after the reaction the colour changes over 1.5 s.
    react.current = st.reacted ? Math.min(1, react.current + dt / 1.5) : 0;
    const fl = flaskLiquid.current;
    if (fl) {
      fl.visible = st.flask > 0.02;
      fl.scale.y = Math.max(0.02, st.flask);
      fl.position.y = 0.04 + 0.22 * st.flask;
      (fl.material as MeshStandardMaterial).color.copy(startColor).lerp(endColor, react.current);
      (fl.material as MeshStandardMaterial).emissiveIntensity = 0.1 + react.current * 0.3 * (x.result.kind === "color" ? 1 : 0);
    }
    void clock;
  });

  const at = (): Place => ({ origin: [FLASK.x, 0.05, FLASK.z], radius: 0.4, height: 0.45 });
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
      {/* Flask */}
      <group position={[FLASK.x, 0, FLASK.z]}>
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.17, 0.5, 0.64, 36, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.25} roughness={0.05} side={2} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <cylinderGeometry args={[0.14, 0.16, 0.3, 24, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.25} side={2} />
        </mesh>
        <mesh ref={flaskLiquid} position={[0, 0.04, 0]} visible={false}>
          <cylinderGeometry args={[0.36, 0.47, 0.44, 36]} />
          <meshStandardMaterial color={x.a.color} emissive={x.result.color} emissiveIntensity={0.1} transparent opacity={0.85} roughness={0.2} />
        </mesh>
      </group>
      {/* Beakers */}
      {(["a", "b"] as const).map((w) => (
        <group key={w} ref={(el) => void (beakers.current[w] = el)} position={HOME[w].toArray()}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.24, 0.23, 0.6, 28, 1, true]} />
            <meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} roughness={0.05} side={2} />
          </mesh>
          <group position={[0, 0.02, 0]}>
            <mesh ref={(el) => void (liquids.current[w] = el)} position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.21, 0.21, 0.4, 28]} />
              <meshStandardMaterial color={w === "a" ? x.a.color : x.b.color} transparent opacity={0.8} />
            </mesh>
          </group>
        </group>
      ))}
      {/* The pouring stream */}
      <mesh ref={stream} visible={false}>
        <cylinderGeometry args={[0.035, 0.05, 1, 12]} />
        <meshStandardMaterial color="#BAE6FD" transparent opacity={0.85} emissive="#BAE6FD" emissiveIntensity={0.2} />
      </mesh>
      {/* Reaction */}
      {x.result.kind === "precipitate" && <Precipitate at={at} color={x.result.color} active={reacted} />}
      {x.result.kind === "bubbles" && <Bubbles at={at} active={reacted} />}
    </group>
  );
}
