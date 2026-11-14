// src/lib/worksheetStore.ts — save/load worksheets. Server-only.
// In the database the worksheet's id is the document _id and createdAt is a real Date (set by the store);
// the contract type TWorksheet uses `id` and an ISO string, so convert at this one boundary.
import { db, type Doc } from "./db";
import type { z } from "zod";
import { Worksheet, type DesignQuestion, type ReadQuestion, type TWorksheet } from "./schema";

/** The agent drafts behind each question, kept so a Review edit can re-run assemble() with no AI call. */
export type Drafts = Record<string, { read: z.infer<typeof ReadQuestion>; design: z.infer<typeof DesignQuestion> }>;

type WorksheetDoc = Doc & Omit<TWorksheet, "id" | "createdAt"> & { dropped?: string[]; drafts?: Drafts };

export async function saveWorksheet(ws: Omit<TWorksheet, "createdAt">, dropped: string[] = [], drafts: Drafts = {}): Promise<TWorksheet> {
  const { id, ...rest } = ws;
  await db.insert("worksheets", { ...rest, _id: id, dropped, drafts });
  const saved = await loadWorksheet(id);
  if (!saved) throw new Error(`worksheet ${id} vanished after insert`);
  return saved;
}

export async function loadWorksheet(id: string): Promise<TWorksheet | null> {
  const doc = await db.findOne<WorksheetDoc>("worksheets", { _id: id });
  return doc ? toWorksheet(doc) : null;
}

/** Notes about questions code dropped during the scan (for the Review screen). */
export async function loadDropped(id: string): Promise<string[]> {
  return (await db.findOne<WorksheetDoc>("worksheets", { _id: id }))?.dropped ?? [];
}

export async function loadDrafts(id: string): Promise<Drafts> {
  return (await db.findOne<WorksheetDoc>("worksheets", { _id: id }))?.drafts ?? {};
}

export async function replaceQuestion(id: string, question: TWorksheet["questions"][number], draft: Drafts[string]): Promise<void> {
  const doc = await db.findOne<WorksheetDoc>("worksheets", { _id: id });
  if (!doc) return;
  const questions = doc.questions.map((q) => (q.id === question.id ? question : q));
  // Whole-object $set (no dotted paths) so MongoDB and the memory store behave identically.
  await db.update("worksheets", { _id: id }, { $set: { questions, drafts: { ...doc.drafts, [question.id]: draft } } });
}

/** Teacher removed a question on Review. Refuses to remove the last one (a worksheet needs ≥ 1). */
export async function removeQuestion(id: string, questionId: string): Promise<"ok" | "missing" | "last"> {
  const doc = await db.findOne<WorksheetDoc>("worksheets", { _id: id });
  if (!doc || !doc.questions.some((q) => q.id === questionId)) return "missing";
  if (doc.questions.length === 1) return "last";
  const drafts = { ...doc.drafts };
  delete drafts[questionId];
  await db.update("worksheets", { _id: id }, {
    $set: { questions: doc.questions.filter((q) => q.id !== questionId), drafts, dropped: [...(doc.dropped ?? []), `removed ${questionId} on Review`] },
  });
  return "ok";
}

function toWorksheet(doc: WorksheetDoc): TWorksheet {
  return Worksheet.parse({
    id: doc._id,
    title: doc.title,
    source: doc.source,
    imageHash: doc.imageHash,
    questions: doc.questions,
    misconceptions: doc.misconceptions,
    createdAt: new Date(doc.createdAt).toISOString(),
  });
}
