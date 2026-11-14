"use client";
// src/game/GameHud.tsx: Play HUD (docs/plan/07 §2 screen 5, §3 hint copy).
// Top: question (+ 🧠 badge on variants). Left: score / streak. Right: mirrored mini-webcam with skeleton.
// Bottom: gesture hints, with the captions bar above them (captions for all speech, ≥ 24 px).
import { CameraView } from "@/motion/CameraView";
import { DebugOverlay } from "@/motion/DebugOverlay";
import { useGame } from "./store";

const INTRO_MS = 3000;
const NEXT_AUTO_MS = 6000;

export function GameHud({ accent, hint, phaseMs, total }: { accent: string; hint: string; phaseMs: number; total: number }) {
  const question = useGame((s) => s.question);
  const phase = useGame((s) => s.phase);
  const score = useGame((s) => s.score);
  const streak = useGame((s) => s.streak);
  const paused = useGame((s) => s.paused);
  const pauseReason = useGame((s) => s.pauseReason);
  const caption = useGame((s) => s.caption);
  const coachLine = useGame((s) => s.coachLine);
  const lastResult = useGame((s) => s.lastResult);
  const playedCount = useGame((s) => s.played.length);
  const lastNext = useGame((s) => s.lastNext);

  const intro = phase === "intro";
  const revealing = (phase === "reveal" || phase === "next") && !!lastResult;

  return (
    <>
      {/* Top: question */}
      {question && phase !== "end" && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-[240px]">
          <div
            className={`max-w-4xl rounded-2xl border bg-navy/85 px-6 py-4 text-center shadow-2xl backdrop-blur transition-all duration-500 ${
              intro ? "mt-[10vh] scale-110" : ""
            }`}
            style={{ borderColor: `${accent}66` }}
          >
            <div className="mb-1 flex items-center justify-center gap-2 text-sm text-muted">
              <span>Question {playedCount}{question.origin === "worksheet" ? ` of ${total}` : ""}</span>
              <span>·</span>
              <span>{question.concept}</span>
            </div>
            {question.origin === "variant" && (
              <div className="mx-auto mb-2 w-fit rounded-full border border-violet/60 bg-violet/15 px-3 py-1 text-sm font-semibold text-violet">
                🧠 New question from your coach
              </div>
            )}
            <p className={`font-display font-semibold leading-snug ${intro ? "text-3xl" : "text-2xl"}`}>{question.prompt}</p>
            {intro && <Bar pct={phaseMs / INTRO_MS} color={accent} />}
          </div>
        </div>
      )}

      {/* Left: score */}
      <div className="pointer-events-none absolute left-4 top-14 z-30 flex flex-col gap-2 rounded-2xl border border-line bg-navy/80 px-5 py-4 backdrop-blur">
        <span className="text-sm uppercase tracking-wider text-muted">Score</span>
        <span className="font-display text-4xl font-bold tabular-nums">{score}</span>
        <span className="text-lg">
          {streak > 0 ? `🔥 ${streak} in a row` : <span className="text-muted">No streak yet</span>}
          {streak >= 3 && <span className="ml-2 rounded bg-amber/20 px-1.5 text-sm font-bold text-amber">×1.5</span>}
        </span>
        {revealing && lastResult!.points > 0 && (
          <span key={`${question?.id}-pts`} className="animate-bounce text-2xl font-bold text-lime">+{lastResult!.points}</span>
        )}
      </div>

      {/* Right: mini webcam */}
      <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col items-end gap-1">
        <CameraView className="h-[150px] w-[200px] rounded-xl border border-line" />
        {lastNext && (
          <span className="rounded-full bg-navy/80 px-2 py-0.5 text-xs text-muted" title={lastNext.reason}>
            next pick: {lastNext.source === "coach" ? "🧠 coach" : "code fallback"}
          </span>
        )}
      </div>

      {/* Bottom: captions above hints */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-6 pb-4">
        {(caption || coachLine) && phase !== "intro" && (
          <div className="max-w-4xl rounded-2xl bg-navy/90 px-6 py-3 text-center text-2xl leading-snug" aria-live="polite">
            {revealing ? (
              <span className={lastResult!.correct ? "text-lime" : "text-coral"}>{caption}</span>
            ) : (
              <span>{caption}</span>
            )}
            {coachLine && <div className="mt-1 text-violet">Coach: {coachLine}</div>}
          </div>
        )}
        {phase === "next" && (
          <div className="w-80">
            <Bar pct={phaseMs / NEXT_AUTO_MS} color={accent} />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xl text-muted">
          <span>{hint}</span>
          <span className="text-base">N skip · P pause · D debug</span>
        </div>
      </div>

      {/* Pause: dim the scene */}
      {paused && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-navy/75 backdrop-blur-sm">
          <div className="text-center">
            <p className="font-display text-5xl font-bold">{pauseReason === "lost" ? "Step back into view" : "Paused"}</p>
            <p className="mt-3 text-xl text-muted">{pauseReason === "lost" ? "The game continues when we can see you." : "Press P to resume"}</p>
          </div>
        </div>
      )}

      {phase === "end" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-navy/70 backdrop-blur-sm">
          <div className="text-center">
            <p className="font-display text-5xl font-bold">{caption}</p>
            <p className="mt-3 text-xl text-muted">Opening your results…</p>
          </div>
        </div>
      )}

      <DebugOverlay />
    </>
  );
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
    </div>
  );
}
