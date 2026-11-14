// src/lib/worksheetStore.ts — save/load worksheets. Server-only.
// In the database the worksheet's id is the document _id and createdAt is a real Date (set by the store);
// the contract type TWorksheet uses `id` and an ISO string, so convert at this one boundary.
import { db, type Doc } from "./db";
import { Worksheet, type TWorksheet } from "./schema";

type WorksheetDoc = Doc & Omit<TWorksheet, "id" | "createdAt"> & { dropped?: string[] };

export async function saveWorksheet(ws: Omit<TWorksheet, "createdAt">, dropped: string[] = []): Promise<TWorksheet> {
  const { id, ...rest } = ws;
  await db.insert("worksheets", { ...rest, _id: id, dropped });
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

export async function replaceQuestions(id: string, questions: TWorksheet["questions"]): Promise<void> {
  await db.update("worksheets", { _id: id }, { $set: { questions } });
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
