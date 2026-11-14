// src/motion/clips.ts: recorded-landmark clips (docs/plan/04 §10, P1-19). Landmark JSON, never video.
// The recorder on /play/dev saves one clip per preset; tests/gestures.test.ts replays every clip in tests/fixtures/
// through the real engine and checks the preset's expectations.
import { subscribe, useGame } from "@/game/store";
import { engine } from "./gestures";
import type { RawLandmark } from "./pose";
import { registerTarget, type Rect } from "./targets";
import type { AimMode, Baseline, GestureType, MotionEvent } from "./types";

/** What a clip must (and must not) produce when replayed. */
export type ClipExpect = {
  clap?: number;
  bothUp?: number;
  /** At least this many hold-steady fires (fire armed during the replay). */
  fireMin?: number;
  /** Median aim angle over the second half of the clip, ± `thetaTol`. */
  theta?: number;
  thetaTol?: number;
  hover?: { target: string; minMs: number };
  dwell?: string;
};

export type ClipPreset = { name: string; label: string; how: string; aimMode: AimMode; arm: GestureType[]; expect: ClipExpect };

export const CLIP_PRESETS: ClipPreset[] = [
  { name: "clap-x5", label: "Clap ×5", how: "Hands wide apart, then clap. 5 claps, about 1.5 s apart.", aimMode: "forearm", arm: ["clap"], expect: { clap: 5, bothUp: 0 } },
  { name: "bothup-x5", label: "Both hands up ×5", how: "Raise both hands above your head, lower them. 5 times.", aimMode: "forearm", arm: [], expect: { bothUp: 5, clap: 0 } },
  ...([30, 45, 60] as const).flatMap((deg) => [
    { name: `aim-${deg}-forearm`, label: `Aim ${deg}° (forearm)`, how: `Elbow down, forearm at ${deg}° from the table. Hold it.`, aimMode: "forearm" as const, arm: [], expect: { theta: deg, thetaTol: 8 } },
    { name: `aim-${deg}-fullarm`, label: `Aim ${deg}° (full arm)`, how: `Straight arm at ${deg}° from horizontal. Hold it.`, aimMode: "fullArm" as const, arm: [], expect: { theta: deg, thetaTol: 8 } },
  ]),
  { name: "hold-steady", label: "Hold steady (fire)", how: "Aim about 40° and hold completely still for 3 s, twice.", aimMode: "forearm", arm: ["fire"], expect: { fireMin: 1, clap: 0 } },
  { name: "hover-a-pick-b", label: "Hover A, then pick B", how: "Rest a hand on target A for 1 s (don't pick), then move to B and hold until it picks.", aimMode: "forearm", arm: [], expect: { hover: { target: "dev:A", minMs: 500 }, dwell: "dev:B" } },
  { name: "drinking-water", label: "Drinking water", how: "Pick up a cup, drink, put it down. Twice.", aimMode: "forearm", arm: ["clap"], expect: { clap: 0, bothUp: 0 } },
  { name: "scratching-head", label: "Scratching head", how: "Scratch your head with one hand, then the other.", aimMode: "forearm", arm: ["clap"], expect: { clap: 0, bothUp: 0 } },
  { name: "talking-hands", label: "Talking with hands", how: "Talk and gesture naturally for 10 s.", aimMode: "forearm", arm: ["clap"], expect: { clap: 0, bothUp: 0 } },
  { name: "walking-past", label: "Someone walks past behind", how: "Sit still while someone walks behind you.", aimMode: "forearm", arm: ["clap"], expect: { clap: 0, bothUp: 0 } },
];

/** Upper-body landmarks only (0–16), as [x, y, z, visibility] rounded to 4 decimals. */
export type ClipFrame = { t: number; lm: number[][] | null };
export type Clip = {
  name: string;
  recordedAt: string;
  video: { w: number; h: number };
  screen: { w: number; h: number };
  aimMode: AimMode;
  leftHanded: boolean;
  arm: GestureType[];
  baseline: Baseline | null;
  targets: Record<string, Rect>;
  expect: ClipExpect;
  frames: ClipFrame[];
};

