import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Pre-tested code copied verbatim from docs/plan/tested-code (86/86, tsc --strict).
  // Its `any`s are internal only (catch vars, mathjs traversal, SDK parts) — none in
  // exported signatures (RULES §6). Kept identical to the reference so it stays diffable.
  {
    files: [
      "src/lib/ai.ts",
      "src/lib/assemble.ts",
      "src/lib/verifyPhysics.ts",
      "scripts/make-fixture.ts",
      "tests/verify.test.ts",
      "tests/assemble.test.ts",
      "tests/director.test.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plan docs + reference code (copied into src/ by P2-03)
    "docs/**",
  ]),
]);

export default eslintConfig;
