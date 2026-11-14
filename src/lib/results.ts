// src/lib/results.ts — the Results screen's numbers (docs/plan/07 §2 screen 6), computed by code.
// Pure (no db, no browser APIs): the server route and the browser fallback build the same summary.
import type { TQuestion, TWorksheet } from "./schema";

export type ResultAttempt = { questionId: string; correct: boolean; misconceptionId: string | null };

export type Results = {
  worksheetId: string;
  worksheetTitle: string;
  nickname: string | null;
  score: number; // first answers that were right
  answered: number; // questions answered (first answer each)
  timePlayedSec: number | null;
  topics: { topic: string; label: string; right: number; n: number }[];
  topMistake: { label: string; why: string | null; times: number } | null;
  coachNote: string | null; // the coach's last decision reason (server only)
  variants: { id: string; concept: string; prompt: string; result: "correct" | "wrong" | null }[]; // questions the coach wrote
  source: "server" | "device";
};

const TOPIC_LABEL: Record<string, string> = {
  projectile_motion: "Projectile motion",
  newtons_second_law: "Newton's 2nd law",
  free_fall: "Free fall",
  kinematics: "Kinematics",
  energy: "Energy",
  reaction_prediction: "Predicting reactions",
  balancing_equations: "Balancing equations",
  acid_base_ph: "Acids, bases & pH",
  stoichiometry: "Stoichiometry",
  other_physics: "Physics",
  other_chemistry: "Chemistry",
};

/** attempts must be in the order they happened; only the first answer to each question counts (same rule as the live view). */
export function summarizeResults(
  ws: TWorksheet,
  attempts: ResultAttempt[],
  o: { playId?: string; nickname?: string | null; startedAt?: number | null; endedAt?: number | null; variants?: TQuestion[]; coachNote?: string | null; source: Results["source"] },
): Results {
  const variants = o.variants ?? [];
  const byId = new Map([...ws.questions, ...variants].map((q) => [q.id, q]));
  const first = new Map<string, ResultAttempt>();
  for (const a of attempts) if (!first.has(a.questionId)) first.set(a.questionId, a);
  const answers = [...first.values()];

  const topics = new Map<string, { right: number; n: number }>();
  for (const a of answers) {
    const topic = byId.get(a.questionId)?.topic;
    if (!topic) continue; // a coach question this device never saw: still in the score, not in a topic
    const t = topics.get(topic) ?? { right: 0, n: 0 };
    t.n++;
    if (a.correct) t.right++;
    topics.set(topic, t);
  }

  const counts = new Map<string, number>();
  for (const a of answers) if (!a.correct && a.misconceptionId) counts.set(a.misconceptionId, (counts.get(a.misconceptionId) ?? 0) + 1);
  let top: [string, number] | null = null;
  for (const e of counts) if (!top || e[1] > top[1]) top = e; // ties: the mistake made first
  const m = top ? ws.misconceptions.find((x) => x.id === top[0]) : undefined;

  const time = o.startedAt != null && o.endedAt != null && o.endedAt >= o.startedAt ? Math.round((o.endedAt - o.startedAt) / 1000) : null;

  return {
    worksheetId: o.playId ?? ws.id, // the id the game was opened with (e.g. "fixture"), for "Play again"
    worksheetTitle: ws.title,
    nickname: o.nickname ?? null,
    score: answers.filter((a) => a.correct).length,
    answered: answers.length,
    timePlayedSec: time,
    topics: [...topics].map(([topic, t]) => ({ topic, label: TOPIC_LABEL[topic] ?? topic, ...t })),
    topMistake: top ? { label: m?.label ?? top[0], why: m?.why ?? null, times: top[1] } : null,
    coachNote: o.coachNote ?? null,
    variants: variants.map((q) => {
      const a = first.get(q.id);
      return { id: q.id, concept: q.concept, prompt: q.prompt, result: a ? (a.correct ? "correct" : "wrong") : null };
    }),
    source: o.source,
  };
}
