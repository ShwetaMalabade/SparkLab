// tests/gestures.test.ts: gesture engine on synthetic landmark frames (PASS/FAIL harness, run with `npx tsx`).
// P1-19 adds recorded-landmark clips from tests/fixtures/*.json on top of these.
import { engine } from "../src/motion/gestures";
import { hitTest, registerTarget } from "../src/motion/targets";
import { subscribe, useGame } from "../src/game/store";
import { keyToEvent } from "../src/motion/keyboard";
import type { RawLandmark } from "../src/motion/pose";
import type { MotionEvent } from "../src/motion/types";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { classifyHand } from "../src/motion/hands";
import { addAtom, MOLECULE_QUESTIONS, moleculeLayout } from "../src/game/molecules";
import { reportFps, useQuality, particles } from "../src/three/quality";
import { checkClip, packFrame, replayClip, type Clip } from "../src/motion/clips";
import { judge, speciesOf, trapped, atomCounts, trapFormula } from "../src/game/balancer";
import { range, fieldLength, speedForRange, choiceNumber, arc, maxHeight } from "../src/game/physics";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

const VW = 640, VH = 480, SW = 1280, SH = 720;
type P = { x: number; y: number };
/** A seated person. Coordinates given in VIDEO PIXELS (converted to MediaPipe's 0..1 here). */
function body(o: { lw?: P; rw?: P; le?: P; re?: P; shift?: number; vis?: number; noseVis?: number } = {}): RawLandmark[] {
  const s = o.shift ?? 0; // horizontal shift of the whole torso, px
  const v = o.vis ?? 0.99;
  const pts: RawLandmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.9, z: 0, visibility: 0.2 }));
  const set = (i: number, p: P, vis = v) => (pts[i] = { x: p.x / VW, y: p.y / VH, z: 0, visibility: vis });
  // sw = 160 px. Person's LEFT shoulder (11) is at larger x in the un-mirrored image.
  set(0, { x: 320 + s, y: 150 }, o.noseVis ?? v);
  set(11, { x: 400 + s, y: 260 });
  set(12, { x: 240 + s, y: 260 });
  set(13, o.le ?? { x: 430 + s, y: 360 });
  set(14, o.re ?? { x: 210 + s, y: 360 });
  set(15, o.lw ?? { x: 440 + s, y: 420 });
  set(16, o.rw ?? { x: 200 + s, y: 420 });
  return pts;
}

let t = 1000;
const events: MotionEvent[] = [];
subscribe("*", (e) => events.push(e));
const run = (frames: RawLandmark[][] | RawLandmark[], dt = 33) => {
  const list = (Array.isArray(frames[0]) ? frames : [frames]) as RawLandmark[][];
  for (const f of list) { t += dt; engine.process(f, t, VW, VH, SW, SH); }
};
const hold = (f: RawLandmark[], ms: number) => { for (let i = 0; i < ms / 33; i++) run(f); };
const count = (type: string) => events.filter((e) => e.type === type).length;
const reset = () => { events.length = 0; };

// ---- pixel space: a real 45° forearm reads 45°, not 53° (04 §4) ----
engine.setOptions({ leftHanded: false, aimMode: "forearm" });
hold(body({ re: { x: 210, y: 360 }, rw: { x: 140, y: 290 } }), 1500); // dx = 70, dy = 70 in pixels
ok("forearm 45° in pixel space", Math.abs(engine.latest.thetaForearm - 45) < 0.5, `got ${engine.latest.thetaForearm}`);
ok("θ EMA converges to 45°", Math.abs(engine.latest.theta - 45) < 1, `got ${engine.latest.theta}`);
ok("sw = 160 px", Math.abs(engine.latest.sw - 160) < 1, `got ${engine.latest.sw}`);

// ---- reach box cursors are mirrored: the person's right wrist (image left) appears on screen right ----
hold(body(), 500);
const c = engine.latest.cursors;
ok("both cursors visible", c.left.visible && c.right.visible);
ok("right hand cursor on screen right", c.right.x > SW / 2 && c.left.x < SW / 2, `L=${c.left.x} R=${c.right.x}`);

