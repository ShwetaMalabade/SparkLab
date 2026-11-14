"use client";
// src/motion/ClipRecorder.tsx: records 10 s landmark clips (P1-19, docs/plan/04 §10) on /play/dev.
// Pick a preset → 3 s countdown → 10 s of raw landmarks (upper body only, never video) → downloads <name>.json.
// Drop the files into tests/fixtures/ and `npx tsx tests/gestures.test.ts` replays them.
import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { CLIP_PRESETS, checkClip, packFrame, replayClip, type Clip, type ClipFrame } from "./clips";
import { engine } from "./gestures";
import { allTargetRects } from "./targets";

const COUNTDOWN_MS = 3000;
const RECORD_MS = 10000;

type State = { kind: "idle" } | { kind: "countdown"; until: number } | { kind: "recording"; until: number } | { kind: "done"; clip: Clip; verdict: string[] };

export function ClipRecorder() {
  const [preset, setPreset] = useState(CLIP_PRESETS[0].name);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [now, setNow] = useState(0);
  const frames = useRef<ClipFrame[]>([]);
  const meta = useRef({ vw: 640, vh: 480, sw: 1280, sh: 720 });
  const timers = useRef<{ ids: ReturnType<typeof setTimeout>[]; off: (() => void) | null }>({ ids: [], off: null });
  const p = CLIP_PRESETS.find((x) => x.name === preset)!;
  const busy = state.kind === "countdown" || state.kind === "recording";

  const stop = () => {
    timers.current.ids.forEach(clearTimeout);
    timers.current.off?.();
    timers.current = { ids: [], off: null };
  };
  useEffect(() => stop, []);

  // Clock for the on-screen countdown.
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [busy]);

  const start = () => {
    stop();
    engine.setOptions({ aimMode: p.aimMode });
    const G = useGame.getState();
    G.resetArming();
    p.arm.forEach((g) => G.arm(g, true));
    const t0 = performance.now();
    setNow(t0);
    setState({ kind: "countdown", until: t0 + COUNTDOWN_MS });

    const finish = () => {
      timers.current.off?.();
      timers.current.off = null;
      const clip: Clip = {
        name: p.name,
        recordedAt: new Date().toISOString(),
        video: { w: meta.current.vw, h: meta.current.vh },
        screen: { w: meta.current.sw, h: meta.current.sh },
        aimMode: p.aimMode,
        leftHanded: engine.opts.leftHanded,
        arm: p.arm,
        baseline: engine.baseline,
        targets: allTargetRects(),
        expect: p.expect,
        frames: frames.current,
      };
      // Replaying moves the live engine's state; it re-syncs on the next camera frame.
      const verdict = checkClip(clip, replayClip(clip, performance.now() + 1e6));
      useGame.getState().arm("clap"); // the dev bench keeps every gesture armed
      useGame.getState().arm("fire");
      setState({ kind: "done", clip, verdict });
    };
    const record = () => {
      frames.current = [];
      timers.current.off = engine.onRaw((raw, t, vw, vh, sw, sh) => {
        meta.current = { vw, vh, sw, sh };
        frames.current.push(packFrame(raw, t));
      });
      setState({ kind: "recording", until: performance.now() + RECORD_MS });
      timers.current.ids.push(setTimeout(finish, RECORD_MS));
    };
    timers.current.ids.push(setTimeout(record, COUNTDOWN_MS));
  };

  const download = (clip: Clip) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(clip)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clip.name}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const left = busy ? Math.max(0, Math.ceil((state.until - now) / 1000)) : 0;

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <h2 className="mb-2 font-semibold">Record a test clip (landmarks only, no video)</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select value={preset} disabled={busy} onChange={(e) => setPreset(e.target.value)} className="rounded-lg border border-line bg-navy px-2 py-1">
          {CLIP_PRESETS.map((x) => (
            <option key={x.name} value={x.name}>
              {x.label}
            </option>
          ))}
        </select>
        <button onClick={start} disabled={busy} className="rounded-lg border border-coral/60 px-3 py-1 text-coral disabled:opacity-50">
          ● Record 10 s
        </button>
        {state.kind === "countdown" && <span className="text-amber">Get ready… {left}</span>}
        {state.kind === "recording" && <span className="text-coral">● Recording… {left} s</span>}
      </div>
      <p className="mt-2 text-sm text-muted">{p.how}</p>
      {state.kind === "done" && (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <span>
            {state.clip.frames.length} frames ·{" "}
            {state.verdict.length === 0 ? <b className="text-lime">✓ replay passes</b> : <b className="text-coral">✗ {state.verdict.join(" · ")}</b>}
          </span>
          <div className="flex gap-2">
            <button onClick={() => download(state.clip)} className="rounded-lg border border-cyan/60 px-3 py-1 text-cyan">
              ⬇ Save {state.clip.name}.json
            </button>
            <button onClick={() => setState({ kind: "idle" })} className="rounded-lg border border-line px-3 py-1 text-muted">
              Discard
            </button>
          </div>
          <span className="text-muted">Then move it into tests/fixtures/ (keep a failing one too: it shows what to tune). The replay also shows in the event log above.</span>
        </div>
      )}
    </div>
  );
}
