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
