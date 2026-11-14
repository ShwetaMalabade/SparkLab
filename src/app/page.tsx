// Placeholder until P2-11 (Landing). Shows the design tokens so P1 can match them.
const SWATCHES = [
  ["cyan", "Physics", "bg-cyan"],
  ["magenta", "Chemistry", "bg-magenta"],
  ["violet", "AI / coach", "bg-violet"],
  ["lime", "✓ Correct", "bg-lime"],
  ["coral", "✗ Wrong", "bg-coral"],
  ["amber", "⚠️ Hazard", "bg-amber"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-20">
      <h1 className="text-5xl font-bold tracking-tight">
        Homework <span className="text-cyan">Arena</span>
      </h1>
      <p className="text-lg text-muted">Snap a worksheet. Play it with your hands. AI writes, code checks.</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {SWATCHES.map(([name, use, bg]) => (
          <li key={name} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
            <span className={`h-8 w-8 rounded-lg ${bg}`} />
            <span className="text-sm">
              <span className="block font-semibold">{name}</span>
              <span className="text-muted">{use}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
