// src/lib/ions.ts — the Mystery Sample lab: what each classroom test shows for each compound, decided by code.
// Pure: safe on the server and in the browser. The AI only picks the compound; every observation and color comes from here.
import { normalizeChem } from "./chem";

export type TestId = "flame" | "naoh" | "agno3" | "bacl2" | "hcl";
export type Effect = "flame" | "precipitate" | "bubbles" | "none";
export type Observation = { test: TestId; label: string; effect: Effect; color: string | null; text: string };

export const TESTS: Record<TestId, { label: string; detail: string }> = {
  flame: { label: "Flame test", detail: "Dip the wire loop in the sample and hold it in the Bunsen flame" },
  naoh: { label: "Sodium hydroxide", detail: "Add a few drops of NaOH solution" },
  agno3: { label: "Silver nitrate", detail: "Add dilute nitric acid, then a few drops of AgNO₃" },
  bacl2: { label: "Barium chloride", detail: "Add dilute hydrochloric acid, then a few drops of BaCl₂" },
  hcl: { label: "Dilute acid", detail: "Add dilute hydrochloric acid" },
};

type Cation = { id: string; name: string; flame: { color: string; text: string } | null; naoh: { color: string; text: string } | null };
type Anion = { id: string; name: string; agno3: { color: string; text: string } | null; bacl2: { color: string; text: string } | null; fizz: boolean };

const CATIONS: Record<string, Cation> = {
  Li: { id: "Li", name: "lithium", flame: { color: "#DC143C", text: "Crimson flame" }, naoh: null },
  Na: { id: "Na", name: "sodium", flame: { color: "#FFA51F", text: "Yellow-orange flame" }, naoh: null },
  K: { id: "K", name: "potassium", flame: { color: "#B57EDC", text: "Lilac flame" }, naoh: null },
  Ca: { id: "Ca", name: "calcium", flame: { color: "#FF5A1F", text: "Orange-red flame" }, naoh: { color: "#F5F5F5", text: "White precipitate" } },
  Cu: { id: "Cu", name: "copper(II)", flame: { color: "#1FBFA0", text: "Blue-green flame" }, naoh: { color: "#2F7FE0", text: "Blue precipitate" } },
  Fe2: { id: "Fe2", name: "iron(II)", flame: null, naoh: { color: "#5A7A3A", text: "Green precipitate" } },
  Fe3: { id: "Fe3", name: "iron(III)", flame: null, naoh: { color: "#9A4A1A", text: "Orange-brown precipitate" } },
};
const ANIONS: Record<string, Anion> = {
  Cl: { id: "Cl", name: "chloride", agno3: { color: "#F5F5F5", text: "White precipitate" }, bacl2: null, fizz: false },
  Br: { id: "Br", name: "bromide", agno3: { color: "#F3E6B5", text: "Cream precipitate" }, bacl2: null, fizz: false },
  I: { id: "I", name: "iodide", agno3: { color: "#F5D63D", text: "Yellow precipitate" }, bacl2: null, fizz: false },
  SO4: { id: "SO4", name: "sulfate", agno3: null, bacl2: { color: "#F5F5F5", text: "White precipitate" }, fizz: false },
  CO3: { id: "CO3", name: "carbonate", agno3: null, bacl2: null, fizz: true },
  NO3: { id: "NO3", name: "nitrate", agno3: null, bacl2: null, fizz: false },
};

export type Compound = { formula: string; name: string; cation: string; anion: string };
export const COMPOUNDS: Compound[] = [
  { formula: "NaCl", name: "sodium chloride", cation: "Na", anion: "Cl" },
  { formula: "KCl", name: "potassium chloride", cation: "K", anion: "Cl" },
  { formula: "LiCl", name: "lithium chloride", cation: "Li", anion: "Cl" },
  { formula: "CaCl2", name: "calcium chloride", cation: "Ca", anion: "Cl" },
  { formula: "CuCl2", name: "copper(II) chloride", cation: "Cu", anion: "Cl" },
  { formula: "FeCl3", name: "iron(III) chloride", cation: "Fe3", anion: "Cl" },
  { formula: "NaBr", name: "sodium bromide", cation: "Na", anion: "Br" },
  { formula: "KBr", name: "potassium bromide", cation: "K", anion: "Br" },
  { formula: "NaI", name: "sodium iodide", cation: "Na", anion: "I" },
  { formula: "KI", name: "potassium iodide", cation: "K", anion: "I" },
  { formula: "Na2SO4", name: "sodium sulfate", cation: "Na", anion: "SO4" },
  { formula: "K2SO4", name: "potassium sulfate", cation: "K", anion: "SO4" },
  { formula: "CuSO4", name: "copper(II) sulfate", cation: "Cu", anion: "SO4" },
  { formula: "FeSO4", name: "iron(II) sulfate", cation: "Fe2", anion: "SO4" },
  { formula: "Li2SO4", name: "lithium sulfate", cation: "Li", anion: "SO4" },
  { formula: "Na2CO3", name: "sodium carbonate", cation: "Na", anion: "CO3" },
  { formula: "K2CO3", name: "potassium carbonate", cation: "K", anion: "CO3" },
  { formula: "Li2CO3", name: "lithium carbonate", cation: "Li", anion: "CO3" },
  { formula: "NaNO3", name: "sodium nitrate", cation: "Na", anion: "NO3" },
  { formula: "KNO3", name: "potassium nitrate", cation: "K", anion: "NO3" },
];

