"use client";
// src/game/lab/experimentLabs.tsx: six Experiments Lab benches built on benchKit (pour with your hands; keys / clicks
// as twins). All chemistry numbers come from src/game/experiments.ts (code, tested): nothing here is invented.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { useTarget } from "@/motion/targets";
import { Bubbles } from "@/three/effects/Bubbles";
import { Precipitate } from "@/three/effects/Precipitate";
import { subscribe } from "../store";
import {
  balloonState, BALLOON, CABBAGE_CUPS, cabbageColor, COPPER, copperNail, ELEPHANT, elephantState, LAVA_LAMP, lavaLampTablet,
  PACKS, packTemperature, pHKind, REACTIVITY, SALTS, VOLCANO,
} from "../experiments";
import { autoPour, Bench, BenchItems, ExpHeader, Foam, ItemLabels, resetBench, ResultCard, useBench, useDelayedCard, useExpKeys, Vessel, type BenchItem } from "./benchKit";

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: string, b: string, t: number) => "#" + new Color(a).lerp(new Color(b), clamp01(t)).getHexString();
const pct = (v: number) => `${Math.round(v * 100)}% used`;
const keysFor = (items: BenchItem[]) => Object.fromEntries([...items.map((it, i) => [String(i + 1), () => autoPour(it)] as const), ["r", resetBench] as const]);
const Tray = ({ x = 0.2, z = 0.6, r = 1.1 }: { x?: number; z?: number; r?: number }) => (
  <mesh position={[x, 0.015, z]} scale={[1, 1, 0.6]}>
    <cylinderGeometry args={[r, r + 0.05, 0.05, 48]} />
    <meshStandardMaterial color="#AEB6C2" metalness={0.6} roughness={0.35} />
  </mesh>
);

// ================================================================ Balloon inflator
const B_ITEMS: BenchItem[] = [
  { id: "vinegar", name: "vinegar → bottle", formula: "CH3COOH", kind: "liquid", look: "bottle", home: [-2.4, 0, 0.85], color: "#F3EBD3", rate: 0.35, step: 0.5, limit: 1, target: 0, unit: (v) => `${Math.round(v * BALLOON.vinegarML)} mL` },
  { id: "soda", name: "baking soda → balloon", formula: "NaHCO3", kind: "powder", look: "jar", home: [-1.45, 0, 1.0], color: "#FAFAFA", rate: 0.4, step: 0.5, limit: 1, target: 1, unit: (v) => `${(v * BALLOON.sodaG).toFixed(1)} g` },
  { id: "balloon", name: "fit balloon + tip it", kind: "solid", look: "balloon", home: [2.3, 0, 0.9], color: "#EF4444", rate: 1, step: 1, limit: 1, target: 0, unit: () => "on the bench" },
];
const B_BOTTLE = v3(0.2, 0.98, 0.6), B_FUNNEL = v3(1.35, 0.55, 0.95);

export function BalloonScene() {
  const targets = useMemo(() => [B_BOTTLE, B_FUNNEL], []);
  const balloon = useRef<Mesh>(null);
  const neck = useRef<Mesh>(null);
  const r = useRef(0);
  const amounts = useBench((s) => s.amounts);
  useFrame((_, dt) => {
    const a = useBench.getState().amounts;
    const attached = (a.balloon ?? 0) >= 1;
    const s = balloonState(attached ? (a.soda ?? 0) : 0, a.vinegar ?? 0);
    const want = attached ? 0.09 + s.radiusCm * 0.03 : 0;
    r.current += (want - r.current) * Math.min(1, dt * 0.9);
    const m = balloon.current;
    if (m) {
      m.visible = attached;
      m.scale.set(r.current, r.current * 1.15, r.current);
      m.position.y = 1.02 + r.current * 1.1;
    }
    if (neck.current) neck.current.visible = attached;
  });
  return (
    <group>
      <Bench />
      {/* Bottle with a narrow neck */}
      <Vessel at={[0.2, 0, 0.6]} r={0.3} h={0.72} level={(amounts.vinegar ?? 0) * 0.55} color="#F3EBD3" />
      <mesh position={[0.2, 0.86, 0.6]}><cylinderGeometry args={[0.08, 0.3, 0.22, 28, 1, true]} /><meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} side={2} depthWrite={false} /></mesh>
      {/* Little funnel where the soda goes into the balloon (shows how much is in it) */}
      <mesh position={[1.35, 0.3, 0.95]}><cylinderGeometry args={[0.16, 0.04, 0.3, 20, 1, true]} /><meshStandardMaterial color="#CBD5E1" side={2} /></mesh>
      <mesh position={[1.35, 0.12 + (amounts.soda ?? 0) * 0.08, 0.95]} visible={(amounts.soda ?? 0) > 0 && (amounts.balloon ?? 0) < 1}>
        <sphereGeometry args={[0.07 + (amounts.soda ?? 0) * 0.05, 14, 10]} /><meshStandardMaterial color="#FAFAFA" roughness={0.9} />
      </mesh>
      <mesh ref={neck} position={[0.2, 1.0, 0.6]} visible={false}>
        <cylinderGeometry args={[0.07, 0.085, 0.12, 16]} />
        <meshStandardMaterial color="#DC2626" roughness={0.4} />
      </mesh>
      <mesh ref={balloon} position={[0.2, 1.1, 0.6]} visible={false}>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color="#EF4444" roughness={0.35} />
      </mesh>
      <Bubbles at={() => ({ origin: [0.2, 0.04, 0.6], radius: 0.25, height: 0.36 })} active={(amounts.balloon ?? 0) >= 1 && (amounts.vinegar ?? 0) > 0 && (amounts.soda ?? 0) > 0} count={120} />
      <BenchItems items={B_ITEMS} targets={targets} />
    </group>
  );
}