// ---- clap: open > 1.2 sw then close < 0.35 sw within 600 ms (armed) ----
useGame.getState().arm("clap");
reset();
const open = body({ lw: { x: 520, y: 330 }, rw: { x: 120, y: 330 } }); // 400 px = 2.5 sw
const closed = body({ lw: { x: 335, y: 330 }, rw: { x: 305, y: 330 } }); // 30 px = 0.19 sw
hold(open, 300);
const mid = body({ lw: { x: 430, y: 330 }, rw: { x: 210, y: 330 } });
run([mid, closed, closed, closed]);
hold(closed, 300);
ok("one clap fires", count("clap") === 1, `got ${count("clap")}`);

// ---- talking with hands: hands drift close slowly → no clap ----
reset();
hold(body({ lw: { x: 380, y: 360 }, rw: { x: 260, y: 360 } }), 800); // 0.75 sw apart
hold(body({ lw: { x: 340, y: 360 }, rw: { x: 300, y: 360 } }), 800); // 0.25 sw, but no wide swing before
ok("slow hands together → 0 claps", count("clap") === 0, `got ${count("clap")}`);

// ---- clap disarmed → nothing even with a real clap ----
useGame.getState().arm("clap", false);
reset();
hold(open, 300); run([mid, closed]); hold(closed, 300);
ok("disarmed clap is dropped", count("clap") === 0);

// ---- both hands up: above nose.y − 0.2·sw for 3 frames; once per raise ----
reset();
// Hands above the head: wrists ≈ 0.8 sw above the nose (what the recorded bothUp clip shows). Line = 150 − 0.4·160 = 86 px.
const up = body({ lw: { x: 440, y: 20 }, rw: { x: 200, y: 20 }, le: { x: 430, y: 130 }, re: { x: 210, y: 130 } });
// A 2-frame flick above the line (e.g. scratching your head) must not fire.
const flickBase = body({ lw: { x: 440, y: 140 }, rw: { x: 200, y: 140 }, le: { x: 430, y: 200 }, re: { x: 210, y: 200 } });
hold(flickBase, 500); // below the line (86 px)
run([up, up]);
hold(flickBase, 500);
ok("bothUp needs 3 frames above the line", count("bothUp") === 0, `got ${count("bothUp")}`);
hold(body(), 300);
hold(up, 300); // smoothing carries the wrists past the line in a few frames
ok("bothUp fires within 300 ms of raising", count("bothUp") === 1, `got ${count("bothUp")}`);
hold(up, 1500);
ok("holding up does not repeat", count("bothUp") === 1, `got ${count("bothUp")}`);
hold(body(), 300);
hold(up, 300);
ok("lower + raise again fires again", count("bothUp") === 2, `got ${count("bothUp")}`);
// Hands at chin/forehead height (60° aim with both arms, head dip while clapping) are not "hands up".
reset();
hold(body({ lw: { x: 440, y: 100 }, rw: { x: 200, y: 100 }, le: { x: 430, y: 190 }, re: { x: 210, y: 190 } }), 1500);
ok("hands at forehead height → no bothUp", count("bothUp") === 0, `got ${count("bothUp")}`);

// ---- lean: shMid shift > 0.4 sw from baseline, mirrored direction ----
engine.setBaseline({ sw: 160, shMidX: 320, shMidY: 260, noseY: 150 });
hold(body(), 300);
reset();
hold(body({ shift: 80 }), 400); // +x in the un-mirrored image = the person's left = screen LEFT
const leans = events.filter((e) => e.type === "lean");
ok("lean fires once", leans.length === 1, `got ${leans.length}`);
ok("lean +x → screen left", leans[0]?.type === "lean" && leans[0].side === "left");
hold(body({ shift: 80 }), 1500);
ok("holding a lean does not repeat", count("lean") === 1);
hold(body(), 700);
hold(body({ shift: -80 }), 400);
const l2 = events.filter((e) => e.type === "lean");
ok("lean back the other way → screen right", l2.length === 2 && l2[1].type === "lean" && l2[1].side === "right");

// ---- dwell 800 ms on a target + hover trace ----
engine.setBaseline({ sw: 160, shMidX: 320, shMidY: 260, noseY: 150 });
hold(body(), 300);
const rc = engine.latest.cursors.right;
const off = registerTarget("choice:B", () => ({ x: rc.x - 100, y: rc.y - 100, w: 200, h: 200 }));
reset();
hold(body(), 600);
ok("no dwell before 800 ms", count("dwell") === 0);
hold(body(), 400);
const dw = events.filter((e) => e.type === "dwell");
ok("dwell fires after 800 ms", dw.length === 1 && dw[0].type === "dwell" && dw[0].targetId === "choice:B" && dw[0].side === "right");
const hv = events.filter((e) => e.type === "hover" && e.targetId === "choice:B");
ok("hover recorded on select (≥ 150 ms)", hv.length >= 1 && (hv[0].type === "hover" && (hv[0].ms ?? 0) >= 700), JSON.stringify(hv));
off();

