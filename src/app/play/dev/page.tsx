"use client";
// /play/dev: motion test bench (P1-01…P1-05). Camera + Pose, hand cursors, 4 dwell targets, every gesture armed,
// debug overlay on D, and an event log. Everything also works keyboard-only.
import { useEffect, useRef, useState } from "react";
import { subscribe, useGame } from "@/game/store";
import { CameraView } from "@/motion/CameraView";
import { ClipRecorder } from "@/motion/ClipRecorder";
import { DebugOverlay } from "@/motion/DebugOverlay";
import { MotionProvider } from "@/motion/MotionProvider";
import { useTarget } from "@/motion/targets";
import type { MotionEvent } from "@/motion/types";
import { HandCursors } from "@/three/HandCursor";

export default function MotionDevPage() {
  return (
    <MotionProvider>
      <DevBench />
      <HandCursors />
      <DebugOverlay />
    </MotionProvider>
  );
}

const TARGETS = ["A", "B", "C", "D"];

function DevBench() {
  const [log, setLog] = useState<MotionEvent[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const cam = useGame((s) => s.cam);

  useEffect(() => {
    const { arm, resetArming } = useGame.getState();
    arm("clap");
    arm("fire");
    const off = subscribe("*", (e) => {
      setLog((l) => [...l.slice(-11), e]);
      const key = e.type === "command" ? `cmd:${e.cmd}` : e.type;
      setCounts((c) => ({ ...c, [key]: (c[key] ?? 0) + 1 }));
      if (e.type === "dwell" && e.targetId) setPicked(e.targetId);
      if (e.type === "command" && e.cmd === "pick" && e.value !== undefined) setPicked(`dev:${TARGETS[e.value]}`);
    });
    return () => {
      off();
      resetArming();
    };
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Motion dev</h1>
          <p className="text-muted">
            cam: {cam} · <b>D</b> debug · Enter bothUp · C clap · ←/→ lean · Space fire · 1–4 pick · click = dwell
          </p>
        </div>
        <CameraView className="h-[180px] w-[240px] rounded-xl border border-line" />
      </header>

      {/* Dwell targets: in the middle band (35–75% of the screen), ≥ 160 px and ≥ 40 px apart (04 §6). */}
      <div className="mt-[8vh] flex flex-wrap justify-center gap-[60px]">
        {TARGETS.map((id) => (
          <DevTarget key={id} id={`dev:${id}`} label={id} picked={picked === `dev:${id}`} />
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <h2 className="mb-2 font-semibold">Counts</h2>
          <div className="flex flex-wrap gap-2 font-mono text-sm">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k} className="rounded bg-navy px-2 py-1">
                {k}: {v}
              </span>
            ))}
            <button className="rounded border border-line px-2 py-1 text-muted" onClick={() => setCounts({})}>
              reset
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4 font-mono text-xs">
          <h2 className="mb-2 font-sans text-base font-semibold">Events</h2>
          {log.slice().reverse().map((e, i) => (
            <div key={`${e.t}-${i}`}>
              {e.type === "command" ? `cmd:${e.cmd} ${e.value ?? ""}` : e.type} {"side" in e && e.side ? e.side : ""}{" "}
              {"targetId" in e && e.targetId ? `→ ${e.targetId}` : ""} {"ms" in e && e.ms ? `${e.ms}ms` : ""}{" "}
              <span className="text-muted">[{e.source}]</span>
            </div>
          ))}
        </div>
      </section>
      <ClipRecorder />
    </main>
  );
}

function DevTarget({ id, label, picked }: { id: string; label: string; picked: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const mouse = useTarget(id, ref);
  const over = useGame((s) => s.cursors.left.targetId === id || s.cursors.right.targetId === id);
  return (
    <div
      ref={ref}
      {...mouse}
      className={`grid h-[180px] w-[220px] cursor-pointer select-none place-items-center rounded-2xl border-2 text-4xl font-bold transition-colors ${
        picked ? "border-lime bg-lime/15 text-lime" : over ? "border-cyan bg-cyan/10" : "border-line bg-panel"
      }`}
    >
      {label}
    </div>
  );
}
