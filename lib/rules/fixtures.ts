import { EMPTY_INTAKE, type Intake } from "../intake";
import type { ScoredConcern, ScanSummary } from "../youcam/parse";
import type { Catalog, Product } from "./load";

/**
 * Mid-range scores by default, so that the "nothing to work on" rules stay quiet
 * unless a test deliberately raises a score, and the reactive-skin rule stays
 * quiet unless a test deliberately lowers redness.
 */
const DEFAULT_RAW: Record<ScoredConcern, number> = {
  acne: 65,
  redness: 90,
  oiliness: 65,
  moisture: 65,
  age_spot: 65,
  wrinkle: 65,
  texture: 65,
};

export function makeScan(
  raw: Partial<Record<ScoredConcern, number>> = {},
  skinType: string = "Normal",
): ScanSummary {
  const merged = { ...DEFAULT_RAW, ...raw };
  const concerns: ScanSummary["concerns"] = {};
  for (const [key, value] of Object.entries(merged)) {
    // ui_score deliberately set to a flattering number no rule may read.
    concerns[key as ScoredConcern] = { raw: value, ui: 99 };
  }
  return {
    concerns,
    skinType: { whole: skinType, t_zone: skinType, u_zone: skinType },
    overall: 99,
    skinAge: 14,
    fitzpatrick: null,
    masks: {},
  };
}

export function makeIntake(overrides: Partial<Intake> = {}): Intake {
  return { ...EMPTY_INTAKE, ...overrides };
}

/** For rules with no matching product in the real catalogue. */
export function withExtraProduct(catalog: Catalog, product: Product): Catalog {
  return { ...catalog, products: [...catalog.products, product] };
}

export const STRONG_LEAVE_ON_AHA: Product = {
  sku: "TEST-AHA-15",
  name: "Test Lactic Acid 15% Leave-On",
  price: 1,
  blurb: "Test only. Not in the shipped catalogue.",
  targets: ["texture"],
  actives: [{ class: "aha", name: "lactic acid", pct: 15 }],
  leave_on: true,
  area: "face",
  tags: ["exfoliating"],
};
