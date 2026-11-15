"use client";
// src/game/lab/TitrationLab.tsx: the Titration Lab in the Acids & Bases room (chemistry-plan/03-titration-lab.md).
// 25.00 mL of 0.100 M HCl + phenolphthalein in the flask, 0.200 M NaOH in the burette. Your hand height is the
// stopcock (W / S on the keyboard): drops of 0.05 mL fall, the pH meter and the curve update per drop, the flask turns
// pink at the endpoint. Stop and read (Space, the big button, or both hands up only once the stopcock is closed), record
// the equivalence volume in the lab notebook (4 code-built answers, no balloons), then a reveal replays a perfect run:
// 12.50 mL at pH 7 (still colorless), one drop more = pink. Guided steps like the Experiments Lab. Virtual only.
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { Color, Group, Mesh, MeshStandardMaterial } from "three";
import { useTarget } from "@/motion/targets";
import { equivalenceML } from "@/lib/acidBase";
import { ChemText } from "../ChemText";
import { playSfx } from "../sfx";
import { subscribe, useGame } from "../store";
import { BURETTE_ML, DROP_ML, dripRate, flaskAt, stopWindow, TAG_LABEL, titrationChoices, TITRATION_DEMO, WINDOW_TEXT, type Choice } from "../titration";
import { Bench, ExpHeader, GuidePanel, resetBench, ResultCard, useBench, useDelayedCard, useExpKeys, type Step } from "./benchKit";

const EQ = equivalenceML(TITRATION_DEMO); // 12.50 mL, by code
const CHOICES = titrationChoices();
type Phase = "intro" | "drip" | "answer" | "reveal" | "done";
type TState = {
  phase: Phase;
  ml: number; // NaOH added by the student
  keyP: number; // stopcock opening from W / S
  p: number; // effective opening (hand or keys), for the HUD
  stoppedML: number | null;
  choice: Choice["id"] | null;
  demoML: number; // the reveal's perfect run
  curve: { ml: number; pH: number }[];
  closedSince: number; // when the stopcock last went under 0.10 (both-hands-up only stops after 400 ms closed)
};
const fresh = (): TState => ({ phase: "intro", ml: 0, keyP: 0, p: 0, stoppedML: null, choice: null, demoML: 0, curve: [{ ml: 0, pH: flaskAt(0).pH }], closedSince: 0 });
export const useTitration = create<TState>(() => fresh());

function stopAndRead() {
  const s = useTitration.getState();
  if (s.phase !== "drip" || s.ml <= 0) return;
  useTitration.setState({ phase: "answer", stoppedML: s.ml, keyP: 0, p: 0 });
  playSfx("pop", 0.4);
}
function choose(id: Choice["id"]) {
  const s = useTitration.getState();
  if (s.phase !== "answer") return;
  const c = CHOICES.find((x) => x.id === id)!;
  useTitration.setState({ choice: id, phase: "reveal", demoML: 0 });
  playSfx(c.correct ? "correct" : "wrong", 0.6);
}

const STEPS: Step[] = [
  { text: "Read the setup: HCl + phenolphthalein in the flask, NaOH in the burette", why: "We want the volume of NaOH that exactly neutralizes the acid.", done: () => false },
  { text: "Open the stopcock (raise your hand, or W) and drip in NaOH", item: "stopcock", why: "Each drop is 0.05 mL; the pH meter and the curve update per drop.", done: () => false },
  { text: "At the first lasting pink, close it and Stop and read (Space)", item: "stop", why: "The first lasting pink is the endpoint: the indicator has changed.", done: () => false },
  { text: "Record the equivalence volume in your notebook", item: "notebook", why: "Equivalence: moles of OH⁻ added = moles of H⁺ in the flask.", done: () => false },
  { text: "Watch the reveal: equivalence vs endpoint", why: "At 12.50 mL the pH is 7.00 and it's still colorless; one drop more is pink.", done: () => false },
];
const stepIndex = (p: Phase, ml: number) => (p === "intro" ? 0 : p === "drip" ? (ml > 0 ? 2 : 1) : p === "answer" ? 3 : p === "reveal" ? 4 : 5);

// ---------------------------------------------------------------- DOM

