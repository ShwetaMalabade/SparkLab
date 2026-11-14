// Review (docs/plan/07 §2 screen 3): one card per question. Flags in plain words prove "AI writes, code checks".
// Cache Components: the dynamic [wsId] is runtime data, so it's read inside <Suspense>.
import { Suspense } from "react";
import { Review } from "./Review";

export default function ReviewPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-4xl px-6 py-16 text-muted">Loading the worksheet…</main>}>
      <Review />
    </Suspense>
  );
}