export function BalloonOverlay({ onNext }: { onNext: () => void }) {
  const a = useBench((s) => s.amounts);
  useEffect(() => resetBench(), []);
  useExpKeys(keysFor(B_ITEMS));
  const attached = (a.balloon ?? 0) >= 1;
  const s = balloonState(attached ? (a.soda ?? 0) : 0, a.vinegar ?? 0);
  const done = attached && s.reacted > 0;
  const show = useDelayedCard(done, 3500);
  const hint = done ? null : attached ? (a.vinegar ?? 0) === 0 ? "The bottle is empty: nothing to react with. Press R and add vinegar first." : "No baking soda in the balloon, so nothing happens. Press R and try again." : (a.vinegar ?? 0) === 0 ? "Pour vinegar into the bottle." : (a.soda ?? 0) === 0 ? "Now put baking soda in the balloon (the funnel)." : "Fit the balloon on the bottle and tip it up!";
  return (
    <>
      <ExpHeader kicker="Experiment · balloon inflator" title="🎈 Blow up a balloon with a chemical reaction (no breath needed)."
        chips={[{ ok: (a.vinegar ?? 0) > 0, text: `Vinegar ${Math.round(s.vinegarML || (a.vinegar ?? 0) * BALLOON.vinegarML)} mL` }, { ok: (a.soda ?? 0) > 0, text: `Baking soda ${((a.soda ?? 0) * BALLOON.sodaG).toFixed(1)} g` }, { ok: attached, text: "Balloon on" }, ...(done ? [{ ok: true, text: `CO₂ ${s.co2L.toFixed(2)} L`, tone: "lime" as const }] : [])]}
        hint={hint} />
      <ItemLabels items={B_ITEMS} onPick={(it) => autoPour(it)} />
      {show && (
        <ResultCard title="The balloon inflates!" equation={VOLCANO.equation} onNext={onNext}
          why={["Vinegar (an acid) meets baking soda (sodium bicarbonate) and they react.", "One product is carbon dioxide gas. In a closed bottle it has only one way out: into the balloon.", "More gas = a bigger balloon, until one reactant runs out."]}
          numbers={<>{s.sodaG.toFixed(1)} g of baking soda ({s.molSoda.toFixed(3)} mol) + {Math.round(s.vinegarML)} mL of vinegar ({s.molAcid.toFixed(3)} mol) → <b className="text-lime">{s.co2L.toFixed(2)} L of CO₂</b>, a balloon about <b>{(s.radiusCm * 2).toFixed(0)} cm</b> across. {s.limiting === "neither" ? "Both ran out together." : `The ${s.limiting} ran out first (limiting reactant).`}</>} />
      )}
    </>
  );
}

// ================================================================ Elephant toothpaste
const E_ITEMS: BenchItem[] = [
  { id: "peroxide", name: "hydrogen peroxide 6%", formula: "H2O2", kind: "liquid", look: "bottle", home: [-2.5, 0, 0.85], color: "#E8F4F8", rate: 0.4, step: 0.5, limit: 1, unit: (v) => `${Math.round(v * ELEPHANT.peroxideML)} mL` },
  { id: "soap", name: "dish soap", kind: "liquid", look: "dropper", home: [-1.55, 0, 1.05], color: "#22C55E", rate: 1, step: 1, limit: 1, unit: pct },
  { id: "colour", name: "food colouring", kind: "drops", look: "dropper", home: [1.4, 0, 1.05], color: "#7C3AED", rate: 3.5, step: 3, limit: 6, unit: (v) => `${Math.round(v)}/6 drops` },
  { id: "yeast", name: "yeast + warm water (catalyst)", kind: "liquid", look: "beaker", home: [2.45, 0, 0.85], color: "#C8A165", rate: 0.6, step: 1, limit: 1, unit: pct },
];
const E_MOUTH = v3(0.2, 1.32, 0.55);

