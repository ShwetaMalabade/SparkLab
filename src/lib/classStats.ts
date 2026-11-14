// src/lib/classStats.ts — everything the teacher's phone shows, computed by code (docs/plan/06 §4). Server-only.
// Numbers come only from attempts (first attempt per student per question); the AI never supplies one.
import { db, type Doc } from "./db";
import type { TWorksheet } from "./schema";
import { loadWorksheet } from "./worksheetStore";

export type ClassStats = {
  code: string;
  waiting: boolean; // true until a worksheet is linked
  worksheetTitle: string | null;
  updatedAt: string;
  ofStudents: number; // students with ≥ 1 answer
  questions: { id: string; short: string; correctPct: number; n: number }[]; // worksheet questions only
  students: {
    sessionId: string;
    nickname: string;
    simulated: boolean;
    profile: string | null;
    live: boolean;
    answers: Record<string, "correct" | "wrong" | null>;
    variants: number;
    score: number;
  }[];
  topMistakes: { misconceptionId: string; label: string; students: number; ofStudents: number; nicknames: string[] }[];
  latest: { nickname: string; simulated: boolean; questionId: string; chosenText: string; correct: boolean; label: string | null; at: string }[];
  coachFeed: { nickname: string; reason: string; at: string; variant: boolean; rejected: boolean; fallback: boolean }[];
};

type SessionDoc = Doc & { nickname: string; simulated?: boolean; profile?: string | null; endedAt: Date | null; variants?: unknown[] };
type DecisionDoc = Doc & { sessionId: string | null; reason: string | null; outputJson: { origin?: string | null; rejected?: string[] | null; source?: string } | null };

const short = (s: string, n = 28) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export async function classStats(code: string): Promise<ClassStats | null> {
  const cls = await db.findOne<Doc & { worksheetId: string | null }>("classes", { _id: code });
  if (!cls) return null;
  const ws: TWorksheet | null = cls.worksheetId ? await loadWorksheet(cls.worksheetId) : null;
  const base = { code, worksheetTitle: ws?.title ?? null, updatedAt: new Date().toISOString() };
  if (!ws)
    return { ...base, waiting: true, ofStudents: 0, questions: [], students: [], topMistakes: [], latest: [], coachFeed: [] };

  const [facet, sessions, decisions] = await Promise.all([
    db.aggregateClass(code),
    db.find<SessionDoc>("sessions", { classCode: code }),
    db.find<DecisionDoc>("aiCalls", { classCode: code, agent: "director", inputHash: "decision" }, { sort: { createdAt: -1 }, limit: 5 }),
  ]);
  const byId = new Map(sessions.map((s) => [s._id, s]));
  const nick = (sid: string | null) => (sid && byId.get(sid)?.nickname) || "Student";
  const label = (id: string | null) => (id ? (ws.misconceptions.find((m) => m.id === id)?.label ?? id) : null);
  const wsQuestions = ws.questions.filter((q) => q.origin === "worksheet");
  const ofStudents = facet.perStudent.length;

  const answered = new Map(facet.perStudent.map((p) => [p._id, p.answers]));
  const students = sessions
    .map((s) => {
      const ans = answered.get(s._id) ?? [];
      return {
        sessionId: s._id,
        nickname: s.nickname,
        simulated: !!s.simulated,
        profile: s.profile ?? null,
        live: !s.simulated && !s.endedAt,
        answers: Object.fromEntries(
          wsQuestions.map((q) => {
            const a = ans.find((x) => x.q === q.id);
            return [q.id, a ? (a.correct ? "correct" : "wrong") : null];
          }),
        ) as Record<string, "correct" | "wrong" | null>,
        variants: s.variants?.length ?? 0,
        score: ans.filter((a) => a.correct).length,
        startedAt: +new Date(s.createdAt),
      };
    })
    .sort((a, b) => Number(b.live) - Number(a.live) || Number(a.simulated) - Number(b.simulated) || b.startedAt - a.startedAt)
    .map((s) => {
      const { startedAt, ...rest } = s;
      void startedAt; // only used for sorting
      return rest;
    });

  return {
    ...base,
    waiting: false,
    ofStudents,
    questions: wsQuestions.map((q) => {
      const p = facet.perQuestion.find((x) => x._id === q.id);
      return { id: q.id, short: short(q.concept || q.prompt), correctPct: p && p.n ? Math.round((100 * p.right) / p.n) : 0, n: p?.n ?? 0 };
    }),
    students,
    topMistakes: facet.mistakes.map((m) => ({
      misconceptionId: m._id,
      label: label(m._id)!,
      students: m.n,
      ofStudents,
      nicknames: m.students.map(nick).sort((a, b) => a.localeCompare(b)), // $addToSet has no order: keep the phone stable
    })),
    latest: facet.latest.map((f) => ({
      nickname: nick(f._id.s),
      simulated: f.simulated,
      questionId: f._id.q,
      chosenText: f.chosenText,
      correct: f.correct,
      label: f.correct ? null : label(f.misconceptionId),
      at: new Date(f.at).toISOString(),
    })),
    coachFeed: decisions.map((d) => ({
      nickname: nick(d.sessionId),
      reason: d.reason ?? "",
      at: new Date(d.createdAt).toISOString(),
      variant: d.outputJson?.origin === "variant",
      rejected: !!d.outputJson?.rejected?.length,
      fallback: d.outputJson?.source === "fallback",
    })),
  };
}
