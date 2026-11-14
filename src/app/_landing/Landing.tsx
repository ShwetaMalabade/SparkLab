"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClass, getClassCode, getMode } from "@/lib/client/api";
import { DEFAULT_TIME_BUDGET, getLastWorksheetId, getTimeBudget, setTimeBudget, TIME_BUDGETS } from "@/lib/client/prefs";
import { ClassQr } from "./ClassQr";
import { Flask } from "./Flask";

// Browser storage is read with useSyncExternalStore: the server render sees the fallback and the
// browser sees the stored value, with no hydration mismatch and no setState inside an effect.
const noSubscribe = () => () => {};
// Offline, "replay" is the recorded scan (data/replay/seed.json), so the button works on any laptop.
const lastScan = () => getLastWorksheetId() ?? (getMode() === "mock" ? "fixture" : getMode() === "offline" ? "replay" : null);

export function Landing() {
  const router = useRouter();
  const storedCode = useSyncExternalStore(noSubscribe, getClassCode, () => null);
  const storedBudget = useSyncExternalStore(noSubscribe, getTimeBudget, () => DEFAULT_TIME_BUDGET);
  const lastWs = useSyncExternalStore(noSubscribe, lastScan, () => null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [pickedBudget, setPickedBudget] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const code = createdCode ?? storedCode;
  const budget = pickedBudget ?? storedBudget;

  useEffect(() => {
    // Keep this tab's class across reloads, so a QR the judge already scanned stays valid.
    // React dev mode runs effects twice: the ref makes sure exactly one class is created.
    if (started.current || getClassCode()) return;
    started.current = true;
    createClass({ timeBudgetSec: getTimeBudget() })
      .then((c) => setCreatedCode(c.code))
      .catch(() => setError("Couldn't create a class. Check the connection and reload."));
  }, []);

  const pickBudget = (sec: number) => {
    setPickedBudget(sec);
    setTimeBudget(sec);
  };

  const useLastScan = async () => {
    if (!lastWs) return;
    setBusy(true);
    try {
      // A class linked to the last worksheet right away: no scan, no AI calls.
      let ws = lastWs;
      // Offline, a live-mode scan id isn't in memory: open the recorded scan instead.
      const c = await createClass({ timeBudgetSec: budget, worksheetId: ws }).catch((e) => {
        if (getMode() !== "offline" || ws === "replay") throw e;
        ws = "replay";
        return createClass({ timeBudgetSec: budget, worksheetId: ws });
      });
      setCreatedCode(c.code);
      router.push(`/review/${ws}`);
    } catch {
      setError("That last scan is no longer available. Scan the worksheet again.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-6 py-16 md:grid-cols-[1.2fr_1fr]">
      <section className="flex flex-col gap-7">
        <Flask />
        <div>
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Homework <span className="text-cyan">Arena</span>
          </h1>
          <p className="mt-3 max-w-md text-lg text-muted">
            Snap a physics or chemistry worksheet. Play it as a 3D lab with your hands. <span className="text-violet">AI writes</span>,{" "}
            <span className="text-lime">code checks</span> every number.
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Time budget</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {TIME_BUDGETS.map((b) => (
              <button
                key={b.sec}
                type="button"
                role="radio"
                aria-checked={budget === b.sec}
                onClick={() => pickBudget(b.sec)}
                className={`rounded-full border px-4 py-2 font-semibold transition ${
                  budget === b.sec ? "border-cyan bg-cyan/15 text-cyan" : "border-line bg-panel text-text hover:border-muted"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/scan")}
            disabled={!code}
            className="rounded-xl bg-cyan px-6 py-3 text-lg font-bold text-navy transition hover:brightness-110 disabled:opacity-50"
          >
            📷 Scan a worksheet
          </button>
          <button
            type="button"
            onClick={useLastScan}
            disabled={!lastWs || busy}
            title={lastWs ? undefined : "No worksheet scanned on this laptop yet"}
            className="rounded-xl border border-line bg-panel px-6 py-3 text-lg font-semibold transition hover:border-cyan disabled:opacity-40"
          >
            ↺ Use last scan
          </button>
        </div>
        {error && <p className="text-coral">✗ {error}</p>}
        <p className="text-sm text-muted">🔒 Camera video never leaves your laptop. Only the worksheet photo and gesture numbers are sent.</p>
      </section>

      <ClassQr code={code} />
    </main>
  );
}
