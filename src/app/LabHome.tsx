"use client";
// The home page (/): the hands-on chemistry lab. (Was /play/lab, which now forwards here.)
// 1. You're in the 3D lab building. A bubble over your student asks "Which one do you want to learn today?"
// 2. Choose a subject with your hand (☝️ point and hold, or ✊ close your hand on it; click works too).
// 3. The student walks to that room by himself and asks "Ready for questions?" → ✊ Yes.
// 4. Hands-on questions at the bench: build molecules from atoms, pour liquids and watch the reaction + why.
// 5. Back in the building for the next subject (finished rooms get a ✓).
import { useProgress } from "@react-three/drei";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LESSONS, type Activity } from "@/game/lab/lessons";
import { BuilderOverlay, BuilderScene } from "@/game/lab/MoleculeBuilder";
import { PourOverlay, PourScene } from "@/game/lab/PourLab";
import { ExperimentsOverlay, ExperimentsScene } from "@/game/lab/ExperimentsHub";
import { subscribe, useGame } from "@/game/store";
import { CameraView } from "@/motion/CameraView";
import { DebugOverlay } from "@/motion/DebugOverlay";
import { MotionProvider } from "@/motion/MotionProvider";
import { useTarget } from "@/motion/targets";
import { Arena } from "@/three/Arena";
import { HandCursors } from "@/three/HandCursor";
import { LabWorld, roomOf, type RoomId } from "@/three/lab/LabWorld";
import { Pinned } from "@/three/WorldLabels";

const SUBJECTS: { room: RoomId; icon: string; soon?: boolean }[] = [
  { room: "balance", icon: "🧬" },
  { room: "mix", icon: "🧪" },
  { room: "titration", icon: "⚗️" },
  { room: "study", icon: "🌋" },
];

type Stage = { s: "choose" } | { s: "walking"; room: RoomId } | { s: "ready"; room: RoomId } | { s: "activity"; room: RoomId; i: number };

export function LabHome() {
  return (
    <MotionProvider>
      <Lab />
      <HandCursors accent="#E879F9" />
      <DebugOverlay />
    </MotionProvider>
  );
}

