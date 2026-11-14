# Tested code (extracted from the plan files)

These files are copied straight out of `02`, `03` and `09`. They passed 86 checks (73 original + 13 regression checks added Sat 1:45 AM) and `tsc --strict` on Sat Nov 14.

- `src/lib/schema.ts`, `chem.ts`, `verifyPhysics.ts`, `assemble.ts`, `ai.ts`, `replay.ts`
- `src/lib/agents/director.ts`
- `tests/verify.test.ts` (63), `tests/assemble.test.ts` (10), `tests/director.test.ts` (13)

Not included: `src/lib/db.ts`. Write the real one from `02 §6.3`. `ai.ts` imports `db` from it.

Run after `npm i zod@3 mathjs @google/genai @aws-sdk/client-bedrock-runtime` and `npm i -D tsx typescript @types/node`:
```bash
npx tsx tests/verify.test.ts && npx tsx tests/assemble.test.ts && npx tsx tests/director.test.ts
```
Plan rule still applies: start coding only when Dharm says go.


**Added for the 2-person plan:** `scripts/make-fixture.ts` builds `data/fixtures/worksheet.json` through the real `assemble()` (launcher, balloons, mix lab, balancer). Person 1 develops against it until Merge 1. Run: `npx tsx scripts/make-fixture.ts`.
