// src/lib/memoryDb.ts — in-memory store for offline mode (OFFLINE=1). Same interface as MongoDB.
// Kept on globalThis so dev-server reloads don't wipe it. Returns copies, like a real database would.
import { DuplicateIdError, newId, type Collection, type Doc, type FindOptions, type Filter, type Store, type Update } from "./dbTypes";

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

  async log(entry) {
    try {
      await memoryDb.insert("aiCalls", entry, "ai");
    } catch {
      /* logging must never break a request */
    }
  },
};

/** Test helper: empty every table. */
export function resetMemoryDb(): void {
  g.__haMemoryDb = undefined;
}