export function ElephantScene() {
  const targets = useMemo(() => [E_MOUTH], []);
  const energy = useRef(0);
  const pending = useRef(0);
  const released = useRef(0);
  const amounts = useBench((s) => s.amounts);
  const run = useBench((s) => s.run);
  useEffect(() => {
    energy.current = 0; pending.current = 0; released.current = 0;
  }, [run]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = useBench.getState().amounts;
    const s = elephantState(a.peroxide ?? 0, a.yeast ?? 0, a.soap ?? 0);
    if (s.reacting && s.molO2 > released.current + pending.current + 1e-6) pending.current = s.molO2 - released.current;
    const out = s.reacting ? Math.min(pending.current, pending.current * s.speed * dt * 0.9 + 1e-5) : 0;
    pending.current -= out; released.current += out;
    energy.current = s.foamy ? Math.min(2.2, (out / Math.max(dt, 1e-3)) * 30) : 0;
  });
  const dye = mix("#FFFFFF", "#7C3AED", (amounts.colour ?? 0) / 3);
  const st = elephantState(amounts.peroxide ?? 0, amounts.yeast ?? 0, amounts.soap ?? 0);
  return (
    <group>
      <Bench />
      <Tray />
      {/* Tall graduated cylinder */}
      <Vessel at={[0.2, 0.04, 0.55]} r={0.17} h={1.25} level={clamp01((amounts.peroxide ?? 0) * 0.35 + (amounts.yeast ?? 0) * 0.12)} color={mix("#E8F4F8", "#7C3AED", (amounts.colour ?? 0) / 4)} />
      {[0.25, 0.5, 0.75, 1.0].map((y) => (
        <mesh key={y} position={[0.2, 0.04 + y * 1.2, 0.72]}><boxGeometry args={[0.1, 0.008, 0.002]} /><meshStandardMaterial color="#64748B" /></mesh>
      ))}
      <Foam from={E_MOUTH} energy={energy} color={dye} up={3.4} spread={0.3} gravity={2.6} size={0.1} count={280}
        surface={(x, z) => (Math.hypot(x - 0.2, (z - 0.55) / 0.6) < 0.2 ? 1.3 : 0.05)} />
      <Bubbles at={() => ({ origin: [0.2, 0.06, 0.55], radius: 0.14, height: 0.5 })} active={st.reacting && !st.foamy} count={100} />
      <BenchItems items={E_ITEMS} targets={targets} />
    </group>
  );
}

export function ElephantOverlay({ onNext }: { onNext: () => void }) {
  const a = useBench((s) => s.amounts);
  useEffect(() => resetBench(), []);
  useExpKeys(keysFor(E_ITEMS));
  const s = elephantState(a.peroxide ?? 0, a.yeast ?? 0, a.soap ?? 0);
  const show = useDelayedCard(s.reacting, 4000);
  const hint = s.reacting ? (s.foamy ? null : "No soap, so the oxygen just bubbles away. Press R and add soap before the yeast.") : (a.peroxide ?? 0) === 0 ? "Pour the hydrogen peroxide into the tall cylinder." : (a.soap ?? 0) === 0 ? "Add a squirt of dish soap (it traps the gas as foam)." : (a.colour ?? 0) === 0 ? "A few drops of colour, then the yeast!" : "Now pour in the yeast and stand back!";
  return (
    <>
      <ExpHeader kicker="Experiment · elephant toothpaste" title="🧪 Make a giant foam fountain: peroxide, soap, colour, then the yeast."
        chips={[{ ok: (a.peroxide ?? 0) > 0, text: `H₂O₂ ${Math.round(s.peroxideML)} mL` }, { ok: (a.soap ?? 0) > 0, text: "Soap" }, { ok: (a.colour ?? 0) > 0, text: `Colour ${Math.round(a.colour ?? 0)} drops` }, { ok: (a.yeast ?? 0) > 0, text: "Yeast" }, ...(s.reacting ? [{ ok: true, text: `O₂ ${s.o2L.toFixed(2)} L`, tone: "lime" as const }] : [])]}
        hint={hint} />
      <ItemLabels items={E_ITEMS} onPick={(it) => autoPour(it)} />
      {show && (
        <ResultCard title={s.foamy ? "A fountain of foam!" : "Lots of fizz, but no foam"} equation={ELEPHANT.equation} onNext={onNext}
          why={["Hydrogen peroxide slowly breaks down into water and oxygen gas.", "Yeast contains catalase, a catalyst: it makes the reaction much faster and isn't used up.", s.foamy ? "Dish soap traps the oxygen in millions of bubbles: that's the foam." : "Without soap the oxygen escapes as bubbles. Add soap to trap it as foam.", "The foam feels warm: the reaction gives out heat (exothermic)."]}
          numbers={<>{Math.round(s.peroxideML)} mL of 6% H₂O₂ = {s.molH2O2.toFixed(3)} mol → ÷ 2 = <b className="text-lime">{s.molO2.toFixed(3)} mol O₂ ≈ {s.o2L.toFixed(2)} L</b>. More yeast makes it faster, not bigger: the amount of O₂ only depends on the peroxide.</>} />
      )}
    </>
  );
}

