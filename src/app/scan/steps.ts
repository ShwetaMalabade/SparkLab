// Labels for the pipeline step ids streamed by /api/ingest (src/lib/ingest.ts) and the mock.
export const STEP_LABELS: Record<string, { label: string; kind: "code" | "ai" | "plain" }> = {
  photo: { label: "Preparing photo", kind: "plain" },
  reader: { label: "Agent 1 reading & solving", kind: "ai" },
  check: { label: "Code checking answers", kind: "code" },
  designer: { label: "Agent 2 modeling mistakes", kind: "ai" },
  verify: { label: "Code computing wrong answers", kind: "code" },
  repair: { label: "Repairing what code rejected", kind: "ai" },
  save: { label: "Ready", kind: "plain" },
};
export const MIN_STEP_MS = 600; // each step stays on screen at least this long
