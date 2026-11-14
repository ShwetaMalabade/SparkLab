"use client";
// /play/dev/variant: P1-15 check. A fake variant (copy of fixture q1 with origin "variant") must show the
// "🧠 New question from your coach" badge on the INTRO card, and the REVEAL must show "Coach: <feedback>".
import { useEffect, useState } from "react";
import { getWorksheet } from "@/lib/client/api";
import { GameHud } from "@/game/GameHud";
import { TraceDrawer } from "@/game/TraceDrawer";
import { useGame, type Phase } from "@/game/store";

const FEEDBACK = "You picked sin θ again. Try thinking about the doubled angle.";

export default function VariantDevPage() {
  const [phase, setPhase] = useState<Phase>("intro");

  useEffect(() => {
    void getWorksheet("fixture").then((ws) => {
      const q1 = ws.questions[0];
      useGame.getState().resetGame();
      const variant = { ...q1, id: "q1v1", origin: "variant" as const, parentId: q1.id };
      useGame.getState().setGame({
        question: variant,
        played: ["q1", "q1v1"],
        // A fake coach step (dev only) so the trace drawer (T) can be checked without live mode.
        trace: [
          { ns: { action: "play", question: q1, feedback: null, reason: "fallback: first question", source: "fallback", ms: 4 }, after: null, skipped: null, served: { id: "q1", origin: "worksheet" } },
          {
            ns: {
              action: "play", question: variant, feedback: FEEDBACK, source: "coach", ms: 2100,
              reason: "(dev sample) Hovered 35.3 m for 1.8 s, then picked 20.4 m. Unsure about sin 2θ → wrote a variant at 50°.",
              rejected: ['(dev sample) coach question q1v0: the "sin θ" choice equals the right answer at 60°.'],
            },
            after: { questionId: "q1", origin: "worksheet", chosenText: "20.4 m", correct: false, misconceptionId: "sin_theta_not_sin_2theta" },
            skipped: null,
            served: { id: "q1v1", origin: "variant" },
          },
        ],
      });
    });
  }, []);

  useEffect(() => {
    const G = useGame.getState();
    if (phase === "reveal") {
      G.setGame({
        phase,
        lastResult: { chosen: "D", chosenText: "20.4 m", correct: false, misconceptionId: "sin_theta_not_sin_2theta", input: "keyboard", hoverTrace: [], points: 0 },
        caption: "✗ That used sin 30° instead of sin 60°.",
        coachLine: FEEDBACK,
      });
    } else G.setGame({ phase, lastResult: null, caption: "", coachLine: null });
  }, [phase]);

  return (
    <div className="fixed inset-0 bg-navy">
      <GameHud accent="#22D3EE" hint="(dev) variant badge + coach line · T = AI trace" phaseMs={1500} total={4} />
      <TraceDrawer />
      <div className="absolute bottom-40 left-1/2 z-50 flex -translate-x-1/2 gap-2">
        {(["intro", "reveal"] as const).map((p) => (
          <button key={p} onClick={() => setPhase(p)} className={`rounded-lg border px-3 py-1 ${phase === p ? "border-cyan text-cyan" : "border-line text-muted"}`}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
