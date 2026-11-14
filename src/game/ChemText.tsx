// src/game/ChemText.tsx: formulas and equations with subscripts and CPK-coloured element symbols (docs/plan/05 §3–§4).
// Colour is never the only signal: the symbol text is always shown.

/** CPK colours (05 §4), lightened where the spec's colour would vanish on navy (C, Pb). */
export const CPK: Record<string, string> = {
  H: "#F8FAFC", O: "#F87171", C: "#9CA3AF", N: "#60A5FA", Cl: "#4ADE80", Na: "#C084FC", S: "#FDE047",
  Fe: "#FB923C", Cu: "#D97706", Ag: "#CBD5E1", Ca: "#86EFAC", Mg: "#2DD4BF", K: "#A78BFA", Pb: "#94A3B8",
  I: "#A855F7", Ba: "#A3E635",
};
export const cpk = (el: string) => CPK[el] ?? "#9CA3AF";

type Tok = { kind: "el" | "sub" | "coef" | "text"; s: string };

/** Tokenises one formula or a whole equation. Digits right after an element or ")" are subscripts. */
export function tokenize(src: string): Tok[] {
  const s = src.replace(/<?-+>|=>|⟶/g, "→");
  const out: Tok[] = [];
  let i = 0;
  let termStart = true;
  while (i < s.length) {
    const ch = s[i];
    const el = /^[A-Z][a-z]?/.exec(s.slice(i));
    if (el) {
      out.push({ kind: "el", s: el[0] });
      i += el[0].length;
      termStart = false;
      continue;
    }
    const num = /^\d+/.exec(s.slice(i));
    if (num) {
      out.push({ kind: termStart ? "coef" : "sub", s: num[0] });
      i += num[0].length;
      continue;
    }
    if (ch === " " || ch === "+" || ch === "→") termStart = true;
    else if (ch !== "(" && ch !== ")") termStart = false;
    out.push({ kind: "text", s: ch === "→" ? " → " : ch });
    i++;
  }
  return out;
}

export function ChemText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {tokenize(text).map((t, i) =>
        t.kind === "el" ? (
          <span key={i} style={{ color: cpk(t.s) }} className="font-semibold">{t.s}</span>
        ) : t.kind === "sub" ? (
          <sub key={i} className="text-[0.7em]">{t.s}</sub>
        ) : (
          <span key={i}>{t.s}</span>
        ),
      )}
    </span>
  );
}
