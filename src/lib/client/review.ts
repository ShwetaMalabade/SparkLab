// src/lib/client/review.ts — the Review screen's calls (Dharm's page only; not part of the P1 contract).
// Mock mode reviews the fixture read-only (it isn't in any database); live/offline use /api/worksheet/[id].
import { Worksheet, type TWorksheet } from "@/lib/schema";
import { getMode } from "./mode";
import { getWorksheet } from "./api";

export type ReviewData = { ws: TWorksheet; dropped: string[]; editable: boolean };
export type EditResult = { ok: true; data: ReviewData } | { ok: false; error: string; errors?: string[] };

const parse = (j: unknown): ReviewData => ({
  ws: Worksheet.parse(j),
  dropped: Array.isArray((j as { dropped?: unknown }).dropped) ? ((j as { dropped: string[] }).dropped) : [],
  editable: true,
});

export async function loadForReview(wsId: string): Promise<ReviewData> {
  if (getMode() === "mock" || wsId === "fixture") return { ws: await getWorksheet(wsId), dropped: [], editable: false };
  const r = await fetch(`/api/worksheet/${encodeURIComponent(wsId)}`, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Couldn't load the worksheet (${r.status}).`);
  return parse(j);
}

async function patch(wsId: string, body: Record<string, unknown>): Promise<EditResult> {
  try {
    const r = await fetch(`/api/worksheet/${encodeURIComponent(wsId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json().catch(() => ({}))) as { error?: string; errors?: string[] };
    return r.ok ? { ok: true, data: parse(j) } : { ok: false, error: j.error ?? `Edit failed (${r.status}).`, errors: j.errors };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check the connection." };
  }
}

/** Code re-checks the question with the new numbers/text (no AI). Nothing is saved if the checks fail. */
export const editQuestion = (wsId: string, questionId: string, change: { prompt?: string; given?: Record<string, number> }) =>
  patch(wsId, { questionId, ...change });

export const removeQuestion = (wsId: string, questionId: string) => patch(wsId, { questionId, remove: true });