// ---- tracking lost after 500 ms, found on return ----
reset();
hold(body({ noseVis: 0.1 }), 400);
ok("no lost before 500 ms", count("lost") === 0);
hold(body({ noseVis: 0.1 }), 300);
ok("lost after 500 ms", count("lost") === 1);
run(body());
ok("found on return", count("found") === 1);
reset();
for (let i = 0; i < 25; i++) { t += 33; engine.process(null, t, VW, VH, SW, SH); }
ok("no person (null) → lost", count("lost") === 1);
hold(body(), 100);

// ---- hold steady → fire (armed), needs θ ≥ 10° when angle is free ----
useGame.getState().arm("fire");
engine.setOptions({ lockAngle: false, lockSpeed: true });
reset();
hold(body({ re: { x: 210, y: 360 }, rw: { x: 140, y: 290 } }), 1000);
ok("no fire before 1.2 s steady", count("fire") === 0);
hold(body({ re: { x: 210, y: 360 }, rw: { x: 140, y: 290 } }), 500);
ok("fire after 1.2 s steady", count("fire") === 1, `got ${count("fire")}`);
reset();
hold(body({ re: { x: 210, y: 360 }, rw: { x: 120, y: 362 } }), 4000); // arm resting flat ≈ 5°
ok("resting arm (θ < 10°) never fires", count("fire") === 0, `θ=${engine.latest.theta}`);
useGame.getState().arm("fire", false);

// ---- keyboard twins ----
ok("Enter → bothUp [keyboard]", keyToEvent({ key: "Enter", repeat: false }, 0)?.type === "bothUp");
ok("C → clap", keyToEvent({ key: "C", repeat: false }, 0)?.type === "clap");
const k3 = keyToEvent({ key: "3", repeat: false }, 0);
ok("3 → pick index 2", k3?.type === "command" && k3.cmd === "pick" && k3.value === 2);
ok("held Enter does not repeat", keyToEvent({ key: "Enter", repeat: true }, 0) === null);
ok("held ↑ repeats angle", keyToEvent({ key: "ArrowUp", repeat: true }, 0)?.type === "command");
ok("all keyboard events tagged keyboard", ["Enter", "c", "ArrowLeft", " ", "n", "p"].every((k) => keyToEvent({ key: k, repeat: false }, 0)?.source === "keyboard"));

// ---- Launcher physics (P1-12 Done-when, docs/plan/05 §2) ----
ok("v=20, θ=30° lands at 35.3 m", range(20, 30).toFixed(1) === "35.3", `${range(20, 30)}`);
ok("45° goes farthest", [5, 15, 30, 44, 46, 60, 75, 85].every((d) => range(20, d) < range(20, 45)));
ok("30° and 60° land together", Math.abs(range(20, 30) - range(20, 60)) < 1e-9);
ok("arc lands at R", Math.abs(arc(20, 30).at(-1)!.x - range(20, 30)) < 1e-9 && Math.abs(arc(20, 30).at(-1)!.y) < 1e-9);
ok("arc peak = H", Math.abs(Math.max(...arc(20, 30, 200).map((p) => p.y)) - maxHeight(20, 30)) < 0.01);
ok("ghost speed lands at the wrong value", Math.abs(range(speedForRange(20.4, 30), 30) - 20.4) < 1e-9);
ok("field: v=20 → 50 m, free speed → 100 m", fieldLength(20) === 50 && fieldLength(null) === 100);
ok("choice numbers parse", choiceNumber("20.4 m") === 20.4 && choiceNumber("White solid forms") === null);