export function TitrationOverlay({ onNext }: { onNext: () => void }) {
  const st = useTitration();
  const run = useBench((s) => s.run);
  useEffect(() => useTitration.setState(fresh()), [run]); // "Again" (R or the button) starts over
  useEffect(() => {
    if (st.phase !== "intro") return;
    const id = setTimeout(() => useTitration.setState({ phase: "drip" }), 3500);
    return () => clearTimeout(id);
  }, [st.phase]);
  // Space is read here directly: the bus's "fire" event is disarmed outside the launcher (and its gesture twin,
  // holding your arm still, would stop the burette by accident while your hand is the stopcock).
  useExpKeys({ " ": stopAndRead, "1": () => choose("A"), "2": () => choose("B"), "3": () => choose("C"), "4": () => choose("D"), r: resetBench });
  useEffect(() => {
    const offs = [
      subscribe("command", (e) => {
        if (e.cmd === "power" && typeof e.value === "number") {
          const s = useTitration.getState();
          if (s.phase === "drip") useTitration.setState({ keyP: Math.max(0, Math.min(1, s.keyP + Math.sign(e.value) * 0.1)) });
        }
      }),
      subscribe("bothUp", () => {
        // Raising the stopcock hand must never skip: both hands up only stops once it's been closed for 400 ms.
        const s = useTitration.getState();
        if (s.phase === "drip" && s.p < 0.1 && performance.now() - s.closedSince > 400) stopAndRead();
      }),
      subscribe("dwell", (e) => {
        if (e.targetId === "titr:stop") stopAndRead();
        if (e.targetId?.startsWith("titr:choice:")) choose(e.targetId.slice(12) as Choice["id"]);
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  const shown = st.phase === "reveal" || st.phase === "done" ? st.demoML : st.ml;
  const f = flaskAt(shown);
  const current = stepIndex(st.phase, st.ml);
  const win = st.stoppedML != null ? stopWindow(st.stoppedML) : null;
  const picked = CHOICES.find((c) => c.id === st.choice);
  const show = useDelayedCard(st.phase === "done", 600);
  const hint =
    st.phase === "intro" ? "Get ready…" :
    st.phase === "drip" ? (st.ml === 0 ? "Raise your hand (or press W) to open the stopcock" : "Watch the flask. At the first pink that stays, close the stopcock and Stop and read (Space).") :
    st.phase === "answer" ? "What volume of NaOH is needed to reach equivalence? Pick it in your notebook (1–4)." :
    st.phase === "reveal" ? "Reveal: a perfect run. Watch the pH at 12.50 mL…" : null;

  return (
    <>
      <ExpHeader kicker="Titration Lab · acid–base and indicators" title="⚗️ Find the volume of NaOH that neutralizes the acid."
        chips={[
          { ok: shown > 0, text: `Burette ${shown.toFixed(2)} mL` },
          { ok: true, text: `pH ${f.pH.toFixed(2)}` },
          { ok: f.strength > 0.05, text: `Flask: ${f.label}` },
          ...(st.phase === "drip" ? [{ ok: st.p >= 0.1, text: st.p >= 0.1 ? `Stopcock ${Math.round(st.p * 100)}% open` : "Stopcock closed" }] : []),
        ]}
        hint={hint} />
      <div className="pointer-events-none absolute right-4 top-4 z-40 rounded-full border border-amber/60 bg-navy/85 px-3 py-1 text-xs text-amber">⚠️ Virtual only</div>
      <GuidePanel steps={STEPS} current={current} />
      <PhPanel phase={st.phase} curve={st.curve} shown={shown} stopped={st.stoppedML} />

      {st.phase === "intro" && (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-navy/50">
          <div className="max-w-[640px] rounded-3xl border border-cyan/50 bg-navy/95 p-6 text-center shadow-2xl">
            <div className="text-sm uppercase tracking-wider text-muted">Titration</div>
            <div className="mt-2 font-display text-2xl leading-snug">
              {TITRATION_DEMO.analyte.volumeML.toFixed(2)} mL of {TITRATION_DEMO.analyte.molarity.toFixed(3)} M <ChemText text="HCl" /> is titrated with {TITRATION_DEMO.titrant.molarity.toFixed(3)} M <ChemText text="NaOH" />. Phenolphthalein is the indicator. What volume of NaOH reaches equivalence?
            </div>
            <div className="mt-3 text-sm text-amber">⚠️ Virtual only: strong acids and bases are corrosive.</div>
          </div>
        </div>
      )}

      {st.phase === "drip" && <StopButton />}

      {st.phase === "answer" && (
        <div className="absolute inset-x-0 bottom-[3vh] z-30 flex flex-col items-center gap-2 px-4">
          {win && <div className="rounded-full border border-line bg-navy/90 px-4 py-1.5 text-sm">You stopped at <b>{st.stoppedML!.toFixed(2)} mL</b> (pH {flaskAt(st.stoppedML!).pH.toFixed(2)}, {flaskAt(st.stoppedML!).label}). {WINDOW_TEXT[win]}</div>}
          <div className="rounded-2xl border border-cyan/50 bg-[#FFFDF7] p-3 text-[#1F2937] shadow-2xl">
            <div className="mb-2 text-center font-display text-lg">📓 Notebook: volume of NaOH needed for <b>equivalence</b>?</div>
            <div className="flex gap-3">
              {CHOICES.map((c, i) => <ChoiceCard key={c.id} c={c} n={i + 1} />)}
            </div>
          </div>
        </div>
      )}

      {show && picked && (
        <ResultCard title={picked.correct ? `Right: ${picked.text} reaches equivalence.` : `Not quite: equivalence is at ${EQ.toFixed(2)} mL.`} equation="HCl + NaOH -> NaCl + H2O" onNext={onNext} recap={STEPS} nextLabel="Next ▶"
          why={[
            "Equivalence: moles of OH⁻ added = moles of H⁺ in the flask. Here that is 12.50 mL, and the pH is exactly 7.00.",
            "Phenolphthalein only turns pink above pH 8.2, so at equivalence the flask is still colorless. One more drop (12.55 mL) jumps the pH to 10.43: first pink, the endpoint.",
            "The NaOH is twice as concentrated as the acid, so it takes half the volume: matching volumes (25.00 mL) is a classic mistake.",
          ]}
          numbers={<>
            <div><b>V(NaOH) = M(HCl) × V(HCl) ÷ M(NaOH) = (0.100 × 25.00) ÷ 0.200 = <span className="text-lime">{EQ.toFixed(2)} mL</span></b></div>
            {win && <div className="mt-1">Your stop: {st.stoppedML!.toFixed(2)} mL → {WINDOW_TEXT[win]}</div>}
            <div className="mt-1">Your answer: <b className={picked.correct ? "text-lime" : "text-coral"}>{picked.id}. {picked.text}</b>{picked.tag ? <> · <span className="text-coral">{TAG_LABEL[picked.tag]}</span></> : null}. {picked.why}</div>
          </>} />
      )}
    </>
  );
}

function StopButton() {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget("titr:stop", ref);
  return (
    <div ref={ref} {...mouse} role="button" className="pointer-events-auto absolute bottom-[4vh] left-1/2 z-30 grid h-[90px] w-[220px] -translate-x-1/2 cursor-pointer place-items-center rounded-2xl border-2 border-lime/80 bg-navy/90 text-center text-lime shadow-xl">
      <span className="font-display text-2xl">■ Stop and read</span>
      <span className="text-xs text-muted">Space · point and hold · both hands up (stopcock closed)</span>
    </div>
  );
}

function ChoiceCard({ c, n }: { c: Choice; n: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = `titr:choice:${c.id}`;
  const mouse = useTarget(id, ref);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  return (
    <div ref={ref} {...mouse} role="button" className={`pointer-events-auto grid h-[86px] w-[150px] cursor-pointer place-items-center rounded-xl border-2 text-center transition-transform ${over ? "scale-105 border-fuchsia-500 bg-fuchsia-50" : "border-gray-300 bg-white"}`}>
      <span className="text-xs text-gray-500">{c.id} · key {n}</span>
      <span className="font-display text-2xl">{c.text}</span>
    </div>
  );
}

/** pH meter + the titration curve drawing itself (V_eq line only on the reveal). */
function PhPanel({ phase, curve, shown, stopped }: { phase: Phase; curve: { ml: number; pH: number }[]; shown: number; stopped: number | null }) {
  const W = 260, H = 150, X = 25; // x: 0–25 mL, y: pH 0–14
  const pts = (phase === "reveal" || phase === "done" ? revealCurve(shown) : curve).map((c) => `${(c.ml / X) * W},${H - (c.pH / 14) * H}`).join(" ");
  const f = flaskAt(shown);
  const eqX = (EQ / X) * W;
  return (
    <div className="pointer-events-none absolute right-4 top-[9.5rem] z-30 w-[290px] rounded-2xl border border-cyan/40 bg-navy/90 p-3 shadow-xl">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted">pH meter</span>
        <span className="font-mono text-3xl text-cyan">{f.pH.toFixed(2)}</span>
      </div>
      <svg width={W} height={H + 16} className="mt-2 overflow-visible">
        <rect x={0} y={0} width={W} height={H} fill="#0B1020" stroke="#334155" />
        {[7].map((y) => <line key={y} x1={0} x2={W} y1={H - (y / 14) * H} y2={H - (y / 14) * H} stroke="#334155" strokeDasharray="3 3" />)}
        {(phase === "reveal" || phase === "done") && <line x1={eqX} x2={eqX} y1={0} y2={H} stroke="#A3E635" strokeDasharray="4 3" />}
        {stopped != null && (phase === "reveal" || phase === "done") && Math.abs(stopped - EQ) > 0.06 && <line x1={(Math.min(stopped, X) / X) * W} x2={(Math.min(stopped, X) / X) * W} y1={0} y2={H} stroke="#FB7185" strokeDasharray="4 3" />}
        <polyline points={pts} fill="none" stroke="#E75480" strokeWidth={2.5} />
        <text x={0} y={H + 13} fontSize={10} fill="#94A3B8">0 mL</text>
        <text x={W} y={H + 13} fontSize={10} fill="#94A3B8" textAnchor="end">25 mL NaOH</text>
        <text x={4} y={H - (7 / 14) * H - 3} fontSize={10} fill="#94A3B8">pH 7</text>
        {(phase === "reveal" || phase === "done") && <text x={eqX + 3} y={12} fontSize={10} fill="#A3E635">V_eq {EQ.toFixed(2)}</text>}
      </svg>
    </div>
  );
}
const revealCurve = (upTo: number) => {
  const out: { ml: number; pH: number }[] = [];
  for (let v = 0; v <= upTo + 1e-9; v += 0.25) out.push({ ml: v, pH: flaskAt(v).pH });
  if (upTo > 12.4) for (const v of [12.45, 12.5, 12.55].filter((x) => x <= upTo + 1e-9)) out.push({ ml: v, pH: flaskAt(v).pH });
  return out.sort((a, b) => a.ml - b.ml);
};

// ---------------------------------------------------------------- 3D

const FLASK = { x: 0.35, z: 0.6 };
const TIP_Y = 1.12, TOP_Y = 2.72; // burette tip / top of its scale
const PER_ML = (TOP_Y - TIP_Y - 0.08) / BURETTE_ML;
const ACID = new Color("#EAF6FB");
const N_DROPS = 6;

export function TitrationScene() {
  const liquid = useRef<Mesh>(null);
  const column = useRef<Mesh>(null);
  const tap = useRef<Group>(null);
  const ghost = useRef<Mesh>(null);
  const eqRing = useRef<Mesh>(null);
  const drops = useRef<(Mesh | null)[]>([]);
  const sim = useRef({ drops: new Float32Array(N_DROPS).fill(-1), next: 0, acc: 0, lastDrops: 0, revealT: 0 });
  const tmp = useMemo(() => new Color(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const S = sim.current;
    const st = useTitration.getState();
    // Stopcock opening: your power hand's height (high = open), else W / S.
    const G = useGame.getState();
    const hand = G.cursors.right.visible ? G.cursors.right : G.cursors.left.visible ? G.cursors.left : null;
    const H = typeof window !== "undefined" ? window.innerHeight : 800;
    const handP = hand ? Math.max(0, Math.min(1, (0.72 * H - hand.y) / (0.45 * H))) : 0;
    // Whichever opens it more: a hand in view never blocks the keyboard (S / Space still close it).
    const p = st.phase === "drip" ? Math.max(hand ? handP : 0, st.keyP) : 0;
    if (Math.abs(p - st.p) > 0.02 || (p < 0.1) !== (st.p < 0.1)) useTitration.setState({ p, closedSince: p < 0.1 && st.p >= 0.1 ? performance.now() : st.closedSince });

    let shown = st.ml;
    if (st.phase === "drip") {
      S.acc += dripRate(p) * Math.min(rawDt, 0.1);
      if (S.acc >= DROP_ML && st.ml < BURETTE_ML) {
        const n = Math.floor(S.acc / DROP_ML);
        S.acc -= n * DROP_ML;
        const ml = Math.min(BURETTE_ML, +(st.ml + n * DROP_ML).toFixed(2));
        const pt = { ml, pH: flaskAt(ml).pH };
        useTitration.setState({ ml, curve: [...st.curve, pt] });
        shown = ml;
        for (let k = 0; k < Math.min(n, 2); k++) { S.drops[S.next] = 0; S.next = (S.next + 1) % N_DROPS; }
        if (flaskAt(ml).strength > 0.05 && flaskAt(st.ml).strength <= 0.05) playSfx("correct", 0.35); // first pink chime
      }
    } else if (st.phase === "reveal") {
      // Perfect run: 0 → 12.50 mL in 4 s, hold 1.4 s (pH 7, colorless), then one drop to 12.55 mL (pink), hold.
      S.revealT += dt;
      const t = S.revealT;
      const demo = t < 4 ? +(Math.floor(((t / 4) * EQ) / DROP_ML) * DROP_ML).toFixed(2) : t < 5.4 ? EQ : +(EQ + DROP_ML).toFixed(2);
      if (demo !== st.demoML) {
        if (demo > st.demoML) { S.drops[S.next] = 0; S.next = (S.next + 1) % N_DROPS; }
        useTitration.setState({ demoML: demo });
      }
      if (t > 7.2) useTitration.setState({ phase: "done" });
      shown = demo;
    } else if (st.phase === "done") shown = st.demoML;
    if (st.phase !== "reveal") S.revealT = 0;

    // Burette column drains from the top; flask colour from the indicator at this pH.
    const c = column.current;
    if (c) {
      const len = Math.max(0.001, (BURETTE_ML - shown) * PER_ML);
      c.scale.y = len;
      c.position.y = TIP_Y + 0.08 + len / 2;
    }
    const f = flaskAt(shown);
    const lq = liquid.current;
    if (lq) {
      const m = lq.material as MeshStandardMaterial;
      m.color.copy(tmp.copy(ACID).lerp(new Color(f.hex), Math.min(1, f.strength * 1.15)));
      m.emissive.copy(m.color);
      m.emissiveIntensity = 0.12 + f.strength * 0.2;
      const level = 0.28 + (shown / BURETTE_ML) * 0.16;
      lq.scale.y = level;
      lq.position.y = 0.04 + (0.5 * level) / 2;
    }
    if (tap.current) tap.current.rotation.y = (p * Math.PI) / 2;
    // Drops: tip → flask mouth.
    for (let i = 0; i < N_DROPS; i++) {
      const m = drops.current[i];
      if (!m) continue;
      if (S.drops[i] >= 0) {
        S.drops[i] += dt * 3.2;
        if (S.drops[i] > 1) S.drops[i] = -1;
      }
      m.visible = S.drops[i] >= 0;
      if (m.visible) m.position.set(FLASK.x, TIP_Y - 0.05 - S.drops[i] * (TIP_Y - 0.6), FLASK.z);
    }
    // Reveal marks on the burette: lime at equivalence, coral "ghost" at the student's stop if they were off.
    const rv = st.phase === "reveal" || st.phase === "done";
    if (eqRing.current) {
      eqRing.current.visible = rv;
      eqRing.current.position.y = TOP_Y - EQ * PER_ML;
    }
    if (ghost.current) {
      const off = st.stoppedML != null && Math.abs(st.stoppedML - EQ) > 0.06;
      ghost.current.visible = rv && off;
      if (st.stoppedML != null) ghost.current.position.y = TOP_Y - Math.min(BURETTE_ML, st.stoppedML) * PER_ML;
    }
  });

  return (
    <group>
      <Bench />
      {/* Ring stand + clamp */}
      <mesh position={[-0.35, 0.03, FLASK.z]}><boxGeometry args={[0.8, 0.05, 0.5]} /><meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[-0.55, 1.5, FLASK.z]}><cylinderGeometry args={[0.025, 0.025, 3.0, 12]} /><meshStandardMaterial color="#9CA3AF" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[-0.1, 2.25, FLASK.z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.9, 10]} /><meshStandardMaterial color="#9CA3AF" metalness={0.8} roughness={0.3} /></mesh>
      {/* Burette: glass tube, NaOH column, scale marks every 1 mL (longer every 5), stopcock, tip */}
      <group position={[FLASK.x, 0, FLASK.z]}>
        <mesh position={[0, (TIP_Y + TOP_Y) / 2 + 0.06, 0]}><cylinderGeometry args={[0.055, 0.055, TOP_Y - TIP_Y + 0.12, 20, 1, true]} /><meshStandardMaterial color="#E0F2FE" transparent opacity={0.3} side={2} depthWrite={false} /></mesh>
        <mesh ref={column} position={[0, 1.9, 0]}><cylinderGeometry args={[0.045, 0.045, 1, 16]} /><meshStandardMaterial color="#DDEFFC" transparent opacity={0.85} /></mesh>
        {Array.from({ length: BURETTE_ML + 1 }, (_, i) => (
          <mesh key={i} position={[0.06, TOP_Y - i * PER_ML, 0.0]}><boxGeometry args={[i % 5 === 0 ? 0.05 : 0.025, 0.004, 0.004]} /><meshStandardMaterial color="#1F2937" /></mesh>
        ))}
        <mesh ref={eqRing} visible={false} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.075, 0.008, 8, 24]} /><meshStandardMaterial color="#A3E635" emissive="#A3E635" emissiveIntensity={0.8} /></mesh>
        <mesh ref={ghost} visible={false} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.08, 0.01, 8, 24]} /><meshStandardMaterial color="#FB7185" emissive="#FB7185" emissiveIntensity={0.8} /></mesh>
        <group ref={tap} position={[0, TIP_Y + 0.04, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.2, 10]} /><meshStandardMaterial color="#0EA5E9" /></mesh>
        </group>
        <mesh position={[0, TIP_Y - 0.02, 0]}><coneGeometry args={[0.02, 0.08, 10]} /><meshStandardMaterial color="#E0F2FE" transparent opacity={0.6} /></mesh>
      </group>
      {/* White tile + Erlenmeyer flask with the acid (colour = phenolphthalein at this pH) */}
      <mesh position={[FLASK.x, 0.015, FLASK.z]}><boxGeometry args={[0.9, 0.03, 0.7]} /><meshStandardMaterial color="#FFFFFF" roughness={0.6} /></mesh>
      <group position={[FLASK.x, 0.03, FLASK.z]}>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.13, 0.42, 0.6, 32, 1, true]} /><meshStandardMaterial color="#E0F2FE" transparent opacity={0.28} side={2} depthWrite={false} /></mesh>
        <mesh position={[0, 0.68, 0]}><cylinderGeometry args={[0.1, 0.12, 0.18, 20, 1, true]} /><meshStandardMaterial color="#E0F2FE" transparent opacity={0.28} side={2} depthWrite={false} /></mesh>
        <mesh ref={liquid} position={[0, 0.1, 0]}><cylinderGeometry args={[0.3, 0.4, 0.5, 32]} /><meshStandardMaterial color="#EAF6FB" transparent opacity={0.88} roughness={0.2} /></mesh>
      </group>
      {Array.from({ length: N_DROPS }, (_, i) => (
        <mesh key={i} ref={(el) => void (drops.current[i] = el)} visible={false}><sphereGeometry args={[0.022, 10, 8]} /><meshStandardMaterial color="#DDEFFC" /></mesh>
      ))}
    </group>
  );
}
