"use client";
// src/game/GameRunner.tsx: the game loop (docs/plan/05 §1).
//   START   nextStep({sessionId}) → the coach's first pick (fallback: first worksheet question)
//   INTRO   3 s: question read aloud + caption (+ 🧠 badge on variants)
//   PLAY    template; gestures + hover trace recorded
//   LOCK-IN postAttempt(a) and nextStep({sessionId, attempt: a}) fire together, while…
//   REVEAL  4–6 s: speak the chosen option's `why`, then "Coach: <feedback>" if it has arrived
//   NEXT    the coach's choice (or the code fallback): both hands up / Enter, or auto after 6 s
//   END     coach says finish, no questions left, or time budget used → endSession → /results/[id]
// Timers run on a game clock that stops while paused (tracking lost or P). N skips at any time.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { endSession, nextStep, postAttempt, type NextStep } from "@/lib/client/api";
import type { TWorksheet } from "@/lib/schema";
import { Arena } from "@/three/Arena";
import { Avatar } from "@/three/Avatar";
import { HandCursors } from "@/three/HandCursor";
import { WorldLabelsLayer } from "@/three/WorldLabels";
import { GameHud } from "./GameHud";
import { buildAttempt, scoreAnswer } from "./scoring";
import { subscribe, useGame, type GameSession, type LockResult, type Phase } from "./store";
import { pickTemplate } from "./templates";
import { sayNext, sayNow, stopSpeaking } from "./voice";

export const INTRO_MS = 3000;
export const REVEAL_MIN_MS = 4000;
export const REVEAL_MAX_MS = 6000;
export const NEXT_AUTO_MS = 6000;

const PHYSICS = "#22D3EE";
const CHEMISTRY = "#E879F9";

type Props = { worksheet: TWorksheet; session: GameSession; calibrated: boolean };

