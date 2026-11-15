"use client";
// src/game/lab/VolcanoLab.tsx: Experiments Lab, the baking-soda volcano. A model volcano on a tray, a jar of baking
// soda, a red food-colouring dropper and a bottle of vinegar. ✊ Grab one, hold it over the crater and tilt your hand
// to pour (powder / drops / liquid). When soda and vinegar meet, CO2 forms and red foam erupts, runs down the cone
// and pools on the tray. Every extra pour that reacts gives a new burst. Code computes the moles, the limiting
// reactant and the litres of CO2 (src/game/experiments.ts). Twins: keys 1 / 2 / 3 or click a label; R = again.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { Color, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import type { Side } from "@/motion/types";
import { useTarget } from "@/motion/targets";
import { ChemText } from "../ChemText";
import { VOLCANO, VOLCANO_MAX_MOL, volcanoState } from "../experiments";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";

type Item = "soda" | "red" | "vinegar";
const ITEMS: Item[] = ["soda", "red", "vinegar"];
const POUR_TILT = 30; // degrees of hand roll from the grab pose
const RATE: Record<Item, number> = { soda: 0.35, red: 3.5, vinegar: 0.3 }; // per second: jar / drops / bottle
const AUTO_STEP: Record<Item, number> = { soda: 0.25, red: 3, vinegar: 0.25 }; // one key press / click
const LIMIT: Record<Item, number> = { soda: 1, red: VOLCANO.maxDrops, vinegar: 1 };

type VState = {
  soda: number; // fraction of the jar poured in
  red: number; // drops added
  vinegar: number; // fraction of the bottle poured in
  held: Record<Side, Item | null>;
  grabTilt: Record<Side, number>;
  auto: { item: Item; until: number } | null;
  reacted: number; // mol already erupted
  erupted: boolean;
  run: number; // bumps on "again" so the 3D scene clears its foam
};
const fresh = (run = 0): VState => ({ soda: 0, red: 0, vinegar: 0, held: { left: null, right: null }, grabTilt: { left: 0, right: 0 }, auto: null, reacted: 0, erupted: false, run });
export const useVolcano = create<VState>(() => fresh());

const HOME: Record<Item, Vector3> = { soda: new Vector3(-2.5, 0, 0.85), red: new Vector3(-1.55, 0, 1.05), vinegar: new Vector3(2.4, 0, 0.85) };
const CONE = { x: 0.2, z: 0.55, r: 1.05, h: 1.15, top: 0.17 }; // the volcano
const CRATER = new Vector3(CONE.x, CONE.h, CONE.z);
const SCREEN: Record<Item | "crater", { x: number; y: number }> = { soda: { x: 0, y: 0 }, red: { x: 0, y: 0 }, vinegar: { x: 0, y: 0 }, crater: { x: 0, y: 0 } };
const NAMES: Record<Item, { formula: string; name: string; key: number }> = {
  soda: { formula: "NaHCO3", name: "baking soda", key: 1 },
  red: { formula: "", name: "red food colouring", key: 2 },
  vinegar: { formula: "CH3COOH", name: "vinegar (acetic acid)", key: 3 },
};

function startAuto(item: Item) {
  const st = useVolcano.getState();
  if (st.auto) return;
  const now = st[item];
  if (now >= LIMIT[item] - 1e-6) return;
  useVolcano.setState({ auto: { item, until: Math.min(LIMIT[item], now + AUTO_STEP[item]) } });
}
const again = () => useVolcano.setState((s) => fresh(s.run + 1));

// ---------------------------------------------------------------- DOM

