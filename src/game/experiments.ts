// src/game/experiments.ts: the chemistry behind the Experiments Lab, computed by code (pure, tested in chem-labs).
// Volcano: NaHCO3 + CH3COOH -> CH3COONa + H2O + CO2. What the student pours sets the moles of each reactant;
// the smaller one (the limiting reactant) decides how much CO2 gas is made, so how big the eruption is.
import { molarMass } from "@/lib/stoich";

export const VOLCANO = {
  equation: "NaHCO3 + CH3COOH -> CH3COONa + H2O + CO2",
  sodaJarG: 20, // the jar on the bench holds 20 g of baking soda
  vinegarBottleML: 250, // the bottle holds 250 mL of vinegar
  vinegarMolarity: 0.833, // household vinegar: about 5 % acetic acid = 50 g/L ÷ 60.05 g/mol
  gasMolarVolumeL: 24.0, // room temperature
  maxDrops: 8,
};

export type VolcanoState = {
  sodaG: number;
  vinegarML: number;
  molSoda: number;
  molAcid: number;
  reacted: number; // mol of each reactant used up = mol of CO2 made (1 : 1 : 1)
  co2L: number;
  limiting: "baking soda" | "vinegar" | "neither" | null; // null until both are in
};

/** soda / vinegar = fraction of the jar / bottle poured in (0..1). */
export function volcanoState(soda: number, vinegar: number): VolcanoState {
  const sodaG = Math.max(0, Math.min(1, soda)) * VOLCANO.sodaJarG;
  const vinegarML = Math.max(0, Math.min(1, vinegar)) * VOLCANO.vinegarBottleML;
  const molSoda = sodaG / molarMass("NaHCO3")!;
  const molAcid = (vinegarML / 1000) * VOLCANO.vinegarMolarity;
  const reacted = Math.min(molSoda, molAcid);
  const limiting = molSoda <= 0 || molAcid <= 0 ? null : Math.abs(molSoda - molAcid) / Math.max(molSoda, molAcid) < 0.05 ? "neither" : molSoda < molAcid ? "baking soda" : "vinegar";
  return { sodaG, vinegarML, molSoda, molAcid, reacted, co2L: reacted * VOLCANO.gasMolarVolumeL, limiting };
}

/** The most CO2 the bench can make (both containers emptied): used to scale the eruption. */
export const VOLCANO_MAX_MOL = volcanoState(1, 1).reacted;

// ---------------------------------------------------------------- Balloon inflator
// Same reaction as the volcano, in a closed bottle: the CO2 has nowhere to go but into the balloon.
export const BALLOON = { sodaG: 15, vinegarML: 200 };
/** soda = fraction of the balloon's baking soda tipped in; vinegar = fraction of the vinegar in the bottle. */
export function balloonState(soda: number, vinegar: number) {
  const s = volcanoState((Math.max(0, Math.min(1, soda)) * BALLOON.sodaG) / VOLCANO.sodaJarG, (Math.max(0, Math.min(1, vinegar)) * BALLOON.vinegarML) / VOLCANO.vinegarBottleML);
  const radiusCm = Math.cbrt((3 * s.co2L * 1000) / (4 * Math.PI)); // sphere holding that many cm³
  return { ...s, radiusCm };
}

// ---------------------------------------------------------------- Elephant toothpaste
// 2H2O2 -> 2H2O + O2, sped up by catalase in yeast (a catalyst: not used up). Dish soap traps the O2 as foam.
export const ELEPHANT = { equation: "2H2O2 -> 2H2O + O2", peroxideML: 100, peroxideMolarity: 1.764 /* 6 % w/v ÷ 34.01 g/mol */ };
export function elephantState(peroxide: number, yeast: number, soap: number) {
  const ml = Math.max(0, Math.min(1, peroxide)) * ELEPHANT.peroxideML;
  const molH2O2 = (ml / 1000) * ELEPHANT.peroxideMolarity;
  const molO2 = molH2O2 / 2;
  return {
    peroxideML: ml, molH2O2, molO2, o2L: molO2 * VOLCANO.gasMolarVolumeL,
    reacting: molH2O2 > 0 && yeast > 0, // no catalyst → far too slow to see
    foamy: soap > 0, // no soap → the O2 just bubbles away
    speed: 0.4 + Math.min(1, yeast) * 1.6, // more yeast = faster, never more oxygen
  };
}

