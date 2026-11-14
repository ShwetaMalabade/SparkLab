// src/lib/replayExport.ts — builds the offline replay from one class's real run (used by scripts/export-replay.ts).
// Server-only. Everything exported is a real, successful model output; nothing is hand-written.
import { db, type Doc } from "./db";
import type { RecordedDecision, ReplaySeed } from "./replaySeed";

type AiRow = Doc & { agent: string; model: string; inputHash: string; ok: boolean; outputJson: unknown; reason: string | null };

export type Replay = { calls: Record<string, unknown>; seed: ReplaySeed; worksheetTitle: string; questions: number };

export async function buildReplay(code: string): Promise<Replay> {
  const cls = await db.findOne<Doc & { worksheetId: string | null }>("classes", { _id: code });
  if (!cls) throw new Error(`No class ${code} (classes expire after 24 h).`);
  if (!cls.worksheetId) throw new Error(`Class ${code} has no worksheet yet: scan one first.`);
  const ws = await db.findOne<Doc>("worksheets", { _id: cls.worksheetId });
  if (!ws) throw new Error(`Worksheet ${cls.worksheetId} is gone.`);

  const rows = (await db.find<AiRow>("aiCalls", { classCode: code }, { sort: { createdAt: 1 } })).filter(
    (r) => r.ok && r.model !== "code" && r.outputJson != null,
  );

  // 1. exact replays, keyed like askJSON's lookup (replay.ts)
  const calls: Record<string, unknown> = {};
  for (const r of rows) calls[`${r.agent}:${r.inputHash}`] ??= r.outputJson;

  // 2. coach decisions with the answer they followed (coach.ts tags each call "next first" or "next after q2/C/0")
  const coach: RecordedDecision[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.agent !== "director") continue;
    const m = /^next (?:first|after (\S+)\/([A-DX])\/([01]))$/.exec(r.reason ?? "");
    if (!m) continue;
    const d: RecordedDecision = m[1]
      ? { questionId: m[1], chosen: m[2], correct: m[3] === "1", output: r.outputJson }
      : { questionId: null, chosen: null, correct: null, output: r.outputJson };
    const key = `${d.questionId}/${d.chosen}`;
    if (seen.has(key)) continue; // the first decision for each answer
    seen.add(key);
    coach.push(d);
  }

  const { createdAt, ...worksheet } = ws;
  void createdAt; // offline start-up gives it a fresh createdAt
  return {
    calls,
    seed: { recordedAt: new Date().toISOString(), worksheet: worksheet as ReplaySeed["worksheet"], coach },
    worksheetTitle: String(ws.title),
    questions: Array.isArray(ws.questions) ? ws.questions.length : 0,
  };
}