export function VolcanoOverlay({ onNext }: { onNext: () => void }) {
  const st = useVolcano();
  const [infoRun, setInfoRun] = useState(-1); // the run whose explanation is showing
  const showInfo = st.erupted && infoRun === st.run;
  useEffect(() => useVolcano.setState(fresh()), []);
  useEffect(() => {
    if (!st.erupted) return;
    const run = st.run;
    const id = setTimeout(() => setInfoRun(run), 3000); // watch the eruption first
    return () => clearTimeout(id);
  }, [st.erupted, st.run]);

  useEffect(() => {
    const offs = [
      subscribe("command", (e) => {
        if (e.cmd === "pick" && typeof e.value === "number" && e.value >= 0 && e.value < 3) startAuto(ITEMS[e.value]);
      }),
      subscribe("dwell", (e) => {
        const id = e.targetId ?? "";
        if (e.source !== "gesture" && id.startsWith("volcano:add:")) startAuto(id.slice(12) as Item);
        if (id === "volcano:again") again();
        if (id === "volcano:next" && useVolcano.getState().erupted) onNext();
      }),
      subscribe("bothUp", () => useVolcano.getState().erupted && onNext()),
    ];
    const key = (ev: KeyboardEvent) => {
      if (ev.key === "r" || ev.key === "R") again();
    };
    window.addEventListener("keydown", key);
    return () => {
      offs.forEach((o) => o());
      window.removeEventListener("keydown", key);
    };
  }, [onNext]);

  const v = volcanoState(st.soda, st.vinegar);
  const hint = st.erupted
    ? null
    : st.vinegar > 0 && st.soda === 0
      ? "Vinegar alone just sits there. It needs baking soda to react."
      : st.soda > 0 && st.vinegar === 0
        ? st.red > 0 ? "Good. Now pour in the vinegar (an acid) and stand back!" : "Baking soda is a dry powder. Add a few drops of red colour, then the vinegar."
        : "✊ Grab an item · hold it over the crater · tilt your hand to pour";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex flex-col items-center gap-3 px-6">
        <div className="max-w-[1000px] rounded-2xl border border-magenta/40 bg-navy/90 px-6 py-3 text-center">
          <div className="text-sm text-muted">Experiment · baking-soda volcano</div>
          <div className="font-display text-2xl">🌋 Make the volcano erupt: baking soda, a few drops of red, then vinegar.</div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <Chip ok={st.soda > 0} text={`Baking soda ${v.sodaG.toFixed(1)} g`} />
          <Chip ok={st.red > 0} text={`Red colour ${Math.round(st.red)} drop${Math.round(st.red) === 1 ? "" : "s"}`} />
          <Chip ok={st.vinegar > 0} text={`Vinegar ${Math.round(v.vinegarML)} mL`} />
          {v.reacted > 0 && <Chip ok text={`CO₂ made ${v.co2L.toFixed(2)} L`} tone="lime" />}
        </div>
        {hint && <div className="rounded-full border border-violet/50 bg-navy/85 px-5 py-2 text-lg">{hint}</div>}
      </div>
      <style>{`@keyframes slidein { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }`}</style>
      {ITEMS.map((it, i) => (
        <AddLabel key={it} item={it} pos={i} amount={it === "red" ? `${Math.round(st.red)}/${VOLCANO.maxDrops} drops` : `${Math.round(st[it] * 100)}% used`} full={st[it] >= LIMIT[it] - 1e-6} />
      ))}
      {st.erupted && showInfo && (
        <div className="absolute right-4 top-[13vh] z-50 w-[min(560px,46vw)] animate-[slidein_0.5s_ease-out]">
          <div className="flex max-h-[calc(87vh-140px)] flex-col gap-2 overflow-y-auto rounded-3xl border border-lime/50 bg-navy/95 p-4 shadow-2xl">
            <div className="font-display text-xl text-lime">✓ It erupts! Foamy {st.red > 0 ? "red " : ""}“lava” bubbles over the top.</div>
            <div className="grid grid-cols-2 gap-3">
              <Btn id="volcano:again" title="↺ Again" sub="R · try other amounts" />
              <Btn id="volcano:next" title="Next ▶" sub="✊ / Enter / both hands up" />
            </div>
            <div className="rounded-xl bg-panel px-3 py-1.5 font-display text-lg"><ChemText text={VOLCANO.equation} /></div>
            <ul className="list-disc pl-5 text-base leading-snug text-text">
              <li>Vinegar is an acid (acetic acid). Baking soda is sodium bicarbonate, a base.</li>
              <li>They react and make carbon dioxide gas, CO₂: the same gas you breathe out.</li>
              <li>The gas bubbles push the liquid up and out of the crater: that’s the “lava”.</li>
              <li>{st.red > 0 ? "The red colour is only a dye. It doesn't react; it just colours the foam." : "Add red colour next time: it doesn't react, it just makes the lava red."}</li>
            </ul>
            <div className="rounded-xl border border-line bg-panel px-3 py-2 text-sm">
              You used <b>{v.sodaG.toFixed(1)} g</b> of baking soda ({v.molSoda.toFixed(3)} mol) and <b>{Math.round(v.vinegarML)} mL</b> of vinegar ({v.molAcid.toFixed(3)} mol) →{" "}
              <b className="text-lime">{v.co2L.toFixed(2)} L of CO₂</b>.{" "}
              {v.limiting === "neither" ? "Both ran out together: a perfect 1 : 1 mix." : `The ${v.limiting} ran out first: it's the limiting reactant. Add more ${v.limiting} for a bigger eruption!`}
              <div className="mt-1 text-xs text-muted">Every number here is computed by code from the balanced equation (1 mol NaHCO₃ → 1 mol CO₂, 24.0 L/mol).</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Chip({ ok, text, tone }: { ok: boolean; text: string; tone?: "lime" }) {
  return <span className={`rounded-full border px-3 py-1 ${tone === "lime" ? "border-lime/60 text-lime" : ok ? "border-cyan/60 text-text" : "border-line text-muted"} bg-navy/85`}>{ok ? "✓ " : "· "}{text}</span>;
}

function AddLabel({ item, pos, amount, full }: { item: Item; pos: number; amount: string; full: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `volcano:add:${item}`;
  const mouse = useTarget(id, ref, !full);
  const n = NAMES[item];
  const left = ["6vw", "21vw", "auto"][pos], right = pos === 2 ? "16vw" : "auto";
  return (
    <div ref={ref} {...mouse} role="button" style={{ left, right }}
      className={`pointer-events-auto absolute bottom-[3vh] z-20 w-[210px] cursor-pointer rounded-xl border bg-navy/85 px-3 py-2 text-center ${full ? "border-lime/60 opacity-70" : "border-line"}`}>
      {n.formula ? <ChemText text={n.formula} className="block font-display text-xl" /> : <span className="block font-display text-xl text-coral">● dye</span>}
      <span className="text-sm text-muted">{n.name}</span>
      <span className="block text-xs text-muted">{full ? "✓ all used" : `${n.key} · or click · ${amount}`}</span>
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

// ---------------------------------------------------------------- 3D

const ndc = new Vector3();
function toWorld(x: number, y: number, w: number, h: number, camera: never, z: number, out: Vector3) {
  ndc.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera);
  const cam = (camera as unknown as { position: Vector3 }).position;
  const dir = ndc.sub(cam).normalize();
  return out.copy(cam).addScaledVector(dir, (z - cam.z) / dir.z);
}

const N_FOAM = 240;
const N_FLOW = 7;
const coneY = (r: number) => CONE.h * (1 - Math.min(1, Math.max(0, (r - CONE.top) / (CONE.r - CONE.top))));
const LAVA = new Color("#C8161D"), FOAM = new Color("#FFF4EC");

export function VolcanoScene() {
  const { camera, size } = useThree();
  const items = useRef<Record<Item, Group | null>>({ soda: null, red: null, vinegar: null });
  const stream = useRef<Mesh>(null);
  const drop = useRef<Mesh>(null);
  const craterFill = useRef<Mesh>(null);
  const foam = useRef<InstancedMesh>(null);
  const flows = useRef<(Mesh | null)[]>([]);
  const pool = useRef<Mesh>(null);
  const run = useVolcano((s) => s.run);
  const tmp = useMemo(() => ({ v: new Vector3(), o: new Object3D(), c: new Color() }), []);
  // Particle + flow simulation state: mutated every frame, so it lives in a ref.
  const simRef = useRef({
    p: new Float32Array(N_FOAM * 3), vel: new Float32Array(N_FOAM * 3), life: new Float32Array(N_FOAM), size: new Float32Array(N_FOAM),
    next: 0, energy: 0, flow: new Float32Array(N_FLOW), pool: 0, dropT: 0,
  });
  const flowAngles = useMemo(() => Array.from({ length: N_FLOW }, (_, i) => -Math.PI * 0.95 + (i / (N_FLOW - 1)) * Math.PI * 0.9 + Math.sin(i * 7.3) * 0.12), []);

  // "Again": clear the foam, the flows and the pool.
  useEffect(() => {
    const sim = simRef.current;
    sim.life.fill(0); sim.flow.fill(0); sim.energy = 0; sim.pool = 0;
  }, [run]);

  // Grab with a fist (nearest item to the cursor); open your hand = put it back.
  useEffect(() => {
    const offs = [
      subscribe("grab", (e) => {
        if (!e.side) return;
        const st = useVolcano.getState();
        const c = useGame.getState().cursors[e.side];
        if (!c.visible || st.auto) return;
        for (const it of ITEMS) {
          if (st.held.left === it || st.held.right === it || st[it] >= LIMIT[it] - 1e-6) continue;
          if (Math.hypot(SCREEN[it].x - c.x, SCREEN[it].y - c.y) < 140) {
            useVolcano.setState({ held: { ...st.held, [e.side]: it }, grabTilt: { ...st.grabTilt, [e.side]: useGame.getState().hands[e.side].tilt } });
            playSfx("pop", 0.3);
            return;
          }
        }
      }),
      subscribe("release", (e) => {
        if (!e.side) return;
        const st = useVolcano.getState();
        if (st.held[e.side]) useVolcano.setState({ held: { ...st.held, [e.side]: null } });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  const emit = (n: number) => {
    const sim = simRef.current;
    for (let k = 0; k < n; k++) {
      const i = sim.next;
      sim.next = (sim.next + 1) % N_FOAM;
      const a = Math.random() * Math.PI * 2, out = 0.35 + Math.random() * 0.9, up = 2.2 + Math.random() * 1.8 * (0.6 + sim.energy);
      sim.p[i * 3] = CRATER.x + Math.cos(a) * 0.08; sim.p[i * 3 + 1] = CRATER.y + 0.02; sim.p[i * 3 + 2] = CRATER.z + Math.sin(a) * 0.08;
      sim.vel[i * 3] = Math.cos(a) * out; sim.vel[i * 3 + 1] = up; sim.vel[i * 3 + 2] = Math.sin(a) * out * 0.6;
      sim.life[i] = 3.5 + Math.random() * 2.5; sim.size[i] = 0.05 + Math.random() * 0.07;
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const sim = simRef.current;
    const st = useVolcano.getState();
    const G = useGame.getState();
    let pouring: Item | null = null;
    let lip = new Vector3();

    tmp.v.copy(CRATER).project(camera);
    SCREEN.crater = { x: ((tmp.v.x + 1) / 2) * size.width, y: ((1 - tmp.v.y) / 2) * size.height };

    for (const it of ITEMS) {
      const g = items.current[it];
      if (!g) continue;
      const side = st.held.left === it ? "left" : st.held.right === it ? "right" : null;
      let want = HOME[it].clone();
      let tilt = 0;
      const sign = HOME[it].x < CRATER.x ? -1 : 1;
      if (st.auto?.item === it) {
        want = new Vector3(CRATER.x + sign * 0.55, CRATER.y + 0.45, CRATER.z);
        tilt = sign * 1.7;
        if (g.position.distanceTo(want) < 0.2) pouring = it;
      } else if (side) {
        const c = G.cursors[side];
        if (c.visible) want = toWorld(c.x, c.y, size.width, size.height, camera as never, 1.0, new Vector3());
        want.y = Math.max(0.35, want.y);
        const d = ((G.hands[side].tilt - st.grabTilt[side] + 540) % 360) - 180;
        tilt = (-d * Math.PI) / 180;
        if (Math.hypot(c.x - SCREEN.crater.x, c.y - SCREEN.crater.y) < 170 && Math.abs(d) >= POUR_TILT) pouring = it;
      }
      g.position.lerp(want, Math.min(1, dt * 10));
      g.rotation.z += (tilt - g.rotation.z) * Math.min(1, dt * 8);
      tmp.v.copy(g.position).setY(g.position.y + 0.3).project(camera);
      SCREEN[it] = { x: ((tmp.v.x + 1) / 2) * size.width, y: ((1 - tmp.v.y) / 2) * size.height };
      if (pouring === it) lip = new Vector3(g.position.x - sign * 0.28, g.position.y + 0.3, g.position.z);
    }

    // Pouring: the container empties into the crater (powder / drops / liquid).
    if (pouring && st[pouring] < LIMIT[pouring] - 1e-6) {
      const cap = st.auto?.item === pouring ? st.auto.until : LIMIT[pouring];
      const nextVal = Math.min(cap, st[pouring] + RATE[pouring] * Math.min(rawDt, 0.25));
      const doneAuto = st.auto?.item === pouring && nextVal >= cap - 1e-6;
      const full = nextVal >= LIMIT[pouring] - 1e-6;
      const held = full ? { left: st.held.left === pouring ? null : st.held.left, right: st.held.right === pouring ? null : st.held.right } : st.held;
      useVolcano.setState({ [pouring]: nextVal, auto: doneAuto ? null : st.auto, held } as Partial<VState>);
      if (pouring === "red" && Math.floor(nextVal) > Math.floor(st.red)) playSfx("pop", 0.15);
    } else if (st.auto && st[st.auto.item] >= st.auto.until - 1e-6) useVolcano.setState({ auto: null });

    // The reaction: new CO2 since the last burst → a burst of foam proportional to it.
    const cur = useVolcano.getState();
    const v = volcanoState(cur.soda, cur.vinegar);
    if (v.reacted > cur.reacted + 1e-4) {
      sim.energy = Math.min(1.6, sim.energy + ((v.reacted - cur.reacted) / VOLCANO_MAX_MOL) * 3.2);
      useVolcano.setState({ reacted: v.reacted, erupted: true });
      playSfx("fizz", 0.7);
    }
    if (sim.energy > 0.02) emit(Math.ceil(sim.energy * 110 * dt));
    sim.energy = Math.max(0, sim.energy - dt * 0.28);

    // Stream / drops while pouring.
    const s = stream.current;
    if (s) {
      s.visible = pouring === "soda" || pouring === "vinegar";
      if (s.visible) {
        const bottom = CRATER.clone().setY(CRATER.y + 0.05);
        const len = Math.max(0.05, lip.distanceTo(bottom));
        s.position.copy(lip).add(bottom).multiplyScalar(0.5);
        s.scale.set(pouring === "soda" ? 1.4 : 1, len, pouring === "soda" ? 1.4 : 1);
        s.lookAt(bottom);
        s.rotateX(Math.PI / 2);
        const m = s.material as MeshStandardMaterial;
        m.color.set(pouring === "soda" ? "#FAFAFA" : "#F3EBD3");
        m.opacity = pouring === "soda" ? 0.55 : 0.8;
      }
    }
    const dr = drop.current;
    if (dr) {
      sim.dropT = pouring === "red" ? (sim.dropT + dt * 3.5) % 1 : 0;
      dr.visible = pouring === "red";
      if (dr.visible) dr.position.lerpVectors(lip, CRATER, sim.dropT);
    }

    // Crater contents: white soda heap, pale vinegar, tinted by the dye; hidden by foam once it erupts.
    const cf = craterFill.current;
    if (cf) {
      cf.visible = cur.soda > 0 || cur.vinegar > 0 || cur.red > 0;
      const tint = Math.min(1, cur.red / 2);
      tmp.c.set(cur.vinegar > 0 ? "#F3EBD3" : "#FAFAFA").lerp(LAVA, tint);
      (cf.material as MeshStandardMaterial).color.copy(tmp.c);
    }

    // Foam: up out of the crater, falls, then slides down the cone and pools on the tray.
    const red = Math.min(1, cur.red / 2);
    const fm = foam.current;
    if (fm) {
      for (let i = 0; i < N_FOAM; i++) {
        if (sim.life[i] <= 0) { tmp.o.scale.setScalar(0); tmp.o.updateMatrix(); fm.setMatrixAt(i, tmp.o.matrix); continue; }
        sim.life[i] -= dt;
        let x = sim.p[i * 3], y = sim.p[i * 3 + 1], z = sim.p[i * 3 + 2];
        let vx = sim.vel[i * 3], vy = sim.vel[i * 3 + 1], vz = sim.vel[i * 3 + 2];
        const dx = x - CONE.x, dz = (z - CONE.z) / 0.6, r = Math.hypot(dx, dz);
        const surface = r < CONE.r ? coneY(r) : 0.02;
        vy -= 7.5 * dt;
        if (y <= surface + sim.size[i] && vy < 0) {
          // On the slope: slide outward and down, with drag (foam is sticky).
          y = surface + sim.size[i];
          const ox = r > 1e-3 ? dx / r : Math.random() - 0.5, oz = r > 1e-3 ? dz / r : Math.random() - 0.5;
          const slide = r < CONE.r ? 0.9 : 0.15;
          vx = vx * 0.86 + ox * slide * dt * 9; vz = vz * 0.86 + oz * slide * dt * 9 * 0.6; vy = 0;
        }
        x += vx * dt; y += vy * dt; z += vz * dt;
        sim.p[i * 3] = x; sim.p[i * 3 + 1] = y; sim.p[i * 3 + 2] = z;
        sim.vel[i * 3] = vx; sim.vel[i * 3 + 1] = vy; sim.vel[i * 3 + 2] = vz;
        const fade = Math.min(1, sim.life[i] / 1.2);
        tmp.o.position.set(x, y, z);
        tmp.o.scale.setScalar(sim.size[i] * (0.6 + fade * 0.6));
        tmp.o.updateMatrix();
        fm.setMatrixAt(i, tmp.o.matrix);
        tmp.c.copy(FOAM).lerp(LAVA, red * (0.78 + ((i * 37) % 10) / 45));
        fm.setColorAt(i, tmp.c);
      }
      fm.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
    }

    // Lava streams down the sides and a pool on the tray, growing with each burst.
    const grow = sim.energy * dt * 0.55;
    for (let k = 0; k < N_FLOW; k++) {
      sim.flow[k] = Math.min(1, sim.flow[k] + grow * (0.7 + ((k * 13) % 7) / 10));
      const m = flows.current[k];
      if (!m) continue;
      const f = sim.flow[k];
      m.visible = f > 0.01;
      if (!m.visible) continue;
      const a = flowAngles[k];
      const r1 = CONE.top + (CONE.r - CONE.top) * f;
      const midR = (CONE.top + r1) / 2;
      m.position.set(CONE.x + Math.cos(a) * midR, coneY(midR) + 0.03, CONE.z + Math.sin(a) * midR * 0.6);
      const len = Math.hypot(r1 - CONE.top, coneY(CONE.top) - coneY(r1));
      m.scale.set(1, Math.max(0.01, len), 1);
      m.lookAt(new Vector3(CONE.x + Math.cos(a) * r1, coneY(r1) + 0.03, CONE.z + Math.sin(a) * r1 * 0.6));
      m.rotateX(Math.PI / 2);
      (m.material as MeshStandardMaterial).color.copy(FOAM).lerp(LAVA, red);
    }
    sim.pool = Math.min(1, sim.pool + grow * 0.6);
    const pl = pool.current;
    if (pl) {
      pl.visible = sim.pool > 0.02;
      pl.scale.set(CONE.r + 0.15 + sim.pool * 0.45, 1, (CONE.r + 0.15 + sim.pool * 0.45) * 0.6);
      (pl.material as MeshStandardMaterial).color.copy(FOAM).lerp(LAVA, red * 0.95);
    }
  });

  return (
    <group>
      {/* Bench */}
      <mesh position={[0, -0.05, 0.6]} receiveShadow>
        <boxGeometry args={[9, 0.1, 2.6]} />
        <meshStandardMaterial color="#E5E7EB" roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.52, 0.65]}>
        <boxGeometry args={[8.8, 0.85, 2.4]} />
        <meshStandardMaterial color="#E9DCC6" roughness={0.8} />
      </mesh>
      {/* Tray */}
      <mesh position={[CONE.x, 0.015, CONE.z]} scale={[1, 1, 0.6]}>
        <cylinderGeometry args={[CONE.r + 0.75, CONE.r + 0.8, 0.05, 48]} />
        <meshStandardMaterial color="#AEB6C2" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={pool} position={[CONE.x, 0.045, CONE.z]} visible={false}>
        <cylinderGeometry args={[1, 1, 0.02, 40]} />
        <meshStandardMaterial color="#D7261E" roughness={0.6} />
      </mesh>
      {/* Volcano: a clay cone with an open crater */}
      <group position={[CONE.x, 0, CONE.z]} scale={[1, 1, 0.6]}>
        <mesh position={[0, CONE.h / 2 + 0.04, 0]} castShadow>
          <cylinderGeometry args={[CONE.top, CONE.r, CONE.h, 40, 6, true]} />
          <meshStandardMaterial color="#8A5A36" roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, CONE.h + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[CONE.top * 0.6, CONE.top, 32]} />
          <meshStandardMaterial color="#5A3820" roughness={1} />
        </mesh>
        <mesh ref={craterFill} position={[0, CONE.h, 0]} visible={false}>
          <cylinderGeometry args={[CONE.top * 0.62, CONE.top * 0.62, 0.04, 24]} />
          <meshStandardMaterial color="#FAFAFA" roughness={0.6} />
        </mesh>
      </group>
      {/* Lava streams */}
      {Array.from({ length: N_FLOW }, (_, k) => (
        <mesh key={k} ref={(el) => void (flows.current[k] = el)} visible={false}>
          <cylinderGeometry args={[0.07, 0.11, 1, 10]} />
          <meshStandardMaterial color="#D7261E" roughness={0.55} />
        </mesh>
      ))}
      {/* Foam */}
      <instancedMesh ref={foam} args={[undefined, undefined, N_FOAM]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      {/* Baking soda jar */}
      <group ref={(el) => void (items.current.soda = el)} position={HOME.soda.toArray()}>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.44, 28, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.35} roughness={0.05} side={2} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.24, 28]} />
          <meshStandardMaterial color="#FAFAFA" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.25, 0.262]}>
          <planeGeometry args={[0.36, 0.14]} />
          <meshStandardMaterial color="#F97316" />
        </mesh>
      </group>
      {/* Red food colouring dropper bottle */}
      <group ref={(el) => void (items.current.red = el)} position={HOME.red.toArray()}>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.26, 20]} />
          <meshStandardMaterial color="#B91C1C" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <coneGeometry args={[0.06, 0.12, 16]} />
          <meshStandardMaterial color="#F8FAFC" />
        </mesh>
      </group>
      {/* Vinegar bottle */}
      <group ref={(el) => void (items.current.vinegar = el)} position={HOME.vinegar.toArray()}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.6, 28, 1, true]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} roughness={0.05} side={2} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.185, 0.185, 0.48, 28]} />
          <meshStandardMaterial color="#F3EBD3" transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.06, 0.12, 0.22, 20]} />
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.4} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0.3, 0.205]}>
          <planeGeometry args={[0.28, 0.18]} />
          <meshStandardMaterial color="#FDE68A" />
        </mesh>
      </group>
      {/* Pour stream and a falling drop */}
      <mesh ref={stream} visible={false}>
        <cylinderGeometry args={[0.03, 0.045, 1, 12]} />
        <meshStandardMaterial color="#F3EBD3" transparent opacity={0.8} />
      </mesh>
      <mesh ref={drop} visible={false}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#DC2626" emissive="#DC2626" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}
