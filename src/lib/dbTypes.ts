// src/lib/dbTypes.ts — the storage interface shared by MongoDB (db.ts) and the offline store (memoryDb.ts).
// Every _id is a string we choose (class code, "ws_…", "s_…", "a_…"), so both stores behave the same.

export type Collection = "worksheets" | "classes" | "sessions" | "attempts" | "aiCalls";

/** Every stored document. The server sets createdAt (a real Date, so TTL indexes work); never the client. */
export type Doc = { _id: string; createdAt: Date } & Record<string, unknown>;

/** Top-level equality only, e.g. { classCode: "K7QF", simulated: false }. */
export type Filter = Record<string, unknown>;

/** Applied to the FIRST matching document. */
export type Update = { $set?: Record<string, unknown>; $push?: Record<string, unknown> };

export type FindOptions = { sort?: Record<string, 1 | -1>; limit?: number };

export type AiCallLog = {
  agent: string;
  model: string;
  inputHash: string;
  ms: number;
  ok: boolean;
  error: string | null;
  outputJson: unknown;
  sessionId?: string | null;
  classCode?: string | null;
  reason?: string | null;
};

export interface Store {
  /** Inserts and returns the _id (generated with `prefix` if the doc has none). */
  insert(coll: Collection, doc: Record<string, unknown> & { _id?: string }, prefix?: string): Promise<string>;
  find<T extends Doc = Doc>(coll: Collection, filter?: Filter, opts?: FindOptions): Promise<T[]>;
  findOne<T extends Doc = Doc>(coll: Collection, filter: Filter): Promise<T | null>;
  /** Updates the first match; returns how many matched (0 or 1). */
  update(coll: Collection, filter: Filter, update: Update): Promise<number>;
  /** One row in aiCalls per AI call (powers the AI trace and the offline replay). Never throws. */
  log(entry: AiCallLog): Promise<void>;
}

export class DuplicateIdError extends Error {
  constructor(public readonly id: string) {
    super(`duplicate _id ${id}`);
  }
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12)}`;
}
