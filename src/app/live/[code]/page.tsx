// Live Teacher View (docs/plan/06 §2–3): the judge's / teacher's phone. No login, no app.
// Cache Components: the dynamic [code] is runtime data, so it's read inside <Suspense>.
import { Suspense } from "react";
import { Live } from "./Live";

export default function LivePage() {
  return (
    <Suspense fallback={<main className="px-4 pt-14 text-muted">Connecting…</main>}>
      <Live />
    </Suspense>
  );
}