// ---------------------------------------------------------------- Red-cabbage rainbow
// Red-cabbage juice (anthocyanin) changes colour with pH. The pH of each household liquid is a typical value.
export const CABBAGE_CUPS = [
  { id: "lemon", name: "lemon juice", pH: 2.2 },
  { id: "vinegar", name: "vinegar", pH: 2.9 },
  { id: "water", name: "tap water", pH: 7.0 },
  { id: "soda", name: "baking soda solution", pH: 8.3 },
  { id: "soap", name: "soapy water", pH: 10.0 },
  { id: "washing", name: "washing soda solution", pH: 11.6 },
] as const;
const CABBAGE_STOPS: [number, string, string][] = [
  [1, "#C8102E", "red"], [3, "#E0529C", "pink"], [5, "#9B3FAF", "purple"], [7, "#5B4BC4", "violet"],
  [8.5, "#2F6FD8", "blue"], [10, "#2FA36B", "green"], [12.5, "#E3C93A", "yellow"],
];
const hexMix = (a: string, b: string, t: number) => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
};
export function cabbageColor(pH: number): { hex: string; label: string } {
  const s = CABBAGE_STOPS;
  if (pH <= s[0][0]) return { hex: s[0][1], label: s[0][2] };
  for (let i = 1; i < s.length; i++)
    if (pH <= s[i][0]) {
      const t = (pH - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
      return { hex: hexMix(s[i - 1][1], s[i][1], t), label: t < 0.5 ? s[i - 1][2] : s[i][2] };
    }
  return { hex: s[s.length - 1][1], label: s[s.length - 1][2] };
}
export const pHKind = (pH: number) => (pH < 6.5 ? "acid" : pH > 7.5 ? "base" : "neutral");

// ---------------------------------------------------------------- Lava lamp
// Oil floats on water (less dense). A fizzy tablet: citric acid + sodium bicarbonate -> CO2, which lifts coloured water.
export const LAVA_LAMP = {
  equation: "C6H8O7 + 3NaHCO3 -> Na3C6H5O7 + 3H2O + 3CO2",
  oilDensity: 0.92, waterDensity: 1.0,
  tablet: { sodaG: 1.976, citricG: 1.0 },
};
export function lavaLampTablet(tablets: number) {
  const molSoda = (tablets * LAVA_LAMP.tablet.sodaG) / molarMass("NaHCO3")!;
  const molCitric = (tablets * LAVA_LAMP.tablet.citricG) / molarMass("C6H8O7")!;
  const molCO2 = Math.min(molSoda, molCitric * 3); // 3 NaHCO3 per citric acid; 1 CO2 per NaHCO3
  return { molSoda, molCitric, molCO2, co2L: molCO2 * VOLCANO.gasMolarVolumeL, limiting: molSoda < molCitric * 3 ? "sodium bicarbonate" : "citric acid" };
}

// ---------------------------------------------------------------- Hot & cold packs
// Dissolving releases (exothermic, ΔH < 0) or absorbs (endothermic, ΔH > 0) heat: q = n·ΔH, ΔT = −q / (m·c).
export const PACKS = { waterG: 100, startC: 20, c: 4.18 };
export const SALTS = {
  CaCl2: { formula: "CaCl2", name: "calcium chloride", dHkJ: -81.3, gramsPerScoop: 10 },
  NH4NO3: { formula: "NH4NO3", name: "ammonium nitrate", dHkJ: 25.7, gramsPerScoop: 10 },
} as const;
export type Salt = keyof typeof SALTS;
export function packTemperature(salt: Salt, grams: number) {
  const s = SALTS[salt];
  const n = grams / molarMass(s.formula)!;
  const qJ = -n * s.dHkJ * 1000; // heat given to the water
  const dT = grams > 0 ? qJ / ((PACKS.waterG + grams) * PACKS.c) : 0;
  return { n, qJ, dT, finalC: PACKS.startC + dT, kind: s.dHkJ < 0 ? "exothermic" : "endothermic" };
}

// ---------------------------------------------------------------- Copper-plated nail
// Fe + CuSO4 -> FeSO4 + Cu: iron is above copper in the reactivity series, so it pushes copper out of solution.
export const COPPER = { equation: "Fe + CuSO4 -> FeSO4 + Cu", solutionML: 100, molarity: 0.5, nailG: 5.6 };
export const REACTIVITY = ["K", "Na", "Ca", "Mg", "Al", "Zn", "Fe", "Pb", "H", "Cu", "Ag", "Au"];
export const displaces = (metal: string, ion: string) => REACTIVITY.indexOf(metal) >= 0 && REACTIVITY.indexOf(metal) < REACTIVITY.indexOf(ion);
export function copperNail() {
  const molFe = COPPER.nailG / molarMass("Fe")!;
  const molCu2 = (COPPER.solutionML / 1000) * COPPER.molarity;
  const mol = Math.min(molFe, molCu2);
  return { molFe, molCu2, molCu: mol, cuG: mol * molarMass("Cu")!, limiting: molFe < molCu2 ? "iron" : "copper sulfate" };
}
