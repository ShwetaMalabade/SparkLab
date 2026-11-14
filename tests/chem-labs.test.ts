// tests/chem-labs.test.ts — Titration Lab (acidBase.ts) and Mystery Sample (ions.ts) chemistry. PASS/FAIL harness, run with `npx tsx`.
import { analyteMolarityFrom, checkScenario, curve, equivalenceML, indicatorColor, indicatorFits, lookupAcidBase, phAt, type Scenario } from "../src/lib/acidBase";
import { COMPOUNDS, lookupCompound, mysteryDistractors, observe, observeAll } from "../src/lib/ions";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra: unknown = "") => {
  if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name} ${JSON.stringify(extra)}`); }
};
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ---- strong acid + strong base
const hcl: Scenario = { analyte: { formula: "HCl", molarity: 0.1, volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } };
ok("HCl/NaOH end point 25.0 mL", near(equivalenceML(hcl), 25, 1e-9), equivalenceML(hcl));
ok("HCl/NaOH start pH 1.00", near(phAt(hcl, 0), 1.0, 0.01), phAt(hcl, 0));
ok("HCl/NaOH pH 7.00 at the end point", near(phAt(hcl, 25), 7.0, 0.01), phAt(hcl, 25));
ok("HCl/NaOH pH after 10 mL = 1.37", near(phAt(hcl, 10), 1.37, 0.01), phAt(hcl, 10)); // 1.5 mmol H+ in 35 mL
ok("HCl/NaOH pH after 30 mL = 11.96", near(phAt(hcl, 30), 11.96, 0.01), phAt(hcl, 30)); // 0.5 mmol OH- in 55 mL
ok("steep jump: 24.9 → 25.1 mL crosses 4 → 10", phAt(hcl, 24.9) < 4.5 && phAt(hcl, 25.1) > 9.5, [phAt(hcl, 24.9), phAt(hcl, 25.1)]);

// ---- H2SO4 is diprotic: twice the base
const h2so4: Scenario = { analyte: { formula: "H₂SO₄", molarity: 0.1, volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } };
ok("H2SO4 needs 2:1 → 50.0 mL", near(equivalenceML(h2so4), 50, 1e-9), equivalenceML(h2so4));
ok("H2SO4 pH 7 at its end point", near(phAt(h2so4, 50), 7.0, 0.01), phAt(h2so4, 50));
const baoh: Scenario = { analyte: { formula: "HCl", molarity: 0.2, volumeML: 20 }, titrant: { formula: "Ba(OH)2", molarity: 0.1 } };
ok("Ba(OH)2 gives 2 OH- → 20.0 mL", near(equivalenceML(baoh), 20, 1e-9), equivalenceML(baoh));

// ---- weak acid + strong base
const hac: Scenario = { analyte: { formula: "CH3COOH", molarity: 0.1, volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } };
ok("acetic acid start pH ≈ 2.88", near(phAt(hac, 0), 2.88, 0.02), phAt(hac, 0));
ok("half-equivalence pH = pKa ≈ 4.74", near(phAt(hac, 12.5), 4.74, 0.02), phAt(hac, 12.5));
ok("acetic acid end point pH ≈ 8.72 (basic)", near(phAt(hac, 25), 8.72, 0.03), phAt(hac, 25));
ok("alias HC2H3O2 = acetic acid", lookupAcidBase("HC2H3O2")?.formula === "CH3COOH");

// ---- weak base + strong acid
const nh3: Scenario = { analyte: { formula: "NH3", molarity: 0.1, volumeML: 25 }, titrant: { formula: "HCl", molarity: 0.1 } };
ok("NH3/HCl end point pH ≈ 5.28 (acidic)", near(phAt(nh3, 25), 5.28, 0.03), phAt(nh3, 25));
ok("NH3 half-equivalence pH = 14 − pKb ≈ 9.26", near(phAt(nh3, 12.5), 9.26, 0.02), phAt(nh3, 12.5));

// ---- the "find the concentration" question
ok("0.100 M NaOH, end point 21.4 mL into 25.0 mL HCl → 0.0856 M", near(analyteMolarityFrom({ analyte: { formula: "HCl", volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } }, 21.4), 0.0856, 1e-6));
ok("…and for H2SO4 it's half that (0.0428 M)", near(analyteMolarityFrom({ analyte: { formula: "H2SO4", volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } }, 21.4), 0.0428, 1e-6));

// ---- code rejects what it can't honestly simulate
ok("unknown acid rejected", !checkScenario({ analyte: { formula: "HXyz", molarity: 0.1, volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } }).ok);
ok("acid + acid rejected", !checkScenario({ analyte: { formula: "HCl", molarity: 0.1, volumeML: 25 }, titrant: { formula: "HNO3", molarity: 0.1 } }).ok);
ok("weak + weak rejected", !checkScenario({ analyte: { formula: "CH3COOH", molarity: 0.1, volumeML: 25 }, titrant: { formula: "NH3", molarity: 0.1 } }).ok);
ok("silly concentration rejected", !checkScenario({ analyte: { formula: "HCl", molarity: 50, volumeML: 25 }, titrant: { formula: "NaOH", molarity: 0.1 } }).ok);

// ---- curve
const c = curve(hac);
ok("curve runs 0 → 2× end point, sorted", c[0].ml === 0 && near(c.at(-1)!.ml, 50, 1e-6) && c.every((p, i) => i === 0 || p.ml > c[i - 1].ml));
ok("curve pH rises monotonically", c.every((p, i) => i === 0 || p.pH >= c[i - 1].pH - 1e-9));
ok("curve has dense points near the end point", c.filter((p) => p.ml >= 23.75 && p.ml <= 26.25).length >= 15, c.length);
ok("curve size stays small (< 160 points)", c.length < 160, c.length);

// ---- indicators
ok("phenolphthalein colorless in acid", indicatorColor("phenolphthalein", 4).label === "colorless" && indicatorColor("phenolphthalein", 4).strength === 0);
ok("phenolphthalein faint pink at 9", indicatorColor("phenolphthalein", 9).label === "faint pink");
ok("phenolphthalein pink at 10", indicatorColor("phenolphthalein", 10).label === "pink");
ok("phenolphthalein overshoot → deep magenta", indicatorColor("phenolphthalein", 12.5).label === "deep magenta");
ok("methyl orange red at 2, yellow at 6", indicatorColor("methyl_orange", 2).label === "red" && indicatorColor("methyl_orange", 6).label === "yellow");
ok("bromothymol blue green at 6.8", indicatorColor("bromothymol_blue", 6.8).label === "green");
ok("colors are hex", /^#[0-9A-F]{6}$/.test(indicatorColor("bromothymol_blue", 6.8).hex), indicatorColor("bromothymol_blue", 6.8).hex);
ok("phenolphthalein fits weak acid + strong base", indicatorFits(hac, "phenolphthalein"));
ok("methyl orange does NOT fit weak acid + strong base", !indicatorFits(hac, "methyl_orange"));
ok("methyl orange fits weak base + strong acid", indicatorFits(nh3, "methyl_orange"));
ok("phenolphthalein does NOT fit weak base + strong acid", !indicatorFits(nh3, "phenolphthalein"));
ok("all three fit strong + strong", indicatorFits(hcl, "phenolphthalein") && indicatorFits(hcl, "methyl_orange") && indicatorFits(hcl, "bromothymol_blue"));

// ---- Mystery Sample
const kcl = lookupCompound("KCl")!;
ok("lookup by formula and name", kcl?.name === "potassium chloride" && lookupCompound("sodium iodide")?.formula === "NaI");
ok("unknown compound → null", lookupCompound("Unobtainium") === null);
ok("K+ lilac flame", observe(kcl, "flame").text === "Lilac flame" && observe(kcl, "flame").effect === "flame");
ok("Cl- white with silver nitrate", observe(kcl, "agno3").text === "White precipitate");
ok("KI yellow with silver nitrate", observe(lookupCompound("KI")!, "agno3").text === "Yellow precipitate");
ok("NaBr cream with silver nitrate", observe(lookupCompound("NaBr")!, "agno3").text === "Cream precipitate");
ok("sulfate white with BaCl2", observe(lookupCompound("Na2SO4")!, "bacl2").text === "White precipitate");
ok("carbonate fizzes with acid", observe(lookupCompound("Na2CO3")!, "hcl").effect === "bubbles");
ok("Cu2+ blue precipitate with NaOH", observe(lookupCompound("CuSO4")!, "naoh").text === "Blue precipitate");
ok("Fe3+ orange-brown with NaOH, Fe2+ green", observe(lookupCompound("FeCl3")!, "naoh").text.startsWith("Orange-brown") && observe(lookupCompound("FeSO4")!, "naoh").text.startsWith("Green"));
ok("nitrate: no positive anion test", ["agno3", "bacl2", "hcl"].every((t) => observe(lookupCompound("KNO3")!, t as "agno3").effect === "none"));
ok("every compound has 5 observations with hex-or-null colors", COMPOUNDS.every((x) => observeAll(x).length === 5 && observeAll(x).every((o) => o.color === null || /^#[0-9A-F]{6}$/.test(o.color))));
let allGood = true;
for (const x of COMPOUNDS) {
  const d = mysteryDistractors(x);
  const distinct = new Set(d.map((y) => y.compound.formula)).size === 3 && !d.some((y) => y.compound.formula === x.formula);
  const separable = d.every((y) => y.differsOn.length >= 1);
  if (!(d.length === 3 && distinct && separable)) { allGood = false; console.log("  bad distractors for", x.formula, d); }
}
ok("every compound gets 3 distinct distractors that a test can tell apart", allGood);
const dk = mysteryDistractors(kcl);
ok("KCl's distractors are close (≤ 2 tests differ)", dk.every((y) => y.differsOn.length <= 2), dk.map((y) => [y.compound.formula, y.differsOn]));
ok("KCl's distractors teach ≥ 2 different mistakes", new Set(dk.map((y) => y.misconceptionId)).size >= 2, dk.map((y) => y.misconceptionId));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
