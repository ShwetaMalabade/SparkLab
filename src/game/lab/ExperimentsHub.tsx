"use client";
// src/game/lab/ExperimentsHub.tsx: the Experiments Lab's menu. Pick an experiment (☝️ point and hold, ✊ close your
// hand on a card, click, or keys 1–7); do it; "Experiments ▶" brings you back here with a ✓ on it. "Back to the
// building" (key B) leaves the room.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useTarget } from "@/motion/targets";
import { useGame } from "../store";
import { Bench, useExpKeys } from "./benchKit";
import { BalloonOverlay, BalloonScene, CabbageOverlay, CabbageScene, CopperOverlay, CopperScene, ElephantOverlay, ElephantScene, LavaLampOverlay, LavaLampScene, PacksOverlay, PacksScene } from "./experimentLabs";
import { VolcanoOverlay, VolcanoScene } from "./VolcanoLab";
import { subscribe } from "../store";

type Exp = { id: string; icon: string; title: string; line: string; learn: string; Scene: () => React.JSX.Element; Overlay: (p: { onNext: () => void }) => React.JSX.Element };
export const EXPERIMENTS: Exp[] = [
  { id: "volcano", icon: "🌋", title: "Volcano eruption", line: "baking soda + vinegar + red colour", learn: "gases · limiting reactant", Scene: VolcanoScene, Overlay: VolcanoOverlay },
  { id: "elephant", icon: "🧪", title: "Elephant toothpaste", line: "peroxide + soap + yeast", learn: "catalysts · decomposition", Scene: ElephantScene, Overlay: ElephantOverlay },
  { id: "cabbage", icon: "🌈", title: "Red-cabbage rainbow", line: "one juice, six colours", learn: "pH · indicators", Scene: CabbageScene, Overlay: CabbageOverlay },
  { id: "balloon", icon: "🎈", title: "Balloon inflator", line: "a reaction blows it up", learn: "gas volume · stoichiometry", Scene: BalloonScene, Overlay: BalloonOverlay },
  { id: "lava", icon: "🫧", title: "Lava lamp", line: "water + oil + fizzy tablet", learn: "density · CO₂", Scene: LavaLampScene, Overlay: LavaLampOverlay },
  { id: "packs", icon: "🔥", title: "Hot & cold packs", line: "one heats up, one freezes", learn: "exothermic · endothermic", Scene: PacksScene, Overlay: PacksOverlay },
  { id: "copper", icon: "🪙", title: "Copper-plated nail", line: "iron in copper sulfate", learn: "reactivity series", Scene: CopperScene, Overlay: CopperOverlay },
];

type Hub = { current: string | null; done: string[] };
export const useHub = create<Hub>(() => ({ current: null, done: [] }));
const open = (id: string) => useHub.setState({ current: id });
const finish = () => useHub.setState((s) => ({ current: null, done: s.current && !s.done.includes(s.current) ? [...s.done, s.current] : s.done }));
const back = () => useHub.setState({ current: null }); // leave without marking it done

export function ExperimentsScene() {
  const current = useHub((s) => s.current);
  const exp = EXPERIMENTS.find((e) => e.id === current);
  if (!exp) return <Bench />;
  return <exp.Scene key={exp.id} />;
}

export function ExperimentsOverlay({ onLeave }: { onLeave: () => void }) {
  const current = useHub((s) => s.current);
  useEffect(() => useHub.setState({ current: null }), []);
  const exp = EXPERIMENTS.find((e) => e.id === current);
  if (exp)
    return (
      <>
        <exp.Overlay key={exp.id} onNext={finish} />
        <BackButton />
      </>
    );
  return <Picker onLeave={onLeave} />;
}

/** Always there inside an experiment: back to the list (Esc), without finishing it. */
function BackButton() {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget("exp:back", ref);
  useExpKeys({ escape: back });
  useEffect(() => subscribe("dwell", (e) => e.targetId === "exp:back" && back()), []);
  return (
    <div ref={ref} {...mouse} role="button" className="pointer-events-auto absolute left-4 top-[6.5rem] z-40 cursor-pointer rounded-full border border-line bg-navy/85 px-4 py-1.5 text-sm hover:border-cyan">
      ◀ All experiments <span className="text-muted">· Esc</span>
    </div>
  );
}

function Picker({ onLeave }: { onLeave: () => void }) {
  const done = useHub((s) => s.done);
  useExpKeys({ ...Object.fromEntries(EXPERIMENTS.map((e, i) => [String(i + 1), () => open(e.id)])), b: onLeave });
  useEffect(
    () =>
      subscribe("dwell", (e) => {
        const id = e.targetId ?? "";
        if (id.startsWith("exp:open:")) open(id.slice(9));
        if (id === "exp:leave") onLeave();
      }),
    [onLeave],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-navy/40 px-6">
      <div className="rounded-2xl border border-lime/40 bg-navy/90 px-6 py-3 text-center">
        <div className="text-sm text-muted">Experiments Lab · {done.length} of {EXPERIMENTS.length} done</div>
        <div className="font-display text-3xl">Which experiment do you want to do?</div>
        <div className="text-sm text-muted">☝️ point and hold · ✊ close your hand on a card · click · keys 1–{EXPERIMENTS.length}</div>
      </div>
      <div className="grid max-w-[1100px] grid-cols-4 gap-3">
        {EXPERIMENTS.map((e, i) => (
          <Card key={e.id} id={`exp:open:${e.id}`} n={String(i + 1)} icon={e.icon} title={e.title} line={e.line} learn={e.learn} done={done.includes(e.id)} />
        ))}
        <Card id="exp:leave" n="B" icon="🚪" title="Back to the building" line="pick another subject" learn="" />
      </div>
    </div>
  );
}

function Card({ id, n, icon, title, line, learn, done }: { id: string; n: string; icon: string; title: string; line: string; learn: string; done?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  return (
    <div ref={ref} {...mouse} role="button"
      className={`pointer-events-auto flex h-[150px] w-[250px] cursor-pointer select-none flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-white px-3 text-center text-[#1F2937] transition-transform ${over ? "scale-105 border-fuchsia-500" : done ? "border-lime-500" : "border-gray-300"}`}>
      <div className="flex items-center gap-2">
        <span className="text-3xl">{icon}</span>
        <span className="rounded-md bg-gray-100 px-1.5 text-xs text-gray-500">{n}</span>
        {done && <span className="text-sm font-semibold text-lime-600">✓ done</span>}
      </div>
      <span className="font-display text-lg leading-tight">{title}</span>
      <span className="text-xs text-gray-500">{line}</span>
      {learn && <span className="rounded-full bg-fuchsia-50 px-2 text-[11px] text-fuchsia-700">{learn}</span>}
    </div>
  );
}