// ================================================================ Red-cabbage rainbow
const CUP_X = CABBAGE_CUPS.map((_, i) => -2.6 + i * 1.04);
const CUP_BASE: Record<string, string> = { lemon: "#FFF7C2", vinegar: "#F6F1E4", water: "#E8F4F8", soda: "#EEF6F8", soap: "#F4F7FA", washing: "#EEF2F5" };
const C_ITEMS: BenchItem[] = [
  { id: "cabbage", name: "red-cabbage juice", kind: "liquid", look: "jug", home: [0.0, 0, 1.35], color: "#6B3FA0", rate: 1.2, step: 1, limit: CABBAGE_CUPS.length, target: "nearest", unit: (v) => `${Math.min(6, Math.floor(v + 0.01))}/6 cups` },
];

export function CabbageScene() {
  const targets = useMemo(() => CUP_X.map((x) => v3(x, 0.5, 0.55)), []);
  const into = useBench((s) => s.into.cabbage);
  return (
    <group>
      <Bench />
      {CABBAGE_CUPS.map((c, i) => {
        const juice = clamp01((into?.[i] ?? 0) * 1.4);
        return <Vessel key={c.id} at={[CUP_X[i], 0, 0.55]} r={0.27} h={0.55} level={0.45 + juice * 0.35} color={mix(CUP_BASE[c.id], cabbageColor(c.pH).hex, juice)} glow={juice * 0.35} />;
      })}
      <BenchItems items={C_ITEMS} targets={targets} />
    </group>
  );
}

export function CabbageOverlay({ onNext }: { onNext: () => void }) {
  const into = useBench((s) => s.into.cabbage);
  useEffect(() => resetBench(), []);
  const pourCup = (i: number) => {
    if ((useBench.getState().into.cabbage?.[i] ?? 0) >= 0.7) return;
    autoPour(C_ITEMS[0], i);
  };
  useExpKeys({ ...Object.fromEntries(CABBAGE_CUPS.map((_, i) => [String(i + 1), () => pourCup(i)])), r: resetBench });
  const filled = CABBAGE_CUPS.map((_, i) => (into?.[i] ?? 0) >= 0.5);
  const all = filled.every(Boolean);
  const show = useDelayedCard(all, 2000);
  return (
    <>
      <ExpHeader kicker="Experiment · red-cabbage rainbow" title="🌈 Pour red-cabbage juice into each cup. Which are acids, which are bases?"
        chips={[{ ok: filled.some(Boolean), text: `${filled.filter(Boolean).length} of 6 cups tested`, tone: all ? "lime" : undefined }]}
        hint={all ? null : "✊ Grab the jug · hold it over a cup · tilt to pour (or keys 1–6 / click a cup)"} />
      <div className="pointer-events-none absolute inset-x-0 bottom-[3vh] z-20 flex justify-center gap-2 px-[4vw]">
        {CABBAGE_CUPS.map((c, i) => (
          <CupCard key={c.id} i={i} name={c.name} pH={c.pH} tested={filled[i]} onPour={() => pourCup(i)} />
        ))}
      </div>
      {show && (
        <ResultCard title="A pH rainbow!" onNext={onNext}
          why={["Red-cabbage juice contains anthocyanin, a natural indicator: its colour depends on how acidic the liquid is.", "Acids (low pH) turn it red-pink, neutral water keeps it violet, bases (high pH) turn it blue, green, then yellow.", "So the colour tells you the pH without a meter."]}
          numbers={<PHStrip />} />
      )}
    </>
  );
}

function CupCard({ i, name, pH, tested, onPour }: { i: number; name: string; pH: number; tested: boolean; onPour: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `cup:${i}`;
  const mouse = useTarget(id, ref, !tested);
  useEffect(() => subscribe("dwell", (e) => e.targetId === id && e.source !== "gesture" && onPour()), [id, onPour]);
  const c = cabbageColor(pH);
  return (
    <div ref={ref} {...mouse} role="button" className={`pointer-events-auto w-[150px] cursor-pointer rounded-xl border bg-navy/85 px-2 py-2 text-center ${tested ? "border-lime/60" : "border-line"}`}>
      <div className="text-sm">{name}</div>
      {tested ? (
        <div className="mt-1 text-xs"><span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: c.hex }} /> {c.label} · pH {pH} · <b>{pHKind(pH)}</b></div>
      ) : (
        <div className="text-xs text-muted">{i + 1} · or click to test</div>
      )}
    </div>
  );
}

