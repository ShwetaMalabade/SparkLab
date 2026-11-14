// src/lib/client/api.ts — the ONLY way Shweta's game talks to Dharm's backend (docs/build/CONTRACTS.md §2).
// Owned by Dharm. Signatures are frozen after P2-04; later changes must be additive and logged in PROGRESS-P2.md.
//
// Two paths, picked by getMode():
//   "mock"  (default until Merge 1): everything in the browser. getWorksheet → the fixture for any id,
//           createClass → random code, createSession → "s_mock", postAttempt → localStorage, nextStep → fallbackNext.
//   "live" / "offline": the real API routes (offline = same routes on the local server, memory DB + replay).
// Go live with NEXT_PUBLIC_MOCK=0. postAttempt and nextStep NEVER throw on either path.
import { Worksheet, type TWorksheet } from "@/lib/schema";
import { fallbackNext, type Session } from "@/lib/agents/director";
import fixtureJson from "../../../data/fixtures/worksheet.json";
import { newClassCode } from "@/lib/classCode";
import { getMode } from "./mode";
import { getTimeBudget } from "./prefs";
import type { AttemptInput, IngestStep, NextStep } from "./types";

export { getMode };
export type { AttemptInput, IngestStep, NextStep, Mode } from "./types";

const K = {
  classCode: "ha:classCode", // sessionStorage (set by Landing)
  attempts: "ha:attempts", // localStorage: AttemptInput & { attemptId } (mock store + the results stub)
  sessions: "ha:sessions", // localStorage: { [sessionId]: LocalSession }
  queue: "ha:attemptQueue", // localStorage: live attempts waiting to be re-sent
} as const;

const COACH_TIMEOUT_MS = 6000; // the game never waits longer than this for the coach
const RETRY_EVERY_MS = 5000;

type StoredAttempt = AttemptInput & { attemptId: string };
type LocalSession = { worksheetId: string; classCode: string; nickname: string; timeBudgetSec: number; startedAt: number; endedAt: number | null };

const isMock = () => getMode() === "mock";

// ---------- storage helpers (never throw: private mode / SSR / quota) ----------
function readJSON<T>(store: "local" | "session", key: string, fallback: T): T {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(store: "local" | "session", key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the demo must keep going */
  }
}

let fixtureCache: TWorksheet | null = null;
function fixture(): TWorksheet {
  return (fixtureCache ??= Worksheet.parse(fixtureJson));
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Worksheets this tab has loaded, so nextStep can fall back without the network. */
const worksheetCache = new Map<string, TWorksheet>();

function rememberSession(sessionId: string, s: LocalSession) {
  const all = readJSON<Record<string, LocalSession>>("local", K.sessions, {});
  all[sessionId] = s;
  writeJSON("local", K.sessions, all);
}
function rememberAttempt(a: AttemptInput, attemptId: string) {
  const all = readJSON<StoredAttempt[]>("local", K.attempts, []);
  all.push({ ...a, attemptId });
  writeJSON("local", K.attempts, all);
}

async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      ...init,
      signal: init.signal ?? ctl.signal,
      cache: "no-store",
      headers: init.body && typeof init.body === "string" ? { "content-type": "application/json", ...init.headers } : init.headers,
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}
class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

// ---------- contract ----------

/** The class code Landing stored for this tab, or null. */
export function getClassCode(): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(K.classCode);
  } catch {
    return null;
  }
}

export async function createClass(o?: { timeBudgetSec?: number; worksheetId?: string }): Promise<{ code: string }> {
  const code = isMock()
    ? newClassCode()
    : (await api<{ code: string }>("/api/class", { method: "POST", body: JSON.stringify(o ?? {}) })).code;
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(K.classCode, code);
  } catch {
    /* ignore */
  }
  return { code };
}