function Lab() {
  const [stage, setStage] = useState<Stage>({ s: "choose" });
  const [done, setDone] = useState<RoomId[]>([]);
  const live = useRef(stage);
  useEffect(() => {
    live.current = stage;
  });

  // Choices in the bubble (point / fist / click), and "Ready? Yes" (also Enter / both hands up).
  useEffect(() => {
    const offs = [
      subscribe("dwell", (e) => {
        const st = live.current;
        const id = e.targetId ?? "";
        if (st.s === "choose" && id.startsWith("subj:")) {
          const room = id.slice(5) as RoomId;
          if (!SUBJECTS.find((x) => x.room === room)?.soon) setStage({ s: "walking", room });
        }
        if (st.s === "ready" && id === "ready:yes") setStage({ s: "activity", room: st.room, i: 0 });
        if (st.s === "ready" && id === "ready:back") setStage({ s: "choose" });
      }),
      subscribe("bothUp", () => {
        const st = live.current;
        if (st.s === "ready") setStage({ s: "activity", room: st.room, i: 0 });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  const onArrive = useCallback((room: RoomId) => {
    if (live.current.s === "walking") setStage({ s: "ready", room });
  }, []);

  const next = useCallback(() => {
    const st = live.current;
    if (st.s !== "activity") return;
    const acts = LESSONS[st.room].activities;
    if (st.i + 1 < acts.length) setStage({ ...st, i: st.i + 1 });
    else {
      setDone((d) => (d.includes(st.room) ? d : [...d, st.room]));
      setStage({ s: "choose" });
    }
  }, []);

  const inRoom = stage.s === "activity";
  const act: Activity | null = inRoom ? LESSONS[stage.room].activities[stage.i] : null;
  const target = stage.s === "walking" || stage.s === "ready" ? stage.room : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1A1530]">
      {!inRoom && <LabWorld target={target} done={done} locked={[]} onArrive={onArrive} autoWalk={stage.s === "walking"} />}
      {inRoom && act && (
        <Arena accent="#E879F9" still room={stage.room}>
          {act.kind === "build" ? <BuilderScene q={act.q} /> : act.kind === "pour" ? <PourScene x={act.x} /> : <ExperimentsScene />}
        </Arena>
      )}

      {/* Speech bubble over the student's head */}
      {!inRoom && (
        <div className="pointer-events-none absolute inset-0 z-30">
          <Pinned id="player:head">
            <div className="-translate-y-1/2">
              {stage.s === "choose" && (
                <Bubble title={done.length ? "Great work! What do you want to learn next?" : "Which one do you want to learn today?"}>
                  {SUBJECTS.map((x) => (
                    <Choice key={x.room} id={`subj:${x.room}`} icon={x.icon} label={roomOf(x.room).name} sub={x.soon ? "coming soon" : done.includes(x.room) ? "✓ done" : roomOf(x.room).sub} disabled={x.soon} />
                  ))}
                </Bubble>
              )}
              {stage.s === "walking" && <Bubble title={`Off to the ${roomOf(stage.room).name} lab! 🚶`} />}
              {stage.s === "ready" && (
                <Bubble title="Are you ready for questions?">
                  <Choice id="ready:yes" icon="✊" label="Yes, let's go!" sub="close your hand · Enter" />
                  <Choice id="ready:back" icon="↩" label="Pick another" sub="point and hold" />
                </Bubble>
              )}
            </div>
          </Pinned>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-navy/80 px-4 py-1 text-sm text-muted">
            ☝️ point and hold or ✊ close your hand to choose · drag / Q·E rotate · wheel zoom · WASD walk
          </div>
        </div>
      )}

      {inRoom && act && (
        <>
          <div className="pointer-events-none absolute left-4 top-14 z-40 rounded-full border border-line bg-navy/85 px-4 py-1 text-sm text-muted">
            {LESSONS[stage.room].title} · {stage.i + 1} of {LESSONS[stage.room].activities.length}
          </div>
          {act.kind === "build" ? (
            <BuilderOverlay key={act.q.id} q={act.q} index={stage.i} total={LESSONS[stage.room].activities.length} onNext={next} />
          ) : act.kind === "pour" ? (
            <PourOverlay key={act.x.id} x={act.x} onNext={next} />
          ) : (
            <ExperimentsOverlay onLeave={next} />
          )}
        </>
      )}
      {!inRoom && <Loading />}
      <div className="pointer-events-none fixed bottom-4 right-4 z-40">
        <CameraView className="h-[120px] w-[160px] rounded-xl border border-line" />
      </div>
    </div>
  );
}

function Bubble({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center gap-3 rounded-3xl border-2 border-white/80 bg-[#FFFDF7] px-6 py-4 text-[#1F2937] shadow-2xl">
      <div className="whitespace-nowrap font-display text-2xl">{title}</div>
      {children && <div className="flex gap-3">{children}</div>}
      <div className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white/80 bg-[#FFFDF7]" />
    </div>
  );
}

function Choice({ id, icon, label, sub, disabled }: { id: string; icon: string; label: string; sub: string; disabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref, !disabled);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  return (
    <div ref={ref} {...mouse} role="button"
      className={`pointer-events-auto flex h-[150px] w-[170px] cursor-pointer select-none flex-col items-center justify-center gap-1 rounded-2xl border-2 text-center transition-transform ${
        disabled ? "border-gray-300 opacity-50" : over ? "scale-105 border-fuchsia-500 bg-fuchsia-50" : "border-gray-300 bg-white"
      }`}>
      <span className="text-4xl">{icon}</span>
      <span className="font-display text-lg leading-tight">{label}</span>
      <span className="text-xs text-gray-500">{sub}</span>
    </div>
  );
}

/** While the lab's 3D models download (first visit), show progress instead of an empty screen. */
function Loading() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-[#1A1530]">
      <div className="text-center">
        <div className="text-6xl">🥼</div>
        <div className="mt-3 font-display text-3xl">Opening the lab… {Math.round(progress)}%</div>
      </div>
    </div>
  );
}