function PHStrip() {
  const stops = Array.from({ length: 14 }, (_, i) => cabbageColor(i + 0.5).hex);
  return (
    <div>
      <div className="mb-1 font-semibold">Your cups on the pH scale (code: typical pH → indicator colour)</div>
      <div className="relative h-5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }} />
      <div className="relative mt-1 h-16">
        {CABBAGE_CUPS.map((c, i) => (
          <div key={c.id} className="absolute -translate-x-1/2 text-center text-[11px] leading-tight" style={{ left: `${(c.pH / 14) * 100}%`, top: (i % 2) * 28 }}>
            ▲<br />{c.name.split(" ")[0]} {c.pH}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted"><span>0 · acid</span><span>7 · neutral</span><span>14 · base</span></div>
    </div>
  );
}

// ================================================================ Lava lamp
const L_ITEMS: BenchItem[] = [
  { id: "water", name: "water", formula: "H2O", kind: "liquid", look: "jug", home: [-2.5, 0, 0.85], color: "#DCEEFF", rate: 0.5, step: 1, limit: 1, unit: pct },
  { id: "oil", name: "vegetable oil", kind: "liquid", look: "bottle", home: [-1.5, 0, 1.0], color: "#F2C94C", rate: 0.45, step: 1, limit: 1, unit: pct },
  { id: "colour", name: "food colouring", kind: "drops", look: "dropper", home: [1.45, 0, 1.05], color: "#E11D48", rate: 3, step: 3, limit: 6, unit: (v) => `${Math.round(v)}/6 drops` },
  { id: "tablet", name: "fizzy tablet", kind: "solid", look: "tablet", home: [2.45, 0, 0.9], color: "#F8FAFC", rate: 1, step: 1, limit: 3, unit: (v) => `${Math.round(v)}/3 dropped in` },
];
const L_MOUTH = v3(0.2, 1.45, 0.55), L_H = 1.38;

export function LavaLampScene() {
  const targets = useMemo(() => [L_MOUTH], []);
  const a = useBench((s) => s.amounts);
  const run = useBench((s) => s.run);
  const blobs = useRef<(Mesh | null)[]>([]);
  const energy = useRef(0);
  const lastTablets = useRef(0);
  useEffect(() => {
    energy.current = 0; lastTablets.current = 0;
  }, [run]);
  const waterTop = 0.04 + (a.water ?? 0) * 0.45;
  const oilTop = waterTop + (a.oil ?? 0) * 0.8;
  const dyed = mix("#DCEEFF", "#E11D48", (a.colour ?? 0) / 3);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useBench.getState().amounts;
    const tabs = st.tablet ?? 0;
    if (tabs > lastTablets.current) {
      energy.current = Math.min(2, energy.current + (tabs - lastTablets.current));
      lastTablets.current = tabs;
    }
    energy.current = Math.max(0, energy.current - dt * 0.08);
    const wt = 0.04 + (st.water ?? 0) * 0.45, ot = wt + (st.oil ?? 0) * 0.8;
    blobs.current.forEach((m, i) => {
      if (!m) return;
      const on = energy.current > 0.02 && (st.water ?? 0) > 0 && (st.oil ?? 0) > 0;
      m.visible = on;
      if (!on) return;
      const ph = (clock.elapsedTime * (0.16 + (i % 4) * 0.035) + i * 0.37) % 1;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2; // up, then back down
      m.position.set(0.2 + Math.sin(i * 2.1) * 0.14, wt + (ot - wt - 0.08) * tri, 0.55 + Math.cos(i * 1.7) * 0.07);
      const sc = 0.065 + (i % 3) * 0.025;
      m.scale.set(sc, sc * (1.2 + tri * 0.3), sc);
    });
  });
  return (
    <group>
      <Bench />
      {/* Tall bottle: water sinks to the bottom, oil floats on top (density), whatever order you pour */}
      <group position={[0.2, 0, 0.55]}>
        <mesh position={[0, L_H / 2 + 0.02, 0]}><cylinderGeometry args={[0.3, 0.3, L_H, 32, 1, true]} /><meshStandardMaterial color="#E0F2FE" transparent opacity={0.25} roughness={0.05} side={2} depthWrite={false} /></mesh>
        <mesh position={[0, 0.04 + ((a.water ?? 0) * 0.45) / 2, 0]} visible={(a.water ?? 0) > 0.01} scale={[1, Math.max(0.02, (a.water ?? 0) * 0.45), 1]}>
          <cylinderGeometry args={[0.28, 0.28, 1, 32]} /><meshStandardMaterial color={dyed} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, waterTop + ((a.oil ?? 0) * 0.8) / 2, 0]} visible={(a.oil ?? 0) > 0.01} scale={[1, Math.max(0.02, (a.oil ?? 0) * 0.8), 1]}>
          <cylinderGeometry args={[0.28, 0.28, 1, 32]} /><meshStandardMaterial color="#E0A21B" emissive="#B7791F" emissiveIntensity={0.25} transparent opacity={0.72} roughness={0.12} />
        </mesh>
      </group>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} ref={(el) => void (blobs.current[i] = el)} visible={false}>
          <sphereGeometry args={[1, 18, 14]} /><meshStandardMaterial color={dyed} roughness={0.25} transparent opacity={0.92} />
        </mesh>
      ))}
      <Bubbles at={() => ({ origin: [0.2, 0.05, 0.55], radius: 0.22, height: Math.max(0.2, oilTop - 0.1) })} active={(a.tablet ?? 0) > 0 && (a.water ?? 0) > 0} count={90} />
      <BenchItems items={L_ITEMS} targets={targets} />
    </group>
  );
}

