"use client";
// src/game/Calibrate.tsx: seated calibration (docs/plan/04 §5, 07 §2 screen 4).
// Body check 2.0 s (visibility > 0.6) → distance hints from sw / videoWidth → aim test (θ 30–60° for 0.5 s)
// → save the baseline (sw, shMid, nose y). The Start click unlocks audio (warmVoices). Never blocks on the camera.
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { getClassCode } from "@/lib/client/api";
import { warmVoices } from "@/lib/speak";
import { loadSettings, useSettings } from "./settings";
import { preloadSfx } from "./sfx";
import { CameraView } from "@/motion/CameraView";
import { engine, L_EL, L_SH, L_WR, NOSE, R_EL, R_SH, R_WR } from "@/motion/gestures";
import type { AimMode, MotionFrame } from "@/motion/types";
import { subscribe, useGame } from "./store";

export type CalibrationResult = { nickname: string; leftHanded: boolean; aimMode: AimMode; calibrated: boolean };

const VIS = 0.6;
const BODY_MS = 2000;
const AIM_MS = 500;
const SW_MIN = 0.12;
const SW_MAX = 0.45;

type Checks = {
  head: boolean; shoulders: boolean; left: boolean; right: boolean;
  bodyPct: number; bodyOk: boolean; aimPct: number; aimOk: boolean; hint: string;
};
const initial: Checks = {
  head: false, shoulders: false, left: false, right: false,
  bodyPct: 0, bodyOk: false, aimPct: 0, aimOk: false, hint: "Sit back until your head and both hands are in the box",
};

