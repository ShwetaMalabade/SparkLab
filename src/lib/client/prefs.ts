// src/lib/client/prefs.ts — small per-tab / per-laptop choices the pages share. Never throws.
// Not part of the frozen api.ts contract; api.ts reads the time budget from here.
export const TIME_BUDGETS = [
  { label: "2-min tour", sec: 120 },
  { label: "10 min", sec: 600 },
  { label: "Full worksheet", sec: 3600 },
] as const;
export const DEFAULT_TIME_BUDGET = 120; // the demo script uses the 2-min tour

const KEYS = { timeBudget: "ha:timeBudgetSec", lastWorksheet: "ha:lastWorksheetId" } as const;

function read(store: "local" | "session", key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return (store === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(store: "local" | "session", key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    (store === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* blocked storage: keep going */
  }
}

/** Chosen on Landing, per tab. */
export function getTimeBudget(): number {
  const n = Number(read("session", KEYS.timeBudget));
  return TIME_BUDGETS.some((b) => b.sec === n) ? n : DEFAULT_TIME_BUDGET;
}
export const setTimeBudget = (sec: number) => write("session", KEYS.timeBudget, String(sec));

/** The last worksheet scanned on this laptop, for "Use last scan". */
export const getLastWorksheetId = () => read("local", KEYS.lastWorksheet);
export const setLastWorksheetId = (id: string) => write("local", KEYS.lastWorksheet, id);