export function LavaLampOverlay({ onNext }: { onNext: () => void }) {
  const a = useBench((s) => s.amounts);
  useEffect(() => resetBench(), []);
  useExpKeys(keysFor(L_ITEMS));
  const tabs = Math.round(a.tablet ?? 0);
  const t = lavaLampTablet(Math.max(1, tabs));
  const going = tabs > 0 && (a.water ?? 0) > 0 && (a.oil ?? 0) > 0;
  const show = useDelayedCard(going, 5000);
  const hint = going ? null : (a.water ?? 0) === 0 ? "Pour water into the bottle." : (a.oil ?? 0) === 0 ? "Now the oil. Watch where it goes!" : (a.colour ?? 0) === 0 ? `Oil floats on water: it's less dense (${LAVA_LAMP.oilDensity} vs ${LAVA_LAMP.waterDensity} g/mL). Add a few drops of colour.` : "The colour sinks through the oil into the water. Drop in a fizzy tablet!";
  return (
    <>
      <ExpHeader kicker="Experiment · lava lamp" title="🫧 Make a lava lamp: water, oil, colour, then a fizzy tablet."
        chips={[{ ok: (a.water ?? 0) > 0, text: "Water" }, { ok: (a.oil ?? 0) > 0, text: "Oil" }, { ok: (a.colour ?? 0) > 0, text: `Colour ${Math.round(a.colour ?? 0)} drops` }, { ok: tabs > 0, text: `Tablets ${tabs}` }]}
        hint={hint} />
      <ItemLabels items={L_ITEMS} onPick={(it) => autoPour(it)} />
      {show && (
        <ResultCard title="Blobs rise and fall like a lava lamp!" equation={LAVA_LAMP.equation} onNext={onNext}
          why={[`Oil (${LAVA_LAMP.oilDensity} g/mL) is less dense than water (1.00 g/mL), so it floats, and they don't mix.`, "The colour is water-based, so it sinks through the oil into the water.", "The tablet's citric acid and sodium bicarbonate react and make CO₂ bubbles. They carry blobs of coloured water up; at the top the gas escapes and the blobs sink again.", "Drop in another tablet to restart it."]}
          numbers={<>Each tablet: {LAVA_LAMP.tablet.citricG} g citric acid ({t.molCitric / Math.max(1, tabs) > 0 ? (t.molCitric / Math.max(1, tabs)).toFixed(4) : "0"} mol) + {LAVA_LAMP.tablet.sodaG} g NaHCO₃ ({(t.molSoda / Math.max(1, tabs)).toFixed(4)} mol). Ratio 1 : 3, so the {t.limiting} runs out first → <b className="text-lime">{(t.co2L / Math.max(1, tabs)).toFixed(2)} L of CO₂ per tablet</b>{tabs > 1 ? ` (${t.co2L.toFixed(2)} L in total)` : ""}.</>} />
      )}
    </>
  );
}

// ================================================================ Hot & cold packs
const P_X = [-0.6, 1.3];
const P_ITEMS: BenchItem[] = [
  { id: "CaCl2", name: "calcium chloride", formula: "CaCl2", kind: "powder", look: "jar", home: [-2.5, 0, 0.9], color: "#FAFAFA", rate: 0.5, step: 1, limit: 2, target: 0, unit: (v) => `${Math.round(v * SALTS.CaCl2.gramsPerScoop)} g` },
  { id: "NH4NO3", name: "ammonium nitrate", formula: "NH4NO3", kind: "powder", look: "jar", home: [2.6, 0, 0.9], color: "#F1F5F9", rate: 0.5, step: 1, limit: 2, target: 1, unit: (v) => `${Math.round(v * SALTS.NH4NO3.gramsPerScoop)} g` },
];
/** Temperature of beaker i from everything dissolved in it (code: q = n·ΔH summed, ΔT = q / (m·c)). */
function beakerTemp(into: Record<string, number[]>, i: number) {
  let q = 0, grams = 0;
  for (const salt of ["CaCl2", "NH4NO3"] as const) {
    const g = (into[salt]?.[i] ?? 0) * SALTS[salt].gramsPerScoop;
    if (g > 0) {
      q += packTemperature(salt, g).qJ;
      grams += g;
    }
  }
  return grams > 0 ? PACKS.startC + q / ((PACKS.waterG + grams) * PACKS.c) : PACKS.startC;
}