// ---- Equation Balancer (P1-16 Done-when, docs/plan/05 §4) ----
{
  const ws = JSON.parse(readFileSync("data/fixtures/worksheet.json", "utf8"));
  const q4 = ws.questions.find((q: { id: string }) => q.id === "q4");
  const sp = speciesOf(q4)!;
  const c = (l: number[], r: number[]) => ({ left: l, right: r });
  const j = (l: number[], r: number[], trap = false) => judge(q4, ws, trap ? trapped(sp) : sp, c(l, r), { trap });
  const v1 = j([2, 1], [2]);
  ok("q4: 2,1,2 → correct (D)", v1.kind === "lock" && v1.correct && v1.chosen === "D", JSON.stringify(v1));
  const v2 = j([1, 1], [2]);
  ok("q4: 1,1,2 → unbalanced_hydrogen", v2.kind === "lock" && !v2.correct && v2.misconceptionId === "unbalanced_hydrogen", JSON.stringify(v2));
  const v3 = j([1, 1], [1], true);
  ok("q4: subscript trap → changed_subscripts", v3.kind === "lock" && v3.misconceptionId === "changed_subscripts", JSON.stringify(v3));
  ok("q4: 4,2,4 → 'now simplify' (no lock)", j([4, 2], [4]).kind === "simplify");
  const v5 = judge(q4, ws, sp, c([4, 2], [4]), { trap: false, secondSimplify: true });
  ok("q4: 4,2,4 twice → locks as wrong X", v5.kind === "lock" && v5.chosen === "X" && !v5.correct);
  const v6 = j([3, 1], [2]);
  ok("q4: 3,1,2 (no matching choice) → X + first mismatched element", v6.kind === "lock" && v6.chosen === "X" && v6.chosenText === "3, 1, 2" && v6.misconceptionId === "unbalanced_hydrogen", JSON.stringify(v6));
  ok("trap: H2O → H2O2, KNO3 → KNO4", trapFormula("H2O") === "H2O2" && trapFormula("KNO3") === "KNO4");
  const a = atomCounts(sp, c([1, 1], [2]));
  ok("atom counters: 1,1,2 → H 2|4, O 2|2", JSON.stringify(a.rows) === JSON.stringify([{ el: "H", left: 2, right: 4 }, { el: "O", left: 2, right: 2 }]));
  ok("X key → subscript trap", keyToEvent({ key: "x", repeat: false }, 0)?.type === "command");
}

// ---- Recorded-landmark clips (P1-19, docs/plan/04 §10) ----
{
  // 1) The replay pipeline itself, on a synthetic clip (pack → unpack → engine → expectations).
  const frames: { t: number; lm: number[][] | null }[] = [];
  let ct = 0;
  const push = (f: RawLandmark[], ms: number) => { for (let i = 0; i < ms / 33; i++) frames.push(packFrame(f, (ct += 33))); };
  const wide = body({ lw: { x: 520, y: 330 }, rw: { x: 120, y: 330 } });
  const half = body({ lw: { x: 430, y: 330 }, rw: { x: 210, y: 330 } });
  const shut = body({ lw: { x: 335, y: 330 }, rw: { x: 305, y: 330 } });
  for (let k = 0; k < 2; k++) { push(wide, 1000); push(half, 33); push(shut, 400); }
  const synth: Clip = {
    name: "synthetic-clap-x2", recordedAt: "synthetic", video: { w: VW, h: VH }, screen: { w: SW, h: SH }, aimMode: "forearm",
    leftHanded: false, arm: ["clap"], baseline: null, targets: {}, expect: { clap: 2, bothUp: 0 }, frames,
  };
  const r = replayClip(synth, 5e7);
  ok("clip replay: synthetic 2 claps → 2 clap events", checkClip(synth, r).length === 0, JSON.stringify(r.counts));
  const r2 = replayClip({ ...synth, arm: [] }, 6e7);
  ok("clip replay: clap disarmed → 0 claps", (r2.counts.clap ?? 0) === 0);

  // A replay must not remove the page's own targets (bug: live picking on /play/dev died after the first recording).
  const offLive = registerTarget("dev:A", () => ({ x: 0, y: 0, w: 100, h: 100 }));
  replayClip({ ...synth, targets: { "dev:A": { x: 500, y: 500, w: 10, h: 10 } } }, 7e7);
  ok("replay keeps the page's live targets", hitTest(50, 50) === "dev:A" && hitTest(505, 505) === null);
  offLive();

  // 2) Every recorded clip in tests/fixtures/ (record them on /play/dev → "Record a test clip").
  const dir = "tests/fixtures";
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  if (!files.length) console.log("NOTE no recorded clips in tests/fixtures yet (record them on /play/dev)");
  files.forEach((f, i) => {
    const clip = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as Clip;
    const bad = checkClip(clip, replayClip(clip, 1e8 + i * 1e6));
    ok(`recorded clip ${f}`, bad.length === 0, bad.join(" · "));
  });
}

