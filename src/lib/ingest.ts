// src/lib/ingest.ts — the scan pipeline (docs/plan/03 §5). Server-only.
//   photo → Agent 1 reads + solves → code checks the answers → Agent 2 models mistakes
//   → code builds every question (assemble) → repair failing ones (max 2 rounds) → save + link the class.
// Every step is reported through onStep so the Scan screen shows the REAL progress.
// The AI only writes drafts; assemble() and the code checks decide what survives.
import { createHash } from "node:crypto";
import type { z } from "zod";
import { readWorksheet, repairRead, type TReadOut } from "./agents/reader";
import { designQuestions, repairDesign, type TDesignOut } from "./agents/designer";
import type { AskResult } from "./ai";
import { assemble, checkReaction } from "./assemble";
import { isBalanced } from "./chem";
import { db, newId } from "./db";
import { compute, lintFormula, relDiff } from "./verifyPhysics";
import type { IngestStep } from "./client/types";
import type { Misconception, TQuestion, TWorksheet } from "./schema";
import { saveWorksheet } from "./worksheetStore";

type R = TReadOut["questions"][number];
type M = z.infer<typeof Misconception>;

/** Stable step ids; the Scan page maps them to labels. */
export type IngestStepId = "photo" | "reader" | "check" | "designer" | "verify" | "repair" | "save";
export type StepEvent = IngestStep & { step: IngestStepId };

export type IngestDeps = {
  read: (image: Uint8Array, ctx: { classCode: string }) => Promise<AskResult<TReadOut>>;
  repairRead: (bad: string, errors: string[], opts: { image?: Uint8Array; ctx: { classCode: string } }) => Promise<AskResult<TReadOut>>;
  design: (qs: R[], registry: M[], ctx: { classCode: string }) => Promise<AskResult<TDesignOut>>;
  repairDesign: (bad: string, errors: string[], ctx: { classCode: string }) => Promise<AskResult<TDesignOut>>;
};
const realAgents: IngestDeps = { read: readWorksheet, repairRead, design: designQuestions, repairDesign };

export type IngestResult =
  | { ok: true; worksheet: TWorksheet; dropped: string[] }
  | { ok: false; status: number; error: string };

export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const MAX_REPAIR_ROUNDS = 2;
const NOTHING_READ = "Couldn't read this worksheet. Try a sharper photo, or use the last scan.";

/** Errors the reader must fix (its formula, equation or reaction) vs. ones the designer must fix (its wrong options). */
export function isDesignerError(e: string): boolean {
  return /^[^:\s]+\/[a-z0-9_]+:|wrong option|wrong formula|wrong value|misconceptionId|need 3|no design/.test(e);
}

/** Reader-level checks only (before Agent 2 runs): does each solved answer survive code? */
function checkRead(q: R): { ok: boolean; keyMismatch: boolean } {
  if (q.formula) {
    const l = lintFormula(q.formula, q.given);
    if (l.error) return { ok: false, keyMismatch: false };
    try {
      const v = compute(l.formula, q.given);
      const key = q.printedAnswer ? parseFloat(q.printedAnswer.replace(/[^\d.eE+-]/g, "")) : NaN;
      return { ok: Number.isFinite(v) && v > 0, keyMismatch: Number.isFinite(key) && relDiff(key, v) > 0.02 };
    } catch {
      return { ok: false, keyMismatch: false };
    }
  }
  if (q.equation) {
    const b = isBalanced(q.equation);
    return { ok: !b.error && b.balanced && b.minimal, keyMismatch: false };
  }
  if (q.reaction) return { ok: checkReaction(q.reaction).length === 0, keyMismatch: false };
  return { ok: true, keyMismatch: false };
}

