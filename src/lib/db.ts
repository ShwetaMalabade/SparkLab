// src/lib/db.ts — MongoDB Atlas (docs/plan/02 §6.3), or the in-memory store when OFFLINE=1.
// Server-only. The MongoClient is cached on globalThis: Atlas Free has a connection cap and
// Next.js reloads/serverless instances would otherwise open a new pool each time.
import { MongoClient, MongoServerError, type Db as MongoDb } from "mongodb";
import { DuplicateIdError, newId, type Collection, type Doc, type FindOptions, type Filter, type Store, type Update } from "./dbTypes";
import { memoryDb } from "./memoryDb";

export type { AiCallLog, Collection, Doc, Filter, Store, Update } from "./dbTypes";
export { DuplicateIdError, newId } from "./dbTypes";

const g = globalThis as typeof globalThis & { __haMongo?: Promise<MongoDb> };

async function connect(): Promise<MongoDb> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (set it in .env.local, or run with OFFLINE=1)");
  // ignoreUndefined: without it the driver stores `undefined` fields as null, and optional
  // (non-nullable) schema fields like params.decoys would then fail validation on load.
  const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000, ignoreUndefined: true });
  await client.connect();
  const mdb = client.db(process.env.MONGODB_DB ?? "homework_arena");
  await Promise.all([
    mdb.collection("attempts").createIndex({ classCode: 1, createdAt: 1 }),
    mdb.collection("sessions").createIndex({ classCode: 1 }),
    mdb.collection("aiCalls").createIndex({ classCode: 1, createdAt: -1 }),
    mdb.collection("aiCalls").createIndex({ agent: 1, inputHash: 1 }),
  ]);
  return mdb;
}

function mongo(): Promise<MongoDb> {
  // On failure, forget the promise so the next request retries instead of failing forever.
  g.__haMongo ??= connect().catch((e) => {
    g.__haMongo = undefined;
    throw e;
  });
  return g.__haMongo;
}

const col = async (c: Collection) => (await mongo()).collection<Doc>(c);

export const mongoDb: Store = {
  async insert(coll, doc, prefix = coll.slice(0, 2)) {
    const _id = doc._id ?? newId(prefix);
    try {
      await (await col(coll)).insertOne({ ...doc, _id, createdAt: new Date() });
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) throw new DuplicateIdError(_id);
      throw e;
    }
    return _id;
  },

  async find<T extends Doc = Doc>(coll: Collection, filter: Filter = {}, opts: FindOptions = {}) {
    let cur = (await col(coll)).find(filter);
    if (opts.sort) cur = cur.sort(opts.sort);
    if (opts.limit) cur = cur.limit(opts.limit);
    return (await cur.toArray()) as T[];
  },

  async findOne<T extends Doc = Doc>(coll: Collection, filter: Filter) {
    return ((await (await col(coll)).findOne(filter)) as T | null) ?? null;
  },

  async update(coll, filter, update: Update) {
    const u: Record<string, unknown> = {};
    if (update.$set) u.$set = update.$set;
    if (update.$push) u.$push = update.$push;
    const r = await (await col(coll)).updateOne(filter, u);
    return r.matchedCount;
  },

  async log(entry) {
    try {
      await mongoDb.insert("aiCalls", entry, "ai");
    } catch {
      /* logging must never break a request */
    }
  },
};

/** The store every route uses. OFFLINE=1 → memory (demo laptop, Wi-Fi off). */
export const db: Store = process.env.OFFLINE === "1" ? memoryDb : mongoDb;
