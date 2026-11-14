// src/lib/db.ts — TEMPORARY stub (P2-03) so ai.ts compiles. The real Mongo-backed db is P2-07 (docs/plan/02 §6.3).
export type AiCallLog = {
  agent: string; model: string; inputHash: string; ms: number; ok: boolean; error: string | null;
  outputJson: unknown; sessionId?: string | null; classCode?: string | null; reason?: string | null;
};

export const db = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async log(_entry: AiCallLog): Promise<void> {},
};
