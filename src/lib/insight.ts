// src/lib/insight.ts — Agent 6, the teacher's AI insights (docs/plan/03 §11, 06 §6). Server-only.
// The AI only words what code already counted: every string must pass numbersAllowed() against the
// computed stats + labels, or code replaces it with a line it builds itself. Cached 20 s per class.
import { createHash } from "node:crypto";
import { z } from "zod";
import { askJSON, type AskResult } from "./ai";
import { numbersAllowed } from "./agents/director";
import { classStats, type ClassStats } from "./classStats";
import { db, type Doc } from "./db";
import { INSIGHT_PROMPT } from "./prompts";
import { loadWorksheet } from "./worksheetStore";

export const InsightOut = z.object({
  bullets: z.array(z.string().max(200)).length(3),
  groups: z.array(z.object({ name: z.string().max(30), students: z.array(z.string()), mistake: z.string() })).max(3),
  nextMove: z.string().max(220),
});
export type TInsightOut = z.infer<typeof InsightOut>;

export type Insight = TInsightOut & {
  checked: true; // every number was checked by code (failing text is already replaced)
  source: "ai" | "code" | "last-good"; // last-good = this call failed, so the previous checked result is shown
  replaced: number; // how many AI strings code replaced
  at: string;
};

export type InsightDeps = { ask: (prompt: string, classCode: string) => Promise<AskResult<TInsightOut>> };
const realAgent: InsightDeps = {
  ask: (prompt, classCode) => askJSON("insight", InsightOut, prompt, { ctx: { classCode, reason: "insight" } }) as Promise<AskResult<TInsightOut>>,
};

export const INSIGHT_TTL_MS = 20_000;
type Entry = { at: number; key: string; result: Insight };
const g = globalThis as typeof globalThis & { __haInsight?: Map<string, Entry>; __haInsightBusy?: Map<string, Promise<Insight | null>> };
const cache = (g.__haInsight ??= new Map());
const busy = (g.__haInsightBusy ??= new Map());

/** Tests only. */
export function resetInsightCache(): void {
  cache.clear();
  busy.clear();
}

/** The code-built line used whenever AI text fails the number check (or there is no AI text). */
export function codeLine(s: ClassStats): string {
  const m = s.topMistakes[0];
  return m ? `Top mistake: ${m.label} (${m.students} of ${m.ofStudents} students).` : "No shared mistake yet.";
}

/** What the agent sees (and what its numbers are checked against): the stats minus timestamps, so the
 *  prompt only changes when the class does (stable cache key + replay hash). */
function promptInput(s: ClassStats) {
  return {
    worksheetTitle: s.worksheetTitle,
    ofStudents: s.ofStudents,
    questions: s.questions,
    students: s.students.map(({ nickname, simulated, profile, live, answers, variants, score }) => ({ nickname, simulated, profile, live, answers, variants, score })),
    // Labels only: with the ids in view the model wrote "forgot_double_angle" to the teacher (real output, 2026-11-14).
    topMistakes: s.topMistakes.map(({ label, students, ofStudents, nicknames }) => ({ label, students, ofStudents, nicknames })),
    latest: s.latest.map(({ at, ...rest }) => (void at, rest)),
    // Coach decisions only: fallback rows are code's "next question" notes (timeouts etc.), not something to tell a teacher.
    coachReasons: s.coachFeed.filter((c) => !c.fallback).map((c) => ({ nickname: c.nickname, reason: c.reason, wroteVariant: c.variant, codeRejected: c.rejected })),
  };
}

/** Code's check of one agent answer. Exported for tests. */
export function checkInsight(out: TInsightOut, stats: ClassStats, labels: string[]): Omit<Insight, "source" | "at"> {
  const ref = { stats: promptInput(stats), labels };
  const ok = (t: string) => numbersAllowed(t, ref);
  let replaced = 0;
  const line = codeLine(stats);

  const bullets: string[] = [];
  for (const b of out.bullets) {
    const text = ok(b) ? b.trim() : (replaced++, line);
    if (text && !bullets.includes(text)) bullets.push(text);
  }

  // Groups: the AI may not invent numbers or students. Unknown nicknames are dropped, then empty groups.
  const known = new Set(stats.students.map((s) => s.nickname));
  const groups = out.groups.flatMap((gr) => {
    if (!ok(gr.name) || !ok(gr.mistake)) return replaced++, [];
    const students = [...new Set(gr.students.filter((n) => known.has(n)))];
    return students.length ? [{ name: gr.name, students, mistake: gr.mistake }] : [];
  });

  const top = stats.topMistakes[0];
  let nextMove = out.nextMove.trim();
  if (!ok(nextMove)) {
    replaced++;
    nextMove = top ? `Start tomorrow by re-teaching: ${top.label}.` : "";
  }
  return { bullets, groups, nextMove, checked: true, replaced };
}

const codeOnly = (s: ClassStats, now: number): Insight => ({
  bullets: [s.ofStudents ? codeLine(s) : "No answers yet. Insights appear after the first answers."],
  groups: [],
  nextMove: "",
  checked: true,
  source: "code",
  replaced: 0,
  at: new Date(now).toISOString(),
});

export type InsightResult = { ok: true; insight: Insight } | { ok: false; status: number; error: string };

export async function classInsight(code: string, deps: InsightDeps = realAgent, now = Date.now()): Promise<InsightResult> {
  const stats = await classStats(code);
  if (!stats) return { ok: false, status: 404, error: `No class ${code}.` };
  if (stats.waiting || stats.ofStudents === 0) return { ok: true, insight: codeOnly(stats, now) };

  const input = promptInput(stats);
  const json = JSON.stringify(input);
  const key = createHash("sha256").update(json).digest("hex").slice(0, 16);
  const hit = cache.get(code);
  // Fresh for 20 s, and for as long as nothing in the class changed (saves model quota on a quiet class).
  if (hit && (now - hit.at < INSIGHT_TTL_MS || hit.key === key)) return { ok: true, insight: hit.result };

  // One call per class at a time: a second phone polling meanwhile waits for the same answer.
  let p = busy.get(code);
  if (!p) {
    p = (async () => {
      const cls = await db.findOne<Doc & { worksheetId: string | null }>("classes", { _id: code });
      const ws = cls?.worksheetId ? await loadWorksheet(cls.worksheetId) : null;
      const labels = ws ? [...ws.misconceptions.map((m) => m.label), ...ws.questions.map((q) => q.concept)] : [];
      const r = await deps.ask(INSIGHT_PROMPT(json), code);
      if (!r.ok) return null;
      const result: Insight = { ...checkInsight(r.data, stats, labels), source: "ai", at: new Date(now).toISOString() };
      if (!result.bullets.length) result.bullets = [codeLine(stats)];
      cache.set(code, { at: now, key, result });
      return result;
    })()
      .catch(() => null)
      .finally(() => busy.delete(code));
    busy.set(code, p);
  }
  const fresh = await p;
  if (fresh) return { ok: true, insight: fresh };
  // The call failed: show the last good (checked) result, else the code-built line alone (06 §6).
  return { ok: true, insight: hit ? { ...hit.result, source: "last-good" } : codeOnly(stats, now) };
}
