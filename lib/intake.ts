import type { FitzpatrickScale } from "./youcam/types";

export type AgeBand = "under_13" | "13_17" | "18_plus";

/** What the shopper declares. Never inferred from the photo. */
export type PregnancyStatus = "pregnant" | "trying" | "breastfeeding" | "none";

export type IsotretinoinStatus = "now" | "stopped_under_6m" | "no";

/** Things a shopper may already be using that change what is safe to add. */
export const REPORTED_PRODUCTS = [
  "tretinoin",
  "tazarotene",
  "hydroquinone",
  "other_prescription_cream",
  "retinol",
  "benzoyl_peroxide",
  "salicylic_acid",
  "glycolic_acid",
  "vitamin_c",
  "azelaic_acid",
] as const;
export type ReportedProduct = (typeof REPORTED_PRODUCTS)[number];

export const RECENT_PROCEDURES = [
  "chemical_peel",
  "laser",
  "microneedling",
  "waxing",
  "dermabrasion",
  "none",
] as const;
export type RecentProcedure = (typeof RECENT_PROCEDURES)[number];

/**
 * Self-reported signs. Scan scores decide which of these we ask about, never
 * what the answer is.
 */
export const SYMPTOMS = [
  "deep_painful_bumps",
  "scarring",
  "flushing",
  "persistent_redness",
  "eye_irritation",
  "mole_changed",
  "sore_not_healing",
  "mood_impact",
  "otc_no_change",
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export type Intake = {
  ageBand: AgeBand;
  pregnancy: PregnancyStatus;
  isotretinoin: IsotretinoinStatus;
  currentlyUsing: ReportedProduct[];
  recentProcedures: RecentProcedure[];
  symptoms: Symptom[];
  goal: string;
  /** Overrides the API result when the shopper sets it. */
  fitzpatrickSelfReported?: FitzpatrickScale | null;
};

export const EMPTY_INTAKE: Intake = {
  ageBand: "18_plus",
  pregnancy: "none",
  isotretinoin: "no",
  currentlyUsing: [],
  recentProcedures: [],
  symptoms: [],
  goal: "",
  fitzpatrickSelfReported: null,
};

/** "pregnant+" in the rules table means pregnant or trying to conceive. */
export function isPregnantPlus(intake: Intake): boolean {
  return intake.pregnancy === "pregnant" || intake.pregnancy === "trying";
}

/** The shopper's own answer wins over the photo estimate. */
export function effectiveFitzpatrick(
  intake: Intake,
  fromApi: FitzpatrickScale | null,
): { value: FitzpatrickScale | null; source: "self_reported" | "api" | "none" } {
  if (intake.fitzpatrickSelfReported) {
    return { value: intake.fitzpatrickSelfReported, source: "self_reported" };
  }
  if (fromApi) return { value: fromApi, source: "api" };
  return { value: null, source: "none" };
}
