// scripts/test-ai.ts — smoke test for the AI wrapper (docs/plan/03 §3).
// Run: npx tsx --env-file=.env.local scripts/test-ai.ts
// Calls each configured model once through askJSON and prints what came back.
import { z } from "zod";
import { askJSON, type Agent } from "../src/lib/ai";

const provider = process.env.AI_PROVIDER ?? "gemini";
const keyVar = provider === "bedrock" ? "AWS_ACCESS_KEY_ID" : "GEMINI_API_KEY";
const models = provider === "bedrock"
  ? { vision: process.env.BEDROCK_MODEL_VISION, fast: process.env.BEDROCK_MODEL_FAST }
  : { vision: process.env.GEMINI_MODEL_VISION, fast: process.env.GEMINI_MODEL_FAST };

const missing = [keyVar, ...Object.entries(models).filter(([, v]) => !v).map(([k]) => `${provider.toUpperCase()}_MODEL_${k.toUpperCase()}`)]
  .filter((k) => k === keyVar ? !process.env[keyVar] : true);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit(1);
}

async function main() {
  const Ok = z.object({ ok: z.boolean() });
  // "insight" uses the fast model, "reader" the vision model (text-only here; a vision model answers text too).
  const checks: [Agent, string][] = [["insight", `fast (${models.fast})`], ["reader", `vision (${models.vision})`]];
  let failed = false;
  for (const [agent, label] of checks) {
    const r = await askJSON(agent, Ok, 'Return exactly this JSON and nothing else: {"ok":true}');
    if (r.ok) console.log(`✓ ${label}: ${JSON.stringify(r.data)} in ${r.ms} ms`);
    else { failed = true; console.error(`✗ ${label}: ${r.error}${r.issues.length ? " " + r.issues.join("; ") : ""}${r.raw ? `\n  raw: ${r.raw.slice(0, 300)}` : ""}`); }
  }
  process.exit(failed ? 1 : 0);
}

main();
