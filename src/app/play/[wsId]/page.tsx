// /play/[wsId]: the game. Cache Components: the dynamic [wsId] is runtime data, so the client child reads it
// (useParams) inside <Suspense>. `wsId = "fixture"` works in mock mode.
import { Suspense } from "react";
import { PlayClient } from "./PlayClient";

export default function PlayPage() {
  return (
    <Suspense fallback={<main className="grid flex-1 place-items-center text-muted">Loading the lab…</main>}>
      <PlayClient />
    </Suspense>
  );
}
