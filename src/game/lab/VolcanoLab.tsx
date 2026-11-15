"use client";
// src/game/lab/VolcanoLab.tsx: Experiments Lab, the baking-soda volcano (guided). A model volcano on a tray, a jar of
// baking soda, a red food-colouring dropper and a bottle of vinegar. Steps unlock one at a time (benchKit guide):
// soda → red → vinegar → watch. When soda and vinegar meet, CO2 forms and red foam erupts, runs down the cone and
// pools on the tray; every later pour that reacts gives another burst. Code computes the moles, the limiting reactant
// and the litres of CO2 (src/game/experiments.ts).
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { VOLCANO, VOLCANO_MAX_MOL, volcanoState } from "../experiments";
import { playSfx } from "../sfx";
import { autoPour, BenchItems, ExpHeader, GuidePanel, ItemLabels, resetBench, ResultCard, setFlag, useBench, useDelayedCard, useExpKeys, useGuide, type BenchItem, type Step } from "./benchKit";

const ITEMS: BenchItem[] = [
  { id: "soda", name: "baking soda", formula: "NaHCO3", kind: "powder", look: "jar", home: [-2.5, 0, 0.85], color: "#FAFAFA", rate: 0.35, step: 0.25, limit: 1, unit: (v) => `${(v * VOLCANO.sodaJarG).toFixed(1)} g` },
  { id: "red", name: "red food colouring", kind: "drops", look: "dropper", home: [-1.55, 0, 1.05], color: "#DC2626", rate: 3.5, step: 3, limit: VOLCANO.maxDrops, unit: (v) => `${Math.round(v)}/${VOLCANO.maxDrops} drops` },
  { id: "vinegar", name: "vinegar (acetic acid)", formula: "CH3COOH", kind: "liquid", look: "bottle", home: [2.4, 0, 0.85], color: "#F3EBD3", rate: 0.3, step: 0.25, limit: 1, unit: (v) => `${Math.round(v * VOLCANO.vinegarBottleML)} mL` },
];
const STEPS: Step[] = [
  { text: "Spoon baking soda into the crater", item: "soda", why: "Baking soda is sodium bicarbonate (NaHCO₃), a base.", done: (b) => (b.amounts.soda ?? 0) >= 0.2 },
  { text: "Add a few drops of red food colouring", item: "red", why: "The dye won't react: it only colours the lava.", done: (b) => (b.amounts.red ?? 0) >= 3 },
  { text: "Pour in the vinegar", item: "vinegar", why: "Vinegar is acetic acid. Acid + bicarbonate makes CO₂ gas.", done: (b) => (b.amounts.vinegar ?? 0) >= 0.2 },
  { text: "Watch the eruption!", why: "The CO₂ bubbles push the foamy liquid up and out of the crater.", done: (b) => !!b.flags.erupted },
];

const CONE = { x: 0.2, z: 0.55, r: 1.05, h: 1.15, top: 0.17 };
const CRATER = new Vector3(CONE.x, CONE.h, CONE.z);
const N_FOAM = 240;
const N_FLOW = 7;
const coneY = (r: number) => CONE.h * (1 - Math.min(1, Math.max(0, (r - CONE.top) / (CONE.r - CONE.top))));
const LAVA = new Color("#C8161D"), FOAM = new Color("#FFF4EC");

// ---------------------------------------------------------------- DOM