export async function ingest(
  input: { image: Uint8Array; classCode: string },
  onStep: (s: StepEvent) => void,
  deps: IngestDeps = realAgents,
): Promise<IngestResult> {
  const ctx = { classCode: input.classCode };
  const timed = async <T>(step: IngestStepId, fn: () => Promise<{ value: T; detail?: string; status?: "done" | "error" }>) => {
    onStep({ step, status: "running" });
    const t0 = Date.now();
    const r = await fn();
    onStep({ step, status: r.status ?? "done", ms: Date.now() - t0, detail: r.detail });
    return r.value;
  };

  // ---- photo
  const imageHash = await timed("photo", async () => {
    const h = createHash("sha256").update(input.image).digest("hex").slice(0, 32);
    return { value: h, detail: `${Math.round(input.image.byteLength / 1024)} KB` };
  });

  // ---- Agent 1: read + solve (one repair if its JSON didn't match the schema)
  const read = await timed("reader", async () => {
    let r = await deps.read(input.image, ctx);
    if (!r.ok && r.issues.length && r.raw) r = await deps.repairRead(r.raw, r.issues, { image: input.image, ctx });
    return r.ok
      ? { value: r.data, detail: `${r.data.questions.length} questions read` }
      : { value: null, status: "error" as const, detail: r.error };
  });
  if (!read) return { ok: false, status: 422, error: NOTHING_READ };
  const reads = new Map(read.questions.map((q) => [q.id, q]));

  // ---- code checks the AI's answers
  await timed("check", async () => {
    const checks = read.questions.map(checkRead);
    const bad = checks.filter((c) => !c.ok).length, mismatches = checks.filter((c) => c.keyMismatch).length;
    return {
      value: null,
      detail: `Checking answers with code ✓ (${read.questions.length} checked, ${mismatches} answer-key mismatch${mismatches === 1 ? "" : "es"}${bad ? `, ${bad} to repair` : ""})`,
    };
  });

  // ---- Agent 2: mistakes + level design
  const design = await timed("designer", async () => {
    const d = await deps.design(read.questions, [], ctx);
    return d.ok ? { value: d.data, detail: `${d.data.questions.length} levels designed` } : { value: null, status: "error" as const, detail: d.error };
  });
  if (!design) return { ok: false, status: 422, error: NOTHING_READ };
  const designs = new Map(design.questions.map((q) => [q.id, q]));

  // ---- code builds every question
  const built = new Map<string, TQuestion>();
  const failing = new Map<string, string[]>();
  const tryBuild = (id: string) => {
    const r = reads.get(id)!, d = designs.get(id);
    if (!d) { failing.set(id, [`${id}: no design for this question`]); return; }
    const out = assemble(r, d);
    if (out.question) { built.set(id, out.question); failing.delete(id); }
    else failing.set(id, out.errors);
  };
  await timed("verify", async () => {
    for (const id of reads.keys()) tryBuild(id);
    return { value: null, detail: `${built.size} of ${reads.size} questions passed code` };
  });

  // ---- repair: send each failing question back to whichever agent owns the error (failing questions only)
  const dropped: string[] = [];
  if (failing.size) {
    await timed("repair", async () => {
      for (let round = 0; round < MAX_REPAIR_ROUNDS && failing.size; round++) {
        const toReader = [...failing].filter(([, es]) => es.some((e) => !isDesignerError(e)));
        const toDesigner = [...failing].filter(([, es]) => es.every(isDesignerError));
        const [rr, dr] = await Promise.all([
          toReader.length
            ? deps.repairRead(JSON.stringify({ title: read.title, questions: toReader.map(([id]) => reads.get(id)) }), toReader.flatMap(([, es]) => es), { ctx })
            : null,
          toDesigner.length
            ? deps.repairDesign(JSON.stringify({ questions: toDesigner.map(([id]) => designs.get(id)).filter(Boolean) }), toDesigner.flatMap(([, es]) => es), ctx)
            : null,
        ]);
        if (rr?.ok) for (const q of rr.data.questions) if (reads.has(q.id)) reads.set(q.id, q);
        if (dr?.ok) for (const q of dr.data.questions) if (reads.has(q.id)) designs.set(q.id, q);
        for (const id of [...failing.keys()]) tryBuild(id);
      }
      for (const [id, es] of failing) dropped.push(`dropped ${id}: ${es[0] ?? "failed the code checks"}`);
      return {
        value: null,
        detail: dropped.length ? `${dropped.length} question${dropped.length === 1 ? "" : "s"} dropped after repair` : "all repaired",
      };
    });
  }

  // ---- save + link the class
  const questions = [...reads.keys()].map((id) => built.get(id)).filter((q): q is TQuestion => !!q);
  if (questions.length === 0) return { ok: false, status: 422, error: NOTHING_READ };

  const worksheet = await timed("save", async () => {
    const mis = new Map<string, M>();
    for (const q of questions) for (const m of designs.get(q.id)?.misconceptions ?? []) if (!mis.has(m.id)) mis.set(m.id, m);
    const ws = await saveWorksheet(
      { id: newId("ws"), title: read.title, source: "upload", imageHash, questions, misconceptions: [...mis.values()] },
      dropped,
    );
    const linked = await db.update("classes", { _id: input.classCode }, { $set: { worksheetId: ws.id } });
    // Critic (Agent 3) is CUT. Classmates (Agent 5, P2-20) will be started here in the background if Merge 2 is green.
    return { value: ws, detail: linked ? `saved, class ${input.classCode} linked` : `saved (class ${input.classCode} not found)` };
  });

  return { ok: true, worksheet, dropped };
}
