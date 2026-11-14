// src/lib/client/results.ts — the Results screen's data (Dharm's page only; not part of the P1 contract).
// Live/offline: GET /api/session/[id]/results (includes the coach's questions + note). Mock, or the server
// unreachable: the same summary from this device's own record (localStorage, written by api.ts).
import { summarizeResults, type ResultAttempt, type Results } from "@/lib/results";
import { getWorksheet } from "./api";
import { getMode } from "./mode";

export type { Results } from "@/lib/results";

type LocalAttempt = ResultAttempt & { sessionId: string; worksheetId: string };
type LocalSession = { worksheetId: string; nickname: string; startedAt: number; endedAt: number | null };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function fromDevice(sessionId: string): Promise<Results | null> {
  const attempts = read<LocalAttempt[]>("ha:attempts", []).filter((a) => a.sessionId === sessionId);
  const s = read<Record<string, LocalSession>>("ha:sessions", {})[sessionId];
  const wsId = s?.worksheetId ?? attempts[0]?.worksheetId;
  if (!wsId) return null;
  const ws = await getWorksheet(wsId);
  return summarizeResults(ws, attempts, { playId: wsId, nickname: s?.nickname, startedAt: s?.startedAt, endedAt: s?.endedAt, source: "device" });
}

/** Never throws: null = nothing recorded for this session anywhere we can reach. */
export async function loadResults(sessionId: string): Promise<Results | null> {
  if (getMode() !== "mock") {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(`/api/session/${encodeURIComponent(sessionId)}/results`, { cache: "no-store", signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) return (await r.json()) as Results;
    } catch {
      /* fall through to this device's record */
    }
  }
  try {
    return await fromDevice(sessionId);
  } catch {
    return null;
  }
}
