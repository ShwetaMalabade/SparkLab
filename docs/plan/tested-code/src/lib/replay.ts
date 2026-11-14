// src/lib/replay.ts — offline mode: recorded real outputs, keyed by agent + input hash
import fs from "node:fs"; import path from "node:path";
let cache: Record<string, unknown> | null = null;
export function replayLookup(agent: string, inputHash: string): unknown | null {
  if (!cache) { try { cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/replay/aiCalls.json"), "utf8")); } catch { cache = {}; } }
  return (cache as Record<string, unknown>)[`${agent}:${inputHash}`] ?? null;
}
