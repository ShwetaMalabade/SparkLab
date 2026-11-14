// src/lib/replaySeed.ts — what offline mode (OFFLINE=1) starts with, besides data/replay/aiCalls.json. Server-only.
// Both files are written by scripts/export-replay.ts from one real demo played in live mode (docs/plan/02 §4).
//   worksheet: the scanned worksheet exactly as stored (questions, registry, drafts), so Review edits still work
//   coach:     each real coach decision with the answer that triggered it, so the offline coach can reuse it
//              when its exact prompt (which includes the seconds left) has no recorded match. Code still checks it.
import fs from "node:fs";
import path from "node:path";
import type { Doc } from "./dbTypes";

export const REPLAY_WS_ID = "replay"; // alias: the recorded worksheet, whatever its original id was

export type RecordedDecision = { questionId: string | null; chosen: string | null; correct: boolean | null; output: unknown };
export type ReplaySeed = { recordedAt: string; worksheet: Record<string, unknown> & { _id: string }; coach: RecordedDecision[] };

const DATE_FIELDS = new Set(["createdAt", "startedAt", "endedAt"]);
const revive = (_k: string, v: unknown) => (DATE_FIELDS.has(_k) && typeof v === "string" ? new Date(v) : v);

let cached: ReplaySeed | null | undefined;
export function loadReplaySeed(file = path.join(process.cwd(), "data/replay/seed.json")): ReplaySeed | null {
  if (cached !== undefined) return cached;
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"), revive) as ReplaySeed;
    cached = s?.worksheet?._id ? s : null;
  } catch {
    cached = null; // no recording yet: offline mode still runs, with code fallbacks only
  }
  return cached;
}
/** Tests only. */
export function setReplaySeed(s: ReplaySeed | null): void {
  cached = s;
}

/** The recorded worksheet under its own id and under the "replay" alias (for "Use last scan" on any laptop). */
export function seedDocs(s: ReplaySeed): { worksheets: Doc[] } {
  const ws = { ...s.worksheet, createdAt: new Date() } as Doc; // fresh createdAt: it is "scanned" now
  return { worksheets: ws._id === REPLAY_WS_ID ? [ws] : [ws, { ...ws, _id: REPLAY_WS_ID }] };
}

/** The recorded decision for the same answer (same question + same choice), else the same question with the same
 *  correctness, else null. First question (no answer yet) matches a recorded first call. */
export function recordedDecision(s: ReplaySeed | null, last: { questionId: string; chosen: string; correct: boolean } | null): unknown | null {
  if (!s) return null;
  if (!last) return s.coach.find((d) => d.questionId === null)?.output ?? null;
  return (
    s.coach.find((d) => d.questionId === last.questionId && d.chosen === last.chosen)?.output ??
    s.coach.find((d) => d.questionId === last.questionId && d.correct === last.correct)?.output ??
    null
  );
}