/** Scan a worksheet. Live: streams the real pipeline steps from /api/ingest (NDJSON). Throws with a readable message on failure. */
export async function ingest(file: Blob, classCode: string, onStep: (s: IngestStep) => void): Promise<TWorksheet> {
  if (isMock()) {
    // Same step ids as the real pipeline (src/lib/ingest.ts), so the Scan page renders both identically.
    const steps: [string, number][] = [
      ["photo", 300],
      ["reader", 1200],
      ["check", 400],
      ["designer", 900],
      ["verify", 400],
      ["save", 300],
    ];
    for (const [step, delay] of steps) {
      onStep({ step, status: "running" });
      const t0 = Date.now();
      await sleep(delay);
      onStep({ step, status: "done", ms: Date.now() - t0 });
    }
    return fixture();
  }

  const form = new FormData();
  form.append("file", file, "worksheet.jpg");
  form.append("classCode", classCode);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 70_000); // server cap is 60 s
  try {
    const res = await fetch("/api/ingest", { method: "POST", body: form, signal: ctl.signal });
    if (!res.ok || !res.body) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Upload failed (${res.status})`);
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const msg = JSON.parse(line) as IngestStep & { worksheet?: unknown; error?: string };
        if (msg.error) throw new Error(msg.error);
        if (msg.worksheet) {
          const ws = Worksheet.parse(msg.worksheet);
          worksheetCache.set(ws.id, ws);
          return ws;
        }
        if (msg.step) onStep({ step: msg.step, status: msg.status, ms: msg.ms, detail: msg.detail });
      }
      if (done) break;
    }
    throw new Error("The scan ended without a worksheet. Try again, or use the last scan.");
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The scan took too long. Try a sharper photo, or use the last scan.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Mock: the fixture for ANY id. Live: GET /api/worksheet/[id] ("fixture" still returns the dev fixture). */
export async function getWorksheet(wsId: string): Promise<TWorksheet> {
  if (isMock() || wsId === "fixture") {
    const ws = fixture();
    worksheetCache.set(wsId, ws);
    return ws;
  }
  const ws = Worksheet.parse(await api<unknown>(`/api/worksheet/${encodeURIComponent(wsId)}`));
  worksheetCache.set(wsId, ws);
  worksheetCache.set(ws.id, ws);
  return ws;
}

export async function createSession(s: {
  classCode: string;
  worksheetId: string;
  nickname: string;
  mode?: "seated";
  timeBudgetSec?: number;
}): Promise<{ sessionId: string; timeBudgetSec: number }> {
  const timeBudgetSec = s.timeBudgetSec ?? getTimeBudget(); // the budget picked on Landing
  let out: { sessionId: string; timeBudgetSec: number };
  if (isMock()) {
    out = { sessionId: "s_mock", timeBudgetSec };
    // A fresh mock session starts with a clean slate of attempts.
    writeJSON("local", K.attempts, readJSON<StoredAttempt[]>("local", K.attempts, []).filter((a) => a.sessionId !== out.sessionId));
  } else {
    out = await api("/api/session", { method: "POST", body: JSON.stringify({ ...s, mode: s.mode ?? "seated", timeBudgetSec }) });
  }
  rememberSession(out.sessionId, { worksheetId: s.worksheetId, classCode: s.classCode, nickname: s.nickname, timeBudgetSec: out.timeBudgetSec, startedAt: Date.now(), endedAt: null });
  return out;
}

/** NEVER throws. Live: POST /api/attempt; if the network fails, queue it in localStorage and retry every 5 s. */
export async function postAttempt(a: AttemptInput): Promise<{ attemptId: string | null }> {
  try {
    if (isMock()) {
      const attemptId = `a_mock_${readJSON<StoredAttempt[]>("local", K.attempts, []).length + 1}`;
      rememberAttempt(a, attemptId);
      return { attemptId };
    }
    rememberAttempt(a, "pending"); // local record: the results stub + the offline coach fallback
    try {
      const r = await api<{ attemptId: string }>("/api/attempt", { method: "POST", body: JSON.stringify(a) }, 5000);
      return { attemptId: r.attemptId };
    } catch (e) {
      // 4xx = the server will never accept it (bad data / unknown session): don't retry forever.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return { attemptId: null };
      writeJSON("local", K.queue, [...readJSON<AttemptInput[]>("local", K.queue, []), a]);
      scheduleFlush();
      return { attemptId: null };
    }
  } catch {
    return { attemptId: null };
  }
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush() {
  if (flushTimer || typeof window === "undefined") return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const queue = readJSON<AttemptInput[]>("local", K.queue, []);
    const left: AttemptInput[] = [];
    for (const a of queue) {
      try {
        await api("/api/attempt", { method: "POST", body: JSON.stringify(a) }, 5000);
      } catch (e) {
        const permanent = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
        if (!permanent) left.push(a);
      }
    }
    writeJSON("local", K.queue, left);
    if (left.length) scheduleFlush();
  }, RETRY_EVERY_MS);
}
// A tab that closed with unsent attempts sends them when the app opens again.
if (typeof window !== "undefined" && readJSON<unknown[]>("local", K.queue, []).length) scheduleFlush();

/** NEVER throws. Live: the AI coach via /api/next, aborted at 6 s → the code fallback computed right here. */
export async function nextStep(r: { sessionId: string; attemptId?: string | null; attempt?: AttemptInput }): Promise<NextStep> {
  const t0 = Date.now();
  if (!isMock()) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), COACH_TIMEOUT_MS);
    try {
      const step = await api<NextStep>("/api/next", { method: "POST", body: JSON.stringify(r), signal: ctl.signal }, COACH_TIMEOUT_MS + 500);
      if (step && (step.action === "play" || step.action === "finish")) return step;
      return localFallback(r, t0, "coach sent something unexpected");
    } catch (e) {
      return localFallback(r, t0, (e as Error).name === "AbortError" ? "coach took longer than 6 s" : `coach unreachable (${(e as Error).message})`);
    } finally {
      clearTimeout(timer);
    }
  }
  return localFallback(r, t0, "mock mode");
}

/** The code fallback, in the browser: next unplayed worksheet question, else finish. */
function localFallback(r: { sessionId: string; attempt?: AttemptInput }, t0: number, why: string): NextStep {
  try {
    const stored = readJSON<Record<string, LocalSession>>("local", K.sessions, {})[r.sessionId];
    const ws = isMock() ? fixture() : stored && worksheetCache.get(stored.worksheetId);
    if (!ws) return { action: "finish", feedback: null, reason: `fallback: ${why}; worksheet not loaded`, source: "fallback", ms: Date.now() - t0 };
    // Attempts are the source of truth for what's been played; include the inline one if its POST is still queued.
    const played = readJSON<StoredAttempt[]>("local", K.attempts, [])
      .filter((a) => a.sessionId === r.sessionId)
      .map((a) => a.questionId);
    if (r.attempt && !played.includes(r.attempt.questionId)) played.push(r.attempt.questionId);
    const session: Session = { id: r.sessionId, played, variants: [], startedAt: stored?.startedAt ?? t0, timeBudgetSec: stored?.timeBudgetSec ?? 600 };
    return { ...fallbackNext(ws, session, why), ms: Date.now() - t0 };
  } catch (e) {
    return { action: "finish", feedback: null, reason: `fallback: ${(e as Error).message}`, source: "fallback", ms: Date.now() - t0 };
  }
}

export async function endSession(sessionId: string): Promise<void> {
  const all = readJSON<Record<string, LocalSession>>("local", K.sessions, {});
  if (all[sessionId]) {
    all[sessionId].endedAt = Date.now();
    writeJSON("local", K.sessions, all);
  }
  if (!isMock()) await api(`/api/session/${encodeURIComponent(sessionId)}/end`, { method: "POST" }).catch(() => undefined);
}
