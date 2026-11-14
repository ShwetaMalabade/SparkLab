"use client";
// Play flow (P1-11): getWorksheet(wsId) → Calibrate → createSession → GameRunner (Arena + Avatar + HUD).
// The camera starts on Calibrate and stays on for the game. Without a camera, everything runs by keyboard.
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSession, getClassCode, getWorksheet } from "@/lib/client/api";
import type { TWorksheet } from "@/lib/schema";
import { Calibrate, type CalibrationResult } from "@/game/Calibrate";
import { GameRunner } from "@/game/GameRunner";
import type { GameSession } from "@/game/store";
import { MotionProvider } from "@/motion/MotionProvider";

type Stage =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "calibrate"; ws: TWorksheet }
  | { kind: "starting"; ws: TWorksheet }
  | { kind: "game"; ws: TWorksheet; session: GameSession; calibrated: boolean };

export function PlayClient() {
  const { wsId } = useParams<{ wsId: string }>();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    getWorksheet(wsId)
      .then((ws) => !cancelled && setStage({ kind: "calibrate", ws }))
      .catch((e: unknown) => !cancelled && setStage({ kind: "error", message: e instanceof Error ? e.message : "Could not load the worksheet" }));
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const onStart = async (ws: TWorksheet, r: CalibrationResult) => {
    setStage({ kind: "starting", ws });
    const classCode = getClassCode() ?? "TEST";
    try {
      const s = await createSession({ classCode, worksheetId: ws.id, nickname: r.nickname, mode: "seated" });
      setStage({
        kind: "game", ws, calibrated: r.calibrated,
        session: { sessionId: s.sessionId, classCode, worksheetId: ws.id, timeBudgetSec: s.timeBudgetSec, nickname: r.nickname },
      });
    } catch (e) {
      setStage({ kind: "error", message: e instanceof Error ? e.message : "Could not start the session" });
    }
  };

  const accent = stage.kind === "calibrate" && stage.ws.questions[0]?.subject === "chemistry" ? "magenta" : "cyan";

  return (
    <MotionProvider>
      {stage.kind === "loading" && <Centered>Loading the lab…</Centered>}
      {stage.kind === "error" && (
        <Centered>
          <span className="text-coral">✗ {stage.message}</span>
        </Centered>
      )}
      {stage.kind === "calibrate" && <Calibrate accent={accent} onStart={(r) => void onStart(stage.ws, r)} />}
      {stage.kind === "starting" && <Centered>Starting your session…</Centered>}
      {stage.kind === "game" && <GameRunner worksheet={stage.ws} session={stage.session} calibrated={stage.calibrated} />}
    </MotionProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="grid flex-1 place-items-center px-6 text-center text-xl text-muted">{children}</main>;
}
