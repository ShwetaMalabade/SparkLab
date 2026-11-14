// Stub until P2-18. Shweta's game navigates here at the end of a session.
// Cache Components: the dynamic [sessionId] is runtime data, so it is read inside <Suspense>.
import Link from "next/link";
import { Suspense } from "react";
import { MockScore } from "./MockScore";

export default function ResultsPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-20 text-center">
      <h1 className="text-4xl font-bold">Results coming soon</h1>
      <Suspense fallback={<p className="text-muted">Loading your score…</p>}>
        <MockScore />
      </Suspense>
      <Link href="/" className="mx-auto rounded-xl border border-line bg-panel px-5 py-3 font-semibold hover:border-cyan">
        Play again
      </Link>
    </main>
  );
}
