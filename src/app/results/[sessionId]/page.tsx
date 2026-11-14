// Results (docs/plan/07 §2 screen 6). Shweta's game navigates here at the end of a session.
// Cache Components: the dynamic [sessionId] is runtime data, so it is read inside <Suspense>.
import { Suspense } from "react";
import { ResultsView } from "./ResultsView";

export default function ResultsPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-6 py-20 text-muted">Counting your answers…</main>}>
      <ResultsView />
    </Suspense>
  );
}