export function PacksScene() {
  const targets = useMemo(() => P_X.map((x) => v3(x, 0.62, 0.6)), []);
  const into = useBench((s) => s.into);
  const shown = useRef([PACKS.startC, PACKS.startC]);
  const columns = useRef<(Mesh | null)[]>([]);
  const frost = useRef<(Mesh | null)[]>([]);
  const steam = useRef<(Mesh | null)[]>([]);
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const st = useBench.getState().into;
    P_X.forEach((_, i) => {
      const want = beakerTemp(st, i);
      shown.current[i] += (want - shown.current[i]) * Math.min(1, dt * 0.8);
      const T = shown.current[i];
      const col = columns.current[i];
      if (col) {
        const h = clamp01(T / 50) * 0.9;
        col.scale.y = Math.max(0.02, h);
        col.position.y = 0.18 + h / 2;
      }
      const f = frost.current[i];
      if (f) {
        f.visible = T < 15;
        (f.material as MeshStandardMaterial).opacity = clamp01((15 - T) / 8) * 0.55;
      }
      const s = steam.current[i];
      if (s) {
        s.visible = T > 30;
        const k = (clock.elapsedTime * 0.5 + i * 0.3) % 1;
        s.position.y = 0.62 + k * 0.5;
        s.scale.setScalar(0.12 + k * 0.18);
        (s.material as MeshStandardMaterial).opacity = clamp01((T - 30) / 8) * (1 - k) * 0.5;
      }
    });
  });
  return (
    <group>
      <Bench />
      {P_X.map((x, i) => (
        <group key={x}>
          <Vessel at={[x, 0, 0.6]} r={0.3} h={0.62} level={0.75} color={mix("#E8F4F8", "#FFFFFF", ((into.CaCl2?.[i] ?? 0) + (into.NH4NO3?.[i] ?? 0)) * 0.3)} />
          {/* Thermometer: glass tube + red column */}
          <mesh position={[x + 0.12, 0.62, 0.6]}><cylinderGeometry args={[0.025, 0.025, 1.0, 12]} /><meshStandardMaterial color="#F8FAFC" transparent opacity={0.6} /></mesh>
          <mesh ref={(el) => void (columns.current[i] = el)} position={[x + 0.12, 0.4, 0.6]}><cylinderGeometry args={[0.012, 0.012, 1, 10]} /><meshStandardMaterial color="#DC2626" emissive="#DC2626" emissiveIntensity={0.2} /></mesh>
          <mesh position={[x + 0.12, 0.16, 0.6]}><sphereGeometry args={[0.03, 12, 10]} /><meshStandardMaterial color="#DC2626" /></mesh>
          <mesh ref={(el) => void (frost.current[i] = el)} position={[x, 0.31, 0.6]} visible={false}><cylinderGeometry args={[0.32, 0.31, 0.6, 32, 1, true]} /><meshStandardMaterial color="#DBEAFE" transparent opacity={0} side={2} /></mesh>
          <mesh ref={(el) => void (steam.current[i] = el)} position={[x, 0.7, 0.6]} visible={false}><sphereGeometry args={[1, 14, 10]} /><meshStandardMaterial color="#FFFFFF" transparent opacity={0} /></mesh>
        </group>
      ))}
      <BenchItems items={P_ITEMS} targets={targets} />
    </group>
  );
}

export function PacksOverlay({ onNext }: { onNext: () => void }) {
  const into = useBench((s) => s.into);
  useEffect(() => resetBench(), []);
  useExpKeys(keysFor(P_ITEMS));
  const T = P_X.map((_, i) => beakerTemp(into, i));
  const any = T.some((t) => Math.abs(t - PACKS.startC) > 0.05);
  const show = useDelayedCard(any, 4000);
  const exact = (salt: "CaCl2" | "NH4NO3") => ((into[salt]?.[0] ?? 0) + (into[salt]?.[1] ?? 0)) * SALTS[salt].gramsPerScoop;
  const a = (salt: "CaCl2" | "NH4NO3") => Math.round(exact(salt));
  const hot = packTemperature("CaCl2", Math.max(0.01, exact("CaCl2"))), cold = packTemperature("NH4NO3", Math.max(0.01, exact("NH4NO3")));
  return (
    <>
      <ExpHeader kicker="Experiment · hot & cold packs" title="🔥❄️ Dissolve each salt in water. Which one gets hot, which gets cold?"
        chips={[{ ok: T[0] !== PACKS.startC, text: `Beaker A ${PACKS.startC.toFixed(1)} → ${T[0].toFixed(1)} °C` }, { ok: T[1] !== PACKS.startC, text: `Beaker B ${PACKS.startC.toFixed(1)} → ${T[1].toFixed(1)} °C` }]}
        hint={any ? (a("CaCl2") && a("NH4NO3") ? null : "Now try the other salt in the other beaker!") : "✊ Grab a salt jar · tilt it over a beaker of water (100 g, 20 °C)"} />
      <ItemLabels items={P_ITEMS} onPick={(it) => autoPour(it)} />
      {show && (
        <ResultCard title="One heats up, one cools down!" onNext={onNext}
          why={["Dissolving breaks the salt's bonds (takes energy) and the ions bond to water (gives energy).", "Calcium chloride gives out more than it takes: exothermic, the water heats up (instant hot packs).", "Ammonium nitrate takes in more than it gives: endothermic, the water cools down (instant cold packs).", "⚠️ In real life these salts need gloves and goggles. Virtual only."]}
          numbers={<>Code: q = n × ΔH, ΔT = q ÷ (mass × 4.18 J/g·°C). {a("CaCl2") > 0 && <>CaCl₂ {a("CaCl2")} g = {hot.n.toFixed(3)} mol × 81.3 kJ/mol → <b className="text-coral">{hot.dT >= 0 ? "+" : ""}{hot.dT.toFixed(1)} °C</b>. </>}{a("NH4NO3") > 0 && <>NH₄NO₃ {a("NH4NO3")} g = {cold.n.toFixed(3)} mol × 25.7 kJ/mol → <b className="text-cyan">{cold.dT.toFixed(1)} °C</b>.</>}</>} />
      )}
    </>
  );
}