export function GameRunner({ worksheet, session, calibrated }: Props) {
  const router = useRouter();
  const [phaseMs, setPhaseMs] = useState(0);
  const question = useGame((s) => s.question);
  const phase = useGame((s) => s.phase);
  const paused = useGame((s) => s.paused);

  // Game clock (ms, excludes pauses) and phase bookkeeping live in refs: the ticker reads them every 100 ms.
  const clock = useRef(0);
  const phaseStart = useRef(0);
  const playStart = useRef(0);
  const nextResult = useRef<NextStep | null>(null);
  const waitingForNext = useRef(false);
  const fetching = useRef(false);
  const lockToken = useRef(0);
  const started = useRef(false);

  // All loop logic in one ref so bus handlers and the ticker always see the latest version.
  const loop = useRef({
    setPhase(p: Phase) {
      // The intro caption is the question being read aloud; once playing, the card at the top shows it.
      useGame.getState().setGame(p === "play" ? { phase: p, caption: "" } : { phase: p });
      phaseStart.current = clock.current;
      if (p === "play") playStart.current = clock.current;
    },

    async request(req: Parameters<typeof nextStep>[0]) {
      if (fetching.current) return;
      fetching.current = true;
      useGame.getState().setGame({ caption: "Coach is picking your next question…" });
      const ns = await nextStep(req); // never throws: 6 s abort → code fallback
      fetching.current = false;
      loop.current.present(ns);
    },

    /** Show the step the coach (or the fallback) picked. */
    present(ns: NextStep) {
      const G = useGame.getState();
      if (G.phase === "end") return;
      G.setGame({ lastNext: ns, trace: [...G.trace, ns] });
      if (clock.current / 1000 >= session.timeBudgetSec) return loop.current.finish("time budget used");
      let q = ns.action === "play" ? ns.question : undefined;
      // Local safety net: never replay a worksheet question (e.g. after N skipped it without an attempt).
      if (q && q.origin === "worksheet" && G.played.includes(q.id)) {
        q = worksheet.questions.find((x) => x.origin === "worksheet" && !G.played.includes(x.id));
      }
      if (!q) return loop.current.finish(ns.reason);
      nextResult.current = null;
      waitingForNext.current = false;
      G.resetArming();
      G.setGame({ question: q, played: [...G.played, q.id], caption: q.prompt, coachLine: null, lastResult: null, templateHint: null, skipHandler: null });
      loop.current.setPhase("intro");
      sayNow(q.origin === "variant" ? `New question from your coach. ${q.prompt}` : q.prompt);
    },

    /** LOCK-IN from the template. */
    lock(r: LockResult) {
      const G = useGame.getState();
      const q = G.question;
      if (G.phase !== "play" || G.paused || !q) return;
      const ms = clock.current - playStart.current;
      const attempt = buildAttempt(session, q, r, ms);
      const { points, streak } = scoreAnswer(r.correct, ms, G.streak);
      const choice = q.choices.find((c) => c.id === r.chosen);
      const why = choice?.why ?? (r.correct ? "That's right." : "Not quite.");
      G.setGame({
        score: G.score + points, streak,
        correctCount: G.correctCount + (r.correct ? 1 : 0), answeredCount: G.answeredCount + 1,
        lastResult: { ...r, points }, caption: `${r.correct ? "✓" : "✗"} ${why}`, coachLine: null,
      });
      loop.current.setPhase("reveal");
      sayNow(why);

      // Both calls at once: the phone updates from the attempt, the coach gets it inline.
      void postAttempt(attempt);
      nextResult.current = null;
      const token = ++lockToken.current;
      void nextStep({ sessionId: session.sessionId, attemptId: null, attempt }).then((ns) => {
        if (token !== lockToken.current) return; // skipped meanwhile
        nextResult.current = ns;
        const now = useGame.getState();
        if (ns.feedback && (now.phase === "reveal" || now.phase === "next")) {
          now.setGame({ coachLine: ns.feedback });
          sayNext(ns.feedback);
        }
        if (waitingForNext.current) loop.current.goNext();
      });
    },

    goNext() {
      const G = useGame.getState();
      if (G.phase !== "reveal" && G.phase !== "next") return;
      if (!nextResult.current) {
        waitingForNext.current = true;
        G.setGame({ caption: "Coach is thinking…" });
        return;
      }
      loop.current.present(nextResult.current);
    },

    skip() {
      const G = useGame.getState();
      if (G.paused) return;
      switch (G.phase) {
        case "intro":
          return loop.current.setPhase("play");
        case "play":
          if (G.skipHandler?.()) return; // the template used N for its own sub-phase
          lockToken.current++;
          stopSpeaking();
          return void loop.current.request({ sessionId: session.sessionId });
        case "reveal":
          return loop.current.setPhase("next");
        case "next":
          return loop.current.goNext();
      }
    },

    setPaused(on: boolean, reason: "lost" | "manual" | null) {
      const G = useGame.getState();
      if (G.phase === "end") return;
      G.setGame({ paused: on, pauseReason: on ? reason : null });
      if (on && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.pause();
      if (!on && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.resume();
    },

    finish(reason: string) {
      const G = useGame.getState();
      if (G.phase === "end") return;
      G.setGame({ phase: "end", caption: `Done! ${G.correctCount} of ${G.answeredCount} correct.`, coachLine: null });
      console.info("[game] finish:", reason);
      sayNow(`Great work! You got ${G.correctCount} of ${G.answeredCount}.`);
      void endSession(session.sessionId)
        .catch(() => undefined)
        .finally(() => setTimeout(() => router.push(`/results/${session.sessionId}`), 2500));
    },
  });

  // ---- start ----
  useEffect(() => {
    if (started.current) return; // React strict mode mounts effects twice in dev
    started.current = true;
    useGame.getState().resetGame();
    useGame.getState().setGame({ session });
    void loop.current.request({ sessionId: session.sessionId });
  }, [session]);

  // ---- ticker (game clock) ----
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const G = useGame.getState();
      if (G.paused || G.phase === "end") return;
      clock.current += dt;
      const el = clock.current - phaseStart.current;
      if (G.phase === "intro" && el >= INTRO_MS) loop.current.setPhase("play");
      else if (G.phase === "reveal" && el >= REVEAL_MIN_MS && (nextResult.current || el >= REVEAL_MAX_MS)) loop.current.setPhase("next");
      else if (G.phase === "next" && el >= NEXT_AUTO_MS && !waitingForNext.current) loop.current.goNext();
      setPhaseMs(clock.current - phaseStart.current);
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ---- bus: next, skip, pause, tracking lost/found ----
  useEffect(() => {
    const offs = [
      subscribe("bothUp", () => {
        if (useGame.getState().phase === "next") loop.current.goNext();
      }),
      subscribe("command", (e) => {
        if (e.cmd === "skip") loop.current.skip();
        if (e.cmd === "pause") {
          const G = useGame.getState();
          loop.current.setPaused(!G.paused, "manual");
        }
      }),
      subscribe("lost", () => {
        if (calibrated && !useGame.getState().paused) loop.current.setPaused(true, "lost");
      }),
      subscribe("found", () => {
        if (useGame.getState().pauseReason === "lost") loop.current.setPaused(false, null);
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      stopSpeaking();
    };
  }, [calibrated]);

  const tpl = question ? pickTemplate(question) : null;
  const accent = question?.subject === "chemistry" ? CHEMISTRY : PHYSICS;
  const onLock = (r: LockResult) => loop.current.lock(r);
  const still = phase === "play" || !!tpl?.def.still; // no camera sway while aiming at targets
  const templateHint = useGame((s) => s.templateHint);
  const avatar = tpl?.def.avatar ?? { position: [0, -0.2, -2.2] as [number, number, number], scale: 0.9 };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <Arena accent={accent} still={still}>
        <Avatar color={accent} position={avatar.position} scale={avatar.scale} />
        {question && tpl?.def.Scene && <tpl.def.Scene key={question.id} question={question} worksheet={worksheet} phase={phase} paused={paused} onLock={onLock} />}
      </Arena>
      <WorldLabelsLayer />
      {question && tpl && <tpl.def.Overlay key={question.id} question={question} worksheet={worksheet} phase={phase} paused={paused} onLock={onLock} />}
      <GameHud
        accent={accent}
        hint={phase === "next" ? "Raise both hands (or Enter) for the next question" : templateHint ?? (tpl ? tpl.def.hint(question!) : "")}
        phaseMs={phaseMs}
        total={worksheet.questions.length}
      />
      {!paused && phase !== "end" && <HandCursors accent={accent} />}
    </div>
  );
}