export function Calibrate({ onStart, accent = "cyan" }: { onStart: (r: CalibrationResult) => void; accent?: "cyan" | "magenta" }) {
  const cam = useGame((s) => s.cam);
  const [checks, setChecks] = useState<Checks>(initial);
  const [leftHanded, setLeftHanded] = useState(false);
  const sound = useSettings((s) => s.sound);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const setSettings = useSettings((s) => s.set);
  useEffect(() => loadSettings(), []);
  const [aimMode, setAimMode] = useState<AimMode>("forearm");
  const [nickname, setNickname] = useState("");
  const [qr, setQr] = useState<{ url: string; code: string } | null>(null);
  const started = useRef(false);

  // Small QR so the teacher's phone can still join from here (07 §2).
  useEffect(() => {
    const code = getClassCode();
    if (!code) return;
    const url = `${window.location.origin}/live/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#0b1020", light: "#e5e7eb" } })
      .then((dataUrl) => setQr({ url: dataUrl, code }))
      .catch(() => setQr(null));
  }, []);

  useEffect(() => {
    engine.setOptions({ leftHanded, aimMode });
  }, [leftHanded, aimMode]);

  // Live checklist, driven by pose frames.
  useEffect(() => {
    let bodySince: number | null = null;
    let aimSince: number | null = null;
    let bodyOk = false;
    let aimOk = false;
    let lastUi = 0;
    return engine.onFrame((f: MotionFrame) => {
      const p = f.pts;
      const v = (i: number) => !!p && p[i].visibility > VIS;
      const head = v(NOSE);
      const shoulders = v(L_SH) && v(R_SH);
      const left = v(L_EL) && v(L_WR);
      const right = v(R_EL) && v(R_WR);
      const swFrac = f.sw / (f.videoW || 640);
      let hint = "Sit back until your head and both hands are in the box";
      const distOk = shoulders && swFrac >= SW_MIN && swFrac <= SW_MAX;
      if (shoulders && swFrac < SW_MIN) hint = "Move a bit closer";
      else if (shoulders && swFrac > SW_MAX) hint = "Move back a bit";

      if (!bodyOk) {
        if (head && shoulders && left && right && distOk) {
          bodySince ??= f.t;
          if (f.t - bodySince >= BODY_MS && p && f.shMid) {
            bodyOk = true;
            engine.setBaseline({ sw: f.sw, shMidX: f.shMid.x, shMidY: f.shMid.y, noseY: p[NOSE].y });
          }
        } else bodySince = null;
      }

      if (bodyOk && !aimOk) {
        const lh = engine.opts.leftHanded;
        const aimVisible = lh ? left : right;
        const theta = engine.opts.aimMode === "forearm" ? f.thetaForearm : f.thetaFullArm;
        hint = aimVisible ? "Point your forearm up at about 45°" : "Move back a little so your hand stays in the picture";
        if (aimVisible && theta >= 30 && theta <= 60) {
          aimSince ??= f.t;
          if (f.t - aimSince >= AIM_MS) aimOk = true;
        } else aimSince = null;
      }
      if (bodyOk && aimOk) hint = "All set! Press Start";

      if (f.t - lastUi > 80 || (bodyOk && aimOk)) {
        lastUi = f.t;
        setChecks({
          head, shoulders, left, right, hint,
          bodyOk, bodyPct: bodyOk ? 1 : bodySince === null ? 0 : Math.min(1, (f.t - bodySince) / BODY_MS),
          aimOk, aimPct: aimOk ? 1 : aimSince === null ? 0 : Math.min(1, (f.t - aimSince) / AIM_MS),
        });
      }
    });
  }, []);

  const camDown = cam === "no-camera" || cam === "error";
  const ready = (checks.bodyOk && checks.aimOk) || camDown;

  const start = (calibrated: boolean) => {
    if (started.current) return;
    started.current = true;
    warmVoices(); // the click/keypress is the user activation that unlocks speech
    preloadSfx();
    engine.setOptions({ leftHanded, aimMode });
    onStart({ nickname: nickname.trim() || "Player", leftHanded, aimMode, calibrated });
  };
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });

  const readyRef = useRef(ready);
  const camDownRef = useRef(camDown);
  useEffect(() => {
    readyRef.current = ready;
    camDownRef.current = camDown;
  });
  // Enter (keyboard bothUp) starts once ready. A gesture bothUp can't: speech needs a real user activation.
  useEffect(
    () =>
      subscribe("bothUp", (e) => {
        if (e.source === "keyboard" && readyRef.current) startRef.current(!camDownRef.current);
      }),
    [],
  );

  const accentText = accent === "cyan" ? "text-cyan" : "text-magenta";
  const accentBorder = accent === "cyan" ? "border-cyan" : "border-magenta";

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 py-16 lg:grid-cols-[1fr_360px]">
      <div className="relative">
        <CameraView className={`aspect-[4/3] w-full rounded-3xl border-2 ${ready ? "border-lime" : accentBorder}`} />
        <Silhouette ok={checks.bodyOk} />
        <p className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-navy/85 px-5 py-2 text-xl font-semibold" aria-live="polite">
          {camDown ? "No camera found. You can still play with the keyboard." : checks.hint}
        </p>
      </div>

      <aside className="flex flex-col gap-5">
        <h1 className="text-3xl font-bold">
          Get <span className={accentText}>ready</span>
        </h1>
        <ul className="flex flex-col gap-2 text-lg">
          <Check ok={checks.head} label="Head" />
          <Check ok={checks.shoulders} label="Shoulders" />
          <Check ok={checks.left} label="Left hand" />
          <Check ok={checks.right} label="Right hand" />
          <Check ok={checks.bodyOk} label="Hold still 2 s" pct={checks.bodyPct} />
          <Check ok={checks.aimOk} label="Aim test (forearm ≈ 45°)" pct={checks.aimPct} />
        </ul>

        <div className="flex flex-wrap gap-2 text-sm">
          <Toggle on={leftHanded} onClick={() => setLeftHanded((x) => !x)} label="Left-handed" />
          <Toggle on={aimMode === "fullArm"} onClick={() => setAimMode((m) => (m === "forearm" ? "fullArm" : "forearm"))} label="Aim with full arm" />
          <Toggle on={sound} onClick={() => setSettings({ sound: !sound })} label="Sound" />
          <Toggle on={reducedMotion} onClick={() => setSettings({ reducedMotion: !reducedMotion })} label="Reduced motion" />
          <span className="rounded-full border border-line px-3 py-1 text-muted" title="Standing mode is not available">Seated</span>
        </div>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Nickname (no real names needed)
          <input
            value={nickname}
            maxLength={16}
            onChange={(e) => setNickname(e.target.value.slice(0, 16))}
            placeholder="Player"
            className="rounded-xl border border-line bg-panel px-4 py-3 text-lg text-text outline-none focus:border-cyan"
          />
        </label>

        <button
          onClick={() => start(!camDown)}
          disabled={!ready}
          className="rounded-2xl bg-lime px-6 py-4 text-xl font-bold text-navy transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {camDown ? "Start with keyboard" : "Start"}
        </button>
        {!ready && (
          <button onClick={() => start(false)} className="text-sm text-muted underline underline-offset-4 hover:text-text">
            Skip calibration (keyboard / mouse)
          </button>
        )}

        {qr && (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR */}
            <img src={qr.url} alt={`QR code for class ${qr.code}`} width={120} height={120} className="rounded-lg" />
            <div className="text-sm text-muted">
              Teacher view
              <div className="font-display text-2xl font-bold tracking-widest text-text">{qr.code}</div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Check({ ok, label, pct }: { ok: boolean; label: string; pct?: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${ok ? "bg-lime text-navy" : "border border-line text-muted"}`}>
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "text-text" : "text-muted"}>{label}</span>
      {pct !== undefined && !ok && pct > 0 && (
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <span className="block h-full bg-cyan" style={{ width: `${pct * 100}%` }} />
        </span>
      )}
    </li>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1 ${on ? "border-cyan bg-cyan/15 text-cyan" : "border-line text-muted hover:text-text"}`}
    >
      {on ? "✓ " : ""}
      {label}
    </button>
  );
}

/** Head-and-shoulders guide drawn over the mirrored camera. */
function Silhouette({ ok }: { ok: boolean }) {
  return (
    <svg viewBox="0 0 640 480" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <g fill="none" stroke={ok ? "#a3e635" : "#e5e7eb"} strokeOpacity={0.55} strokeWidth={4} strokeDasharray="12 10">
        <ellipse cx={320} cy={165} rx={62} ry={78} />
        <path d="M150 470 C 160 330, 230 280, 320 278 C 410 280, 480 330, 490 470" />
      </g>
    </svg>
  );
}
