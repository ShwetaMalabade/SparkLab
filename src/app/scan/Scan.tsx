"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClass, getClassCode, ingest, type IngestStep } from "@/lib/client/api";
import { getTimeBudget, setLastWorksheetId } from "@/lib/client/prefs";
import { resizeImage } from "@/lib/resizeImage";
import { MIN_STEP_MS, STEP_LABELS } from "./steps";
import { WebcamSnapshot } from "./WebcamSnapshot";

type Row = IngestStep & { shownAt: number };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Scan() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"pick" | "working" | "error">("pick");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const run = useCallback(
    async (file: Blob) => {
      setPhase("working");
      setError(null);
      setRows([]);
      setPreview(URL.createObjectURL(file));

      // Steps can arrive faster than a person can read them. Show them in order, and keep each
      // "running" step visible for at least MIN_STEP_MS before the next change replaces it.
      let chain = Promise.resolve();
      let lastRunningShownAt = 0;
      const show = (s: IngestStep) => {
        chain = chain.then(async () => {
          const wait = lastRunningShownAt + MIN_STEP_MS - Date.now();
          if (wait > 0) await sleep(wait);
          const shownAt = Date.now();
          if (s.status === "running") lastRunningShownAt = shownAt;
          setRows((prev) => {
            const i = prev.findIndex((r) => r.step === s.step);
            const row = { ...s, shownAt };
            return i < 0 ? [...prev, row] : prev.map((r, j) => (j === i ? row : r));
          });
        });
      };

      try {
        const jpeg = await resizeImage(file);
        const code = getClassCode() ?? (await createClass({ timeBudgetSec: getTimeBudget() })).code;
        const ws = await ingest(jpeg, code, show);
        await chain;
        await sleep(MIN_STEP_MS);
        setLastWorksheetId(ws.id);
        router.push(`/review/${ws.id}`);
      } catch (e) {
        await chain;
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
        setPhase("error");
      }
    },
    [router],
  );

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void run(f);
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-4xl font-bold">Scan a worksheet</h1>
        <p className="mt-2 text-muted">A clear photo of one physics or chemistry page. AI reads and solves it; code checks every number.</p>
      </header>

      {phase === "pick" && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInput.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-8 text-center transition ${
              dragging ? "border-cyan bg-cyan/10" : "border-line bg-panel hover:border-muted"
            }`}
          >
            <span className="text-4xl" aria-hidden>
              🖼️
            </span>
            <span className="text-lg font-semibold">Drop a photo here, or click to choose one</span>
            <span className="text-sm text-muted">JPG or PNG. Big photos are shrunk on this laptop before upload.</span>
          </div>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => onFiles(e.target.files)} />
          <input ref={phoneInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setCamera(true)} className="rounded-xl bg-cyan px-5 py-3 font-bold text-navy hover:brightness-110">
              📷 Take photo with webcam
            </button>
            <button
              type="button"
              onClick={() => phoneInput.current?.click()}
              className="rounded-xl border border-line bg-panel px-5 py-3 font-semibold hover:border-cyan"
            >
              📱 Upload from phone camera
            </button>
          </div>
        </>
      )}

      {phase !== "pick" && (
        <section className="grid gap-6 md:grid-cols-[200px_1fr]">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob: preview
            <img src={preview} alt="Your worksheet photo" className="max-h-64 w-full rounded-2xl border border-line object-contain" />
          )}
          <ol className="flex flex-col gap-2" aria-live="polite">
            {rows.map((r) => {
              const meta = STEP_LABELS[r.step] ?? { label: r.step, kind: "plain" as const };
              const icon = r.status === "running" ? "⏳" : r.status === "error" ? "✗" : "✓";
              const tone =
                r.status === "error"
                  ? "text-coral"
                  : r.status === "running"
                    ? "text-text"
                    : meta.kind === "code"
                      ? "text-lime"
                      : meta.kind === "ai"
                        ? "text-violet"
                        : "text-text";
              return (
                <li key={r.step} className="flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3">
                  <span className={`w-5 text-center ${tone} ${r.status === "running" ? "animate-pulse" : ""}`}>{icon}</span>
                  <div className="flex-1">
                    <p className={`font-semibold ${tone}`}>
                      {meta.kind === "ai" && <span aria-label="AI">🧠 </span>}
                      {meta.label}
                    </p>
                    {r.detail && <p className="text-sm text-muted">{r.detail}</p>}
                  </div>
                  {r.ms !== undefined && <span className="tabular-nums text-sm text-muted">{(r.ms / 1000).toFixed(1)} s</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {phase === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-coral/50 bg-coral/10 p-5">
          <p className="text-coral">✗ {error}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setPhase("pick")} className="rounded-xl bg-cyan px-5 py-2 font-bold text-navy">
              Try another photo
            </button>
            <button type="button" onClick={() => router.push("/")} className="rounded-xl border border-line bg-panel px-5 py-2 font-semibold">
              ↺ Use last scan
            </button>
          </div>
        </div>
      )}

      {camera && (
        <WebcamSnapshot
          onClose={() => setCamera(false)}
          onCapture={(b) => {
            setCamera(false);
            void run(b);
          }}
        />
      )}
    </main>
  );
}
