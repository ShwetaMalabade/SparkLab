// src/lib/client/types.ts — shared client types (docs/build/CONTRACTS.md §2).
// Owned by Dharm. Frozen after P2-04: later changes must be additive and logged in PROGRESS-P2.md.
import type { TAttempt, TQuestion } from "@/lib/schema";

export type { Mode } from "./mode";

export type IngestStep = { step: string; status: "running" | "done" | "error"; ms?: number; detail?: string };

export type NextStep = {
  action: "play" | "finish";
  question?: TQuestion;
  feedback: string | null;
  reason: string;
  source: "coach" | "fallback";
  ms?: number;
  rejected?: string[];
};

export type AttemptInput = Omit<TAttempt, "simulated">;