// ================================================================ Copper-plated nail
const N_ITEMS: BenchItem[] = [
  { id: "nail", name: "iron nail", formula: "Fe", kind: "solid", look: "nail", home: [-2.2, 0, 0.95], color: "#8E9196", rate: 1, step: 1, limit: 1, unit: () => "on the bench" },
];
const N_BEAKER = v3(0.2, 0.75, 0.6);

export function CopperScene() {
  const targets = useMemo(() => [N_BEAKER], []);
  const a = useBench((s) => s.amounts);
  const run = useBench((s) => s.run);
  const prog = useRef(0);
  const liquid = useRef<Mesh | null>(null);
  const nail = useRef<Mesh>(null);
  useEffect(() => void (prog.current = 0), [run]);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const inIt = (useBench.getState().amounts.nail ?? 0) >= 1;
    prog.current = inIt ? Math.min(1, prog.current + dt / 9) : 0;
    if (liquid.current) {
      const m = liquid.current.material as MeshStandardMaterial;
      m.color.set(mix("#1E6FE0", "#A8C9A2", prog.current));
      m.emissive.copy(m.color);
    }
    if (nail.current) {
      nail.current.visible = inIt;
      (nail.current.material as MeshStandardMaterial).color.set(mix("#8E9196", "#B8733A", Math.min(1, prog.current * 1.6)));
    }
  });
  return (
    <group>
      <Bench />
      <Vessel at={[0.2, 0, 0.6]} r={0.34} h={0.72} level={0.78} color="#1E6FE0" opacity={0.55} glow={0.15} liquidRef={(m) => void (liquid.current = m)} />
      {/* The nail leans in the beaker; its head sticks out of the solution so the coating is easy to see. */}
      <mesh ref={nail} position={[0.27, 0.44, 0.62]} rotation={[0, 0, 0.32]} visible={false}>
        <cylinderGeometry args={[0.032, 0.032, 0.82, 12]} /><meshStandardMaterial color="#8E9196" metalness={0.6} roughness={0.35} />
      </mesh>
      <Precipitate at={() => ({ origin: [0.2, 0.03, 0.6], radius: 0.28, height: 0.5 })} color="#B8733A" active={(a.nail ?? 0) >= 1} count={70} />
      <BenchItems items={N_ITEMS} targets={targets} />
    </group>
  );
}

export function CopperOverlay({ onNext }: { onNext: () => void }) {
  const a = useBench((s) => s.amounts);
  useEffect(() => resetBench(), []);
  useExpKeys(keysFor(N_ITEMS));
  const inIt = (a.nail ?? 0) >= 1;
  const show = useDelayedCard(inIt, 9500);
  const c = copperNail();
  return (
    <>
      <ExpHeader kicker="Experiment · copper-plated nail (time-lapse)" title="🪙 Drop an iron nail into blue copper sulfate. Watch the nail and the colour."
        chips={[{ ok: inIt, text: inIt ? "Nail in · 1 hour shown in 9 s" : "Nail on the bench" }]}
        hint={inIt ? null : "✊ Grab the nail · hold it over the beaker · tilt to drop it in (or key 1)"} />
      <ItemLabels items={N_ITEMS} onPick={(it) => autoPour(it)} />
      {show && (
        <ResultCard title="The nail turns copper-coloured and the blue fades!" equation={COPPER.equation} onNext={onNext}
          why={["Iron is more reactive than copper, so it gives its electrons to the copper ions.", "Copper metal comes out of the solution and coats the nail (and flakes to the bottom).", "Iron goes into the solution as iron(II) sulfate, which is pale green: the blue copper ions are used up.", "⚠️ Copper sulfate is harmful if swallowed. Virtual only."]}
          numbers={<>
            <div className="mb-1">Reactivity series: {REACTIVITY.map((m, i) => <span key={m} className={m === "Fe" ? "font-bold text-lime" : m === "Cu" ? "font-bold text-coral" : "text-muted"}>{m}{i < REACTIVITY.length - 1 ? " › " : ""}</span>)}</div>
            {COPPER.nailG} g of iron ({c.molFe.toFixed(3)} mol) + {COPPER.solutionML} mL of {COPPER.molarity} M CuSO₄ ({c.molCu2.toFixed(3)} mol): the {c.limiting} runs out first → <b className="text-lime">{c.cuG.toFixed(2)} g of copper</b> comes out.
          </>} />
      )}
    </>
  );
}
