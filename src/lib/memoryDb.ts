// src/lib/memoryDb.ts — in-memory store for offline mode (OFFLINE=1). Same interface as MongoDB.
// Kept on globalThis so dev-server reloads don't wipe it. Returns copies, like a real database would.
import { DuplicateIdError, newId, type ClassFacet, type Collection, type Doc, type FindOptions, type Filter, type FirstAttempt, type Store, type Update } from "./dbTypes";

type Tables = Record<Collection, Doc[]>;
const g = globalThis as typeof globalThis & { __haMemoryDb?: Tables };
const tables = (): Tables => (g.__haMemoryDb ??= { worksheets: [], classes: [], sessions: [], attempts: [], aiCalls: [] });

const matches = (d: Doc, f: Filter) => Object.entries(f).every(([k, v]) => d[k] === v);
const copy = <T>(x: T): T => structuredClone(x);

export const memoryDb: Store = {
  async insert(coll, doc, prefix = coll.slice(0, 2)) {
    const _id = doc._id ?? newId(prefix);
    if (tables()[coll].some((d) => d._id === _id)) throw new DuplicateIdError(_id);
    tables()[coll].push(copy({ ...doc, _id, createdAt: new Date() }));
    return _id;
  },

  async find<T extends Doc = Doc>(coll: Collection, filter: Filter = {}, opts: FindOptions = {}) {
    let rows = tables()[coll].filter((d) => matches(d, filter));
    const sort = Object.entries(opts.sort ?? {});
    if (sort.length)
      rows = [...rows].sort((a, b) => {
        for (const [k, dir] of sort) {
          const x = a[k] as number | string | Date, y = b[k] as number | string | Date;
          if (x < y) return -dir;
          if (x > y) return dir;
        }
        return 0;
      });
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return copy(rows) as T[];
  },

  async findOne<T extends Doc = Doc>(coll: Collection, filter: Filter) {
    const d = tables()[coll].find((x) => matches(x, filter));
    return d ? (copy(d) as T) : null;
  },

  async update(coll, filter, update: Update) {
    const d = tables()[coll].find((x) => matches(x, filter));
    if (!d) return 0;
    for (const [k, v] of Object.entries(update.$set ?? {})) d[k] = copy(v);
    for (const [k, v] of Object.entries(update.$push ?? {})) d[k] = [...((d[k] as unknown[]) ?? []), copy(v)];
    return 1;
  },

  // Same result as the MongoDB $facet pipeline in db.ts, in plain JS.
  async aggregateClass(code) {
    const rows = tables().attempts
      .filter((a) => a.classCode === code)
      .sort((a, b) => +a.createdAt - +b.createdAt);
    const first = new Map<string, FirstAttempt>();
    for (const a of rows) {
      const key = `${a.sessionId}|${a.questionId}`;
      if (!first.has(key))
        first.set(key, {
          _id: { s: a.sessionId as string, q: a.questionId as string },
          origin: a.questionOrigin as FirstAttempt["origin"],
          correct: a.correct as boolean,
          misconceptionId: (a.misconceptionId as string | null) ?? null,
          chosenText: a.chosenText as string,
          simulated: !!a.simulated,
          at: a.createdAt,
        });
    }
    const all = [...first.values()];
    const perQuestion = new Map<string, { _id: string; n: number; right: number }>();
    for (const f of all.filter((x) => x.origin === "worksheet")) {
      const r = perQuestion.get(f._id.q) ?? { _id: f._id.q, n: 0, right: 0 };
      r.n++;
      if (f.correct) r.right++;
      perQuestion.set(f._id.q, r);
    }
    const perStudent = new Map<string, ClassFacet["perStudent"][number]>();
    for (const f of all) {
      const r = perStudent.get(f._id.s) ?? { _id: f._id.s, answers: [] };
      r.answers.push({ q: f._id.q, origin: f.origin, correct: f.correct });
      perStudent.set(f._id.s, r);
    }
    const mis = new Map<string, Set<string>>();
    for (const f of all) if (f.misconceptionId) mis.set(f.misconceptionId, (mis.get(f.misconceptionId) ?? new Set()).add(f._id.s));
    const mistakes = [...mis]
      .map(([id, set]) => ({ _id: id, students: [...set], n: set.size }))
      .sort((a, b) => b.n - a.n || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0)) // same tie-break as Mongo
      .slice(0, 3);
    const latest = [...all].sort((a, b) => +b.at - +a.at).slice(0, 5);
    return copy({ perQuestion: [...perQuestion.values()], perStudent: [...perStudent.values()], mistakes, latest });
  },

  async log(entry) {
    try {
      await memoryDb.insert("aiCalls", entry, "ai");
    } catch {
      /* logging must never break a request */
    }
  },
};

/** Offline start-up: add recorded documents (data/replay/seed.json). Idempotent: ids already present are kept. */
export function seedMemoryDb(docs: Partial<Record<Collection, Doc[]>>): void {
  for (const [coll, list] of Object.entries(docs) as [Collection, Doc[]][])
    for (const d of list) if (!tables()[coll].some((x) => x._id === d._id)) tables()[coll].push(copy(d));
}

/** Test helper: empty every table. */
export function resetMemoryDb(): void {
  g.__haMemoryDb = undefined;
}