export function lookupCompound(formulaOrName: string): Compound | null {
  const f = normalizeChem(formulaOrName).replace(/\s+/g, "");
  const n = formulaOrName.trim().toLowerCase();
  return COMPOUNDS.find((c) => c.formula === f || c.name === n) ?? null;
}

/** What the student sees when they run this test on this compound. */
export function observe(c: Compound, test: TestId): Observation {
  const cat = CATIONS[c.cation], an = ANIONS[c.anion];
  const label = TESTS[test].label;
  const none = (text: string): Observation => ({ test, label, effect: "none", color: null, text });
  switch (test) {
    case "flame":
      return cat.flame ? { test, label, effect: "flame", color: cat.flame.color, text: cat.flame.text } : none("No distinctive flame color");
    case "naoh":
      return cat.naoh ? { test, label, effect: "precipitate", color: cat.naoh.color, text: cat.naoh.text } : none("No precipitate");
    case "agno3":
      return an.agno3 ? { test, label, effect: "precipitate", color: an.agno3.color, text: an.agno3.text } : none("No precipitate");
    case "bacl2":
      return an.bacl2 ? { test, label, effect: "precipitate", color: an.bacl2.color, text: an.bacl2.text } : none("No precipitate");
    case "hcl":
      return an.fizz ? { test, label, effect: "bubbles", color: null, text: "Fizzes: a gas is given off (CO₂)" } : none("No fizzing");
  }
}

export const ALL_TESTS: TestId[] = ["flame", "naoh", "agno3", "bacl2", "hcl"];
export const observeAll = (c: Compound) => ALL_TESTS.map((t) => observe(c, t));

// The mistake a student makes when they pick a compound that differs from the right one only in some tests.
export const MYSTERY_MISCONCEPTIONS = {
  flame_color_mixup: { label: "Mixed up flame colors", why: "Each metal ion gives its own flame color; compare the color to the flame test chart.", concept: "flame tests identify metal ions" },
  halide_color_mixup: { label: "Mixed up the halide precipitates", why: "With silver nitrate, chloride is white, bromide is cream and iodide is yellow.", concept: "silver nitrate identifies halide ions" },
  missed_sulfate_test: { label: "Missed the sulfate test", why: "A white precipitate with barium chloride means sulfate ions are present.", concept: "barium chloride identifies sulfate" },
  missed_carbonate_fizz: { label: "Missed the carbonate fizz", why: "Carbonates fizz with dilute acid because they give off carbon dioxide.", concept: "acids identify carbonates" },
  hydroxide_color_mixup: { label: "Mixed up the hydroxide precipitates", why: "With NaOH, copper(II) is blue, iron(II) green and iron(III) orange-brown.", concept: "sodium hydroxide identifies metal ions" },
} as const;
export type MysteryMisconceptionId = keyof typeof MYSTERY_MISCONCEPTIONS;

const misconceptionFor = (diff: TestId[]): MysteryMisconceptionId => {
  if (diff.includes("hcl")) return "missed_carbonate_fizz";
  if (diff.includes("bacl2")) return "missed_sulfate_test";
  if (diff.includes("agno3")) return "halide_color_mixup";
  if (diff.includes("naoh")) return "hydroxide_color_mixup";
  return "flame_color_mixup";
};

/** Three wrong compounds that look like the answer on most tests (so it takes reasoning), each tied to the mistake that
 *  would lead there. Every distractor differs from the answer on at least one test, so the tests can always tell them apart. */
export function mysteryDistractors(c: Compound): { compound: Compound; misconceptionId: MysteryMisconceptionId; differsOn: TestId[] }[] {
  const mine = observeAll(c);
  const scored = COMPOUNDS.filter((x) => x.formula !== c.formula)
    .map((x) => {
      const theirs = observeAll(x);
      const differsOn = ALL_TESTS.filter((_, i) => theirs[i].text !== mine[i].text);
      return { compound: x, differsOn };
    })
    .filter((x) => x.differsOn.length > 0)
    .sort((a, b) => a.differsOn.length - b.differsOn.length || a.compound.formula.localeCompare(b.compound.formula));
  // Prefer distractors that teach different mistakes, then fill with the closest ones.
  const out: { compound: Compound; misconceptionId: MysteryMisconceptionId; differsOn: TestId[] }[] = [];
  const used = new Set<string>();
  for (const pass of [true, false])
    for (const x of scored) {
      if (out.length === 3) break;
      if (out.some((o) => o.compound.formula === x.compound.formula)) continue;
      const m = misconceptionFor(x.differsOn);
      if (pass && used.has(m)) continue;
      used.add(m);
      out.push({ ...x, misconceptionId: m });
    }
  return out;
}