export function VolcanoOverlay({ onNext }: { onNext: () => void }) {
  const a = useBench((s) => s.amounts);
  useEffect(() => resetBench(), []);
  useExpKeys({ ...Object.fromEntries(ITEMS.map((it, i) => [String(i + 1), () => autoPour(it)])), r: resetBench });
  const g = useGuide(STEPS);
  const v = volcanoState(a.soda ?? 0, a.vinegar ?? 0);
  const red = Math.round(a.red ?? 0);
  const show = useDelayedCard(g.finished, 2500);
  return (
    <>
      <ExpHeader kicker="Experiment · baking-soda volcano" title="🌋 Make the volcano erupt."
        chips={[{ ok: (a.soda ?? 0) > 0, text: `Baking soda ${v.sodaG.toFixed(1)} g` }, { ok: red > 0, text: `Red colour ${red} drop${red === 1 ? "" : "s"}` }, { ok: (a.vinegar ?? 0) > 0, text: `Vinegar ${Math.round(v.vinegarML)} mL` }, ...(v.reacted > 0 ? [{ ok: true, text: `CO₂ made ${v.co2L.toFixed(2)} L`, tone: "lime" as const }] : [])]}
        hint={g.finished ? "Pour more baking soda or vinegar for another burst!" : `Step ${g.current + 1} of ${g.total}: ${STEPS[g.current].text}`} />
      <GuidePanel steps={STEPS} current={g.current} />
      <ItemLabels items={ITEMS} onPick={(it) => autoPour(it)} />
      {show && (
        <ResultCard title={`It erupts! Foamy ${red > 0 ? "red " : ""}“lava” bubbles over the top.`} equation={VOLCANO.equation} onNext={onNext} recap={STEPS}
          why={["Vinegar is an acid (acetic acid). Baking soda is sodium bicarbonate, a base.", "They react and make carbon dioxide gas, CO₂: the same gas you breathe out.", "The gas bubbles push the liquid up and out of the crater: that’s the “lava”.", "The red colour is only a dye. It doesn't react; it just colours the foam."]}
          numbers={<>You used <b>{v.sodaG.toFixed(1)} g</b> of baking soda ({v.molSoda.toFixed(3)} mol) and <b>{Math.round(v.vinegarML)} mL</b> of vinegar ({v.molAcid.toFixed(3)} mol) → <b className="text-lime">{v.co2L.toFixed(2)} L of CO₂</b>. {v.limiting === "neither" ? "Both ran out together: a perfect 1 : 1 mix." : `The ${v.limiting} ran out first: it's the limiting reactant. Add more ${v.limiting} for a bigger eruption!`}</>} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- 3D

export function VolcanoScene() {
  const targets = useMemo(() => [CRATER], []);
  const craterFill = useRef<Mesh>(null);
  const foam = useRef<InstancedMesh>(null);
  const flows = useRef<(Mesh | null)[]>([]);
  const pool = useRef<Mesh>(null);
  const run = useBench((s) => s.run);
  const tmp = useMemo(() => ({ o: new Object3D(), c: new Color() }), []);
  // Particle + flow simulation state: mutated every frame, so it lives in a ref.
  const simRef = useRef({
    p: new Float32Array(N_FOAM * 3), vel: new Float32Array(N_FOAM * 3), life: new Float32Array(N_FOAM), size: new Float32Array(N_FOAM),
    next: 0, energy: 0, flow: new Float32Array(N_FLOW), pool: 0, reacted: 0,
  });
  const flowAngles = useMemo(() => Array.from({ length: N_FLOW }, (_, i) => -Math.PI * 0.95 + (i / (N_FLOW - 1)) * Math.PI * 0.9 + Math.sin(i * 7.3) * 0.12), []);

  // "Again": clear the foam, the flows and the pool.
  useEffect(() => {
    const sim = simRef.current;
    sim.life.fill(0); sim.flow.fill(0); sim.energy = 0; sim.pool = 0; sim.reacted = 0;
  }, [run]);

  const emit = (n: number) => {
    const sim = simRef.current;
    for (let k = 0; k < n; k++) {
      const i = sim.next;
      sim.next = (sim.next + 1) % N_FOAM;
      const ang = Math.random() * Math.PI * 2, out = 0.35 + Math.random() * 0.9, up = 2.2 + Math.random() * 1.8 * (0.6 + sim.energy);
      sim.p[i * 3] = CRATER.x + Math.cos(ang) * 0.08; sim.p[i * 3 + 1] = CRATER.y + 0.02; sim.p[i * 3 + 2] = CRATER.z + Math.sin(ang) * 0.08;
      sim.vel[i * 3] = Math.cos(ang) * out; sim.vel[i * 3 + 1] = up; sim.vel[i * 3 + 2] = Math.sin(ang) * out * 0.6;
      sim.life[i] = 3.5 + Math.random() * 2.5; sim.size[i] = 0.05 + Math.random() * 0.07;
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const sim = simRef.current;
    const a = useBench.getState().amounts;

    // The reaction: new CO2 since the last burst → a burst of foam proportional to it.
    const v = volcanoState(a.soda ?? 0, a.vinegar ?? 0);
    if (v.reacted > sim.reacted + 1e-4) {
      sim.energy = Math.min(1.6, sim.energy + ((v.reacted - sim.reacted) / VOLCANO_MAX_MOL) * 3.2);
      sim.reacted = v.reacted;
      setFlag("erupted");
      playSfx("fizz", 0.7);
    }
    if (sim.energy > 0.02) emit(Math.ceil(sim.energy * 110 * dt));
    sim.energy = Math.max(0, sim.energy - dt * 0.28);

    // Crater contents: white soda heap, pale vinegar, tinted by the dye.
    const red = Math.min(1, (a.red ?? 0) / 2);
    const cf = craterFill.current;
    if (cf) {
      cf.visible = (a.soda ?? 0) > 0 || (a.vinegar ?? 0) > 0 || (a.red ?? 0) > 0;
      tmp.c.set((a.vinegar ?? 0) > 0 ? "#F3EBD3" : "#FAFAFA").lerp(LAVA, red);
      (cf.material as MeshStandardMaterial).color.copy(tmp.c);
    }

    // Foam: up out of the crater, falls, then slides down the cone and pools on the tray.
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
      const ang = flowAngles[k];
      const r1 = CONE.top + (CONE.r - CONE.top) * f;
      const midR = (CONE.top + r1) / 2;
      m.position.set(CONE.x + Math.cos(ang) * midR, coneY(midR) + 0.03, CONE.z + Math.sin(ang) * midR * 0.6);
      const len = Math.hypot(r1 - CONE.top, coneY(CONE.top) - coneY(r1));
      m.scale.set(1, Math.max(0.01, len), 1);
      m.lookAt(new Vector3(CONE.x + Math.cos(ang) * r1, coneY(r1) + 0.03, CONE.z + Math.sin(ang) * r1 * 0.6));
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
      <BenchItems items={ITEMS} targets={targets} />
    </group>
  );
}
