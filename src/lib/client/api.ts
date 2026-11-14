// src/lib/client/api.ts — the ONLY way Shweta's game talks to Dharm's backend (docs/build/CONTRACTS.md §2).
// Owned by Dharm. Signatures are frozen after P2-04; later changes must be additive and logged in PROGRESS-P2.md.
//
// Right now every function runs the MOCK behaviour (getMode() === "mock" until Merge 1):
//   getWorksheet → data/fixtures/worksheet.json for any id · createClass → random 4-char code
//   createSession → "s_mock" · postAttempt → localStorage · nextStep → fallbackNext (next unplayed, else finish)
// Real calls replace the mocks before Merge 1 (all but nextStep), and nextStep in P2-13.
import { Worksheet, type TWorksheet } from "@/lib/schema";
import { fallbackNext, type Session } from "@/lib/agents/director";
import fixtureJson from "../../../data/fixtures/worksheet.json";
import { newClassCode } from "@/lib/classCode";
import { getMode } from "./mode";
import type { AttemptInput, IngestStep, NextStep } from "./types";

export { getMode };
export type { AttemptInput, IngestStep, NextStep, Mode } from "./types";

const K = {
  classCode: "ha:classCode", // sessionStorage (set by Landing)
  attempts: "ha:attempts", // localStorage: AttemptInput & { attemptId }
  sessions: "ha:sessions", // localStorage: { [sessionId]: MockSession }
} as const;

type StoredAttempt = AttemptInput & { attemptId: string };
type MockSession = { worksheetId: string; classCode: string; nickname: string; timeBudgetSec: number; startedAt: number; endedAt: number | null };

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
  void o; // used by the real POST /api/class
  const code = newClassCode();
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(K.classCode, code);
  } catch {
    /* ignore */
  }
  return { code };
}

/** Mock: plays the scan steps with short delays, then returns the fixture. Real version streams NDJSON from /api/ingest. */
export async function ingest(file: Blob, classCode: string, onStep: (s: IngestStep) => void): Promise<TWorksheet> {
  void file;
  void classCode;
  const steps: [string, number][] = [
    ["Reading the page", 900],
    ["Checking every answer with code", 500],
    ["Modeling likely mistakes", 800],
    ["Building the 3D levels", 500],
  ];
  for (const [step, delay] of steps) {
    onStep({ step, status: "running" });
    const t0 = Date.now();
    await sleep(delay);
    onStep({ step, status: "done", ms: Date.now() - t0 });
  }
  return fixture();
}

/** Mock: the fixture for ANY id (including "fixture"). */
export async function getWorksheet(wsId: string): Promise<TWorksheet> {
  void wsId;
  return fixture();
}

export async function createSession(s: {
  classCode: string;
  worksheetId: string;
  nickname: string;
  mode?: "seated";
  timeBudgetSec?: number;
}): Promise<{ sessionId: string; timeBudgetSec: number }> {
  const sessionId = "s_mock";
  const timeBudgetSec = s.timeBudgetSec ?? 600;
  const sessions = readJSON<Record<string, MockSession>>("local", K.sessions, {});
  sessions[sessionId] = { worksheetId: s.worksheetId, classCode: s.classCode, nickname: s.nickname, timeBudgetSec, startedAt: Date.now(), endedAt: null };
  writeJSON("local", K.sessions, sessions);
  // A fresh mock session starts with a clean slate of attempts.
  writeJSON("local", K.attempts, readJSON<StoredAttempt[]>("local", K.attempts, []).filter((a) => a.sessionId !== sessionId));
  return { sessionId, timeBudgetSec };
}

/** NEVER throws. Mock: appends to localStorage["ha:attempts"]. */
export async function postAttempt(a: AttemptInput): Promise<{ attemptId: string | null }> {
  try {
    const all = readJSON<StoredAttempt[]>("local", K.attempts, []);
    const attemptId = `a_mock_${all.length + 1}`;
    all.push({ ...a, attemptId });
    writeJSON("local", K.attempts, all);
    return { attemptId };
  } catch {
    return { attemptId: null };
  }
}

/** NEVER throws. Mock: the code fallback (next unplayed worksheet question, else finish). */
export async function nextStep(r: { sessionId: string; attemptId?: string | null; attempt?: AttemptInput }): Promise<NextStep> {
  const t0 = Date.now();
  try {
    const ws = fixture();
    const stored = readJSON<Record<string, MockSession>>("local", K.sessions, {})[r.sessionId];
    // Attempts are the source of truth for what's been played; include the inline one if its POST is still queued.
    const played = readJSON<StoredAttempt[]>("local", K.attempts, [])
      .filter((a) => a.sessionId === r.sessionId)
      .map((a) => a.questionId);
    if (r.attempt && !played.includes(r.attempt.questionId)) played.push(r.attempt.questionId);
    const session: Session = {
      id: r.sessionId,
      played,
      variants: [],
      startedAt: stored?.startedAt ?? t0,
      timeBudgetSec: stored?.timeBudgetSec ?? 600,
    };
    return { ...fallbackNext(ws, session, "mock mode"), ms: Date.now() - t0 };
  } catch (e) {
    return { action: "finish", feedback: null, reason: `fallback: ${(e as Error).message}`, source: "fallback", ms: Date.now() - t0 };
  }
}

export async function endSession(sessionId: string): Promise<void> {
  const sessions = readJSON<Record<string, MockSession>>("local", K.sessions, {});
  if (sessions[sessionId]) {
    sessions[sessionId].endedAt = Date.now();
    writeJSON("local", K.sessions, sessions);
  }
}
