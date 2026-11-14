// scripts/export-replay.ts — turn one real demo (played in LIVE mode) into the offline replay (docs/plan/02 §4).
// Run: npx tsx --env-file=.env.local scripts/export-replay.ts <CLASS_CODE>
// Writes:
//   data/replay/aiCalls.json  {"agent:inputHash": output}: every successful real AI call of the class (read by replay.ts)
//   data/replay/seed.json     the scanned worksheet + each coach decision with the answer it followed (read by replaySeed.ts)
import fs from "node:fs";
import path from "node:path";
import { normalizeClassCode } from "../src/lib/classCode";
import { buildReplay } from "../src/lib/replayExport";

async function main() {
  if (process.env.OFFLINE === "1") throw new Error("Run this against the live database (OFFLINE must not be 1).");
  const code = normalizeClassCode(process.argv[2] ?? "");
  if (!code) throw new Error("Usage: npx tsx --env-file=.env.local scripts/export-replay.ts <CLASS_CODE>");
  const r = await buildReplay(code);

  const dir = path.join(process.cwd(), "data/replay");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "aiCalls.json"), JSON.stringify(r.calls, null, 1) + "\n");
  fs.writeFileSync(path.join(dir, "seed.json"), JSON.stringify(r.seed, null, 1) + "\n");

  const byAgent: Record<string, number> = {};
  for (const k of Object.keys(r.calls)) byAgent[k.split(":")[0]] = (byAgent[k.split(":")[0]] ?? 0) + 1;
  const coach = r.seed.coach.map((c) => (c.questionId ? `${c.questionId}/${c.chosen}` : "first")).join(", ") || "none";
  console.log(`Exported class ${code}: "${r.worksheetTitle}" (${r.questions} questions)`);
  console.log(`  data/replay/aiCalls.json: ${Object.keys(r.calls).length} recorded outputs ${JSON.stringify(byAgent)}`);
  console.log(`  data/replay/seed.json:    ${r.seed.coach.length} coach decisions (${coach})`);
  console.log("Test with Wi-Fi off: OFFLINE=1 npm run build && OFFLINE=1 npm start, then Landing → Use last scan.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  },
);
