"use client";
// /play/lab: the hands-on chemistry lab. Pick a topic by pointing (☝️ hold) or closing your hand (✊) on a card,
// then do the chemistry with your hands. Molecule Builder runs here; the other topics open the worksheet game.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BuilderOverlay, BuilderScene } from "@/game/lab/MoleculeBuilder";
import { MOLECULE_QUESTIONS } from "@/game/molecules";
import { subscribe, useGame } from "@/game/store";
import { CameraView } from "@/motion/CameraView";
import { DebugOverlay } from "@/motion/DebugOverlay";
import { MotionProvider } from "@/motion/MotionProvider";
import { useTarget } from "@/motion/targets";
import { Arena } from "@/three/Arena";
import { HandCursors } from "@/three/HandCursor";

type Topic = { id: string; icon: string; title: string; sub: string; href?: string };
const TOPICS: Topic[] = [
  { id: "molecules", icon: "⚛️", title: "Build Molecules", sub: "formulas · grab the atoms" },
  { id: "reactions", icon: "🧪", title: "Mixing Reactions", sub: "precipitates · gases", href: "/play/ws_chem_demo?world=1" },
  { id: "titration", icon: "⚗️", title: "Titration", sub: "acids & bases", href: "/play/fixture?world=1" },
  { id: "balancing", icon: "⚖️", title: "Balancing", sub: "equations", href: "/play/ws_chem_demo?world=1" },
];

export default function LabPage() {
  return (
    <MotionProvider>
      <Lab />
      <HandCursors accent="#E879F9" />
      <DebugOverlay />
    </MotionProvider>
  );
}

function Lab() {
  const router = useRouter();
  const [screen, setScreen] = useState<"topics" | "molecules" | "finished">("topics");
  const [qi, setQi] = useState(0);
  const q = MOLECULE_QUESTIONS[qi];

  useEffect(() => {
    if (screen !== "topics") return;
    return subscribe("dwell", (e) => {
      const t = TOPICS.find((x) => `topic:${x.id}` === e.targetId);
      if (!t) return;
      if (t.href) router.push(t.href);
      else setScreen("molecules");
    });
  }, [screen, router]);

  const next = useCallback(() => {
    if (qi + 1 < MOLECULE_QUESTIONS.length) setQi(qi + 1);
    else setScreen("finished");
  }, [qi]);

  return (
    <div className="fixed inset-0 overflow-hidden">
      <Arena accent="#E879F9" still room="balance">
        {screen === "molecules" && <BuilderScene q={q} />}
      </Arena>
      {screen === "topics" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-8 bg-navy/40">
          <div className="text-center">
            <h1 className="font-display text-5xl">Welcome to the lab 🥼</h1>
            <p className="mt-2 text-xl text-muted">Point ☝️ at a topic and hold, or close your hand ✊ on it. (Mouse click works too.)</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {TOPICS.map((t) => (
              <TopicCard key={t.id} t={t} />
            ))}
          </div>
        </div>
      )}
      {screen === "molecules" && <BuilderOverlay q={q} index={qi} total={MOLECULE_QUESTIONS.length} onNext={next} />}
      {screen === "finished" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-navy/60">
          <div className="text-center">
            <h2 className="font-display text-5xl">All molecules built! ⚛️</h2>
            <button className="mt-6 rounded-xl border border-cyan px-5 py-2 text-cyan" onClick={() => { setQi(0); setScreen("topics"); }}>Back to topics</button>
          </div>
        </div>
      )}
      <div className="pointer-events-none fixed bottom-4 right-4 z-40">
        <CameraView className="h-[120px] w-[160px] rounded-xl border border-line" />
      </div>
    </div>
  );
}

function TopicCard({ t }: { t: Topic }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(`topic:${t.id}`, ref);
  const over = useGame((s) => s.cursors.left.targetId === `topic:${t.id}` || s.cursors.right.targetId === `topic:${t.id}`);
  return (
    <div ref={ref} {...mouse} role="button"
      className={`flex h-[220px] w-[240px] cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-3xl border-2 bg-navy/85 text-center shadow-2xl transition-transform ${over ? "scale-105 border-magenta" : "border-line"}`}>
      <span className="text-6xl">{t.icon}</span>
      <span className="font-display text-2xl">{t.title}</span>
      <span className="text-sm text-muted">{t.sub}</span>
    </div>
  );
}