// ---- Auto quality (P1-20, 05 §8): < 30 fps for 3 s → one step down, in order; never back up ----
{
  const feed = (fps: number, n: number) => { for (let i = 0; i < n; i++) reportFps(fps); };
  feed(10, 3); // warm-up seconds are ignored
  ok("quality: warm-up ignored", useQuality.getState().level === 0);
  feed(60, 5); feed(25, 2); feed(60, 1); feed(25, 2);
  ok("quality: short dips don't step down", useQuality.getState().level === 0);
  feed(25, 3);
  ok("quality: 3 s under 30 → level 1 (half particles)", useQuality.getState().level === 1 && particles(160, 1) === 80);
  feed(20, 9);
  ok("quality: keeps stepping to 3 at most", useQuality.getState().level === 3);
  feed(60, 10);
  ok("quality: never steps back up", useQuality.getState().level === 3);
}

// ---- Finger tracker shapes (open / point / fist + tilt) on synthetic 21-point hands ----
{
  // Palm up the screen: wrist at (0,0), knuckles at y = −1. Each finger: knuckle, pip, dip, tip.
  const hand = (ext: [boolean, boolean, boolean, boolean], rot = 0) => {
    const pts: { x: number; y: number; z: number }[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    const put = (i: number, x: number, y: number) => {
      const c = Math.cos(rot), sn = Math.sin(rot);
      pts[i] = { x: x * c - y * sn, y: x * sn + y * c, z: 0 };
    };
    put(0, 0, 0);
    put(1, -0.35, -0.2); put(2, -0.55, -0.45); put(3, -0.65, -0.65); put(4, -0.7, -0.8); // thumb
    [-0.3, -0.1, 0.1, 0.3].forEach((x, f) => {
      const k = 5 + f * 4;
      put(k, x, -1);
      if (ext[f]) { put(k + 1, x, -1.4); put(k + 2, x, -1.7); put(k + 3, x, -1.95); }
      else { put(k + 1, x, -1.25); put(k + 2, x, -1.0); put(k + 3, x, -0.75); } // curled back toward the palm
    });
    return pts;
  };
  ok("hand: open palm → open", classifyHand(hand([true, true, true, true])).shape === "open");
  ok("hand: closed fist → fist", classifyHand(hand([false, false, false, false])).shape === "fist", classifyHand(hand([false, false, false, false])).shape);
  ok("hand: index only → point", classifyHand(hand([true, false, false, false])).shape === "point");
  ok("hand: two fingers → not a select shape", classifyHand(hand([true, true, false, false])).shape === "other");
  const flat = classifyHand(hand([false, false, false, false])).tilt;
  const tipped = classifyHand(hand([false, false, false, false], 0.8)).tilt;
  ok("hand: tilting the fist changes tilt by ~46°", Math.abs(Math.abs(tipped - flat) - 45.8) < 2, `${flat} → ${tipped}`);
}

// ---- Molecule Builder rules (code counts every atom) ----
{
  const water = MOLECULE_QUESTIONS.find((q) => q.formula === "H2O")!;
  const a1 = addAtom(water, {}, "H");
  ok("water: 1 H accepted, asks for more", a1.ok && !a1.done && /needs 1 more hydrogen and 1 more oxygen/.test(a1.message), a1.message);
  const c = addAtom(water, { H: 1 }, "C");
  ok("water: carbon rejected as not in water", !c.ok && c.reason === "wrong_element" && /Carbon isn't in water/.test(c.message), c.message);
  const o = addAtom(water, { H: 1 }, "O");
  ok("water: 1 H + 1 O → 'needs 1 more hydrogen'", o.ok && /needs 1 more hydrogen/.test(o.message), o.ok ? o.message : "");
  const done = addAtom(water, { H: 1, O: 1 }, "H");
  ok("water: 2 H + 1 O → done", done.ok && done.done && /H2O/.test(done.message));
  const extra = addAtom(water, { H: 2, O: 0 }, "H");
  ok("water: a 3rd H rejected (only 2)", !extra.ok && extra.reason === "too_many", extra.message);
  ok("layout: H2O = O + 2 H, CH4 = C + 4 H", moleculeLayout("H2O").map((a) => a.el).join("") === "OHH" && moleculeLayout("CH4").map((a) => a.el).join("") === "CHHHH");
  ok("every demo question's palette contains its elements", MOLECULE_QUESTIONS.every((q) => moleculeLayout(q.formula).every((a) => q.palette.includes(a.el))));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