const r4 = (n: number) => Math.round(n * 10000) / 10000;
export const packFrame = (raw: RawLandmark[] | null, t: number): ClipFrame => ({
  t: Math.round(t),
  lm: raw ? raw.slice(0, 17).map((p) => [r4(p.x), r4(p.y), r4(p.z), r4(p.visibility ?? 0)]) : null,
});
const unpack = (lm: number[][] | null): RawLandmark[] | null =>
  lm
    ? Array.from({ length: 33 }, (_, i) => (lm[i] ? { x: lm[i][0], y: lm[i][1], z: lm[i][2], visibility: lm[i][3] } : { x: 0.5, y: 1.2, z: 0, visibility: 0 }))
    : null;

export type ReplayResult = { counts: Record<string, number>; thetaMedian: number | null; hoverMs: Record<string, number>; dwells: string[] };

/** Replays a clip through the real engine (fresh state, the clip's own options, arming, baseline and targets). */
export function replayClip(clip: Clip, timeOffset = 0): ReplayResult {
  engine.reset();
  engine.setOptions({ aimMode: clip.aimMode, leftHanded: clip.leftHanded, lockAngle: false, lockSpeed: false });
  engine.setBaseline(clip.baseline);
  const G = useGame.getState();
  G.resetArming();
  clip.arm.forEach((g) => G.arm(g, true));
  const unreg = Object.entries(clip.targets).map(([id, rect]) => registerTarget(id, () => rect));
  const events: MotionEvent[] = [];
  const off = subscribe("*", (e) => events.push(e));
  const thetas: number[] = [];
  const t0 = clip.frames[0]?.t ?? 0;
  clip.frames.forEach((f, i) => {
    engine.process(unpack(f.lm), timeOffset + f.t - t0, clip.video.w, clip.video.h, clip.screen.w, clip.screen.h);
    if (i >= clip.frames.length / 2 && f.lm) thetas.push(engine.latest.theta);
  });
  off();
  unreg.forEach((u) => u());
  G.resetArming();
  const counts: Record<string, number> = {};
  const hoverMs: Record<string, number> = {};
  const dwells: string[] = [];
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.type === "hover" && e.targetId && e.ms) hoverMs[e.targetId] = Math.max(hoverMs[e.targetId] ?? 0, e.ms);
    if (e.type === "dwell" && e.targetId) dwells.push(e.targetId);
  }
  thetas.sort((a, b) => a - b);
  return { counts, thetaMedian: thetas.length ? thetas[Math.floor(thetas.length / 2)] : null, hoverMs, dwells };
}

/** Checks a replay against the clip's expectations. Returns failure messages (empty = pass). */
export function checkClip(clip: Clip, r: ReplayResult): string[] {
  const x = clip.expect;
  const bad: string[] = [];
  const n = (k: string) => r.counts[k] ?? 0;
  if (x.clap !== undefined && n("clap") !== x.clap) bad.push(`clap ${n("clap")} ≠ ${x.clap}`);
  if (x.bothUp !== undefined && n("bothUp") !== x.bothUp) bad.push(`bothUp ${n("bothUp")} ≠ ${x.bothUp}`);
  if (x.fireMin !== undefined && n("fire") < x.fireMin) bad.push(`fire ${n("fire")} < ${x.fireMin}`);
  if (x.theta !== undefined) {
    const tol = x.thetaTol ?? 8;
    if (r.thetaMedian === null || Math.abs(r.thetaMedian - x.theta) > tol) bad.push(`θ median ${r.thetaMedian?.toFixed(1)} not within ${x.theta}±${tol}`);
  }
  if (x.hover && (r.hoverMs[x.hover.target] ?? 0) < x.hover.minMs) bad.push(`hover ${x.hover.target} ${r.hoverMs[x.hover.target] ?? 0} ms < ${x.hover.minMs}`);
  if (x.dwell && !r.dwells.includes(x.dwell)) bad.push(`no dwell on ${x.dwell} (got ${r.dwells.join(",") || "none"})`);
  return bad;
}
