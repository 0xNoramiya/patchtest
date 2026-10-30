import type { FitzpatrickScale, SkinAnalysisResult } from "./types";

/**
 * The seven concerns that come back with scores. `skin_type` is requested as an
 * action and counts toward the billed concern count, but it returns a label
 * rather than a score, so it is not in this list.
 */
export const SCORED_CONCERNS = [
  "acne",
  "redness",
  "oiliness",
  "moisture",
  "age_spot",
  "wrinkle",
  "texture",
] as const;

export type ScoredConcern = (typeof SCORED_CONCERNS)[number];

export type ConcernScore = {
  /** What PatchTest decides on. 1 to 100, higher is healthier. */
  raw: number;
  /** What YouCam shows shoppers. Displayed next to raw, never used in a rule. */
  ui: number;
  maskUrl?: string;
};

export type SkinTypeLabel = "Dry" | "Oily" | "Normal" | "Combination" | "Redness" | (string & {});

export type ScanSummary = {
  concerns: Partial<Record<ScoredConcern, ConcernScore>>;
  skinType: { whole?: SkinTypeLabel; t_zone?: SkinTypeLabel; u_zone?: SkinTypeLabel };
  /** The engine's own overall score. Display only. */
  overall: number | null;
  /**
   * The engine's age estimate from the photo. Display only. PatchTest never gates
   * on it: age comes from what the shopper declares.
   */
  skinAge: number | null;
  fitzpatrick: FitzpatrickScale | null;
  masks: Partial<Record<string, string>>;
};

function isScored(type: string): type is ScoredConcern {
  return (SCORED_CONCERNS as readonly string[]).includes(type);
}

/**
 * Normalizes a real skin-analysis response. Eight requested actions come back as
 * thirteen output items: seven scored concerns, three `skin_type` regions, plus
 * the undocumented `all`, `skin_age` and `resize_image` entries.
 */
export function parseSkinAnalysis(
  result: SkinAnalysisResult,
  fitzpatrick: FitzpatrickScale | null = null,
): ScanSummary {
  const summary: ScanSummary = {
    concerns: {},
    skinType: {},
    overall: null,
    skinAge: null,
    fitzpatrick,
    masks: {},
  };

  for (const item of result.results?.output ?? []) {
    const mask = item.mask_urls?.[0];
    const region = (item as { region?: string }).region;

    if (isScored(item.type) && typeof item.raw_score === "number" && typeof item.ui_score === "number") {
      summary.concerns[item.type] = {
        raw: item.raw_score,
        ui: item.ui_score,
        ...(mask ? { maskUrl: mask } : {}),
      };
      if (mask) summary.masks[item.type] = mask;
      continue;
    }

    if (item.type === "skin_type") {
      const label = (item as { skin_type?: string }).skin_type;
      const key = (region ?? "whole") as keyof ScanSummary["skinType"];
      if (label) summary.skinType[key] = label;
      if (mask) summary.masks[`skin_type_${region ?? "whole"}`] = mask;
      continue;
    }

    const score = (item as { score?: number }).score;
    if (item.type === "all" && typeof score === "number") summary.overall = score;
    if (item.type === "skin_age" && typeof score === "number") summary.skinAge = score;
    if (item.type === "resize_image" && mask) summary.masks.resize_image = mask;
  }

  return summary;
}

/** True when the scan says this concern is healthy enough that a product has nothing to work on. */
export function isHealthy(summary: ScanSummary, concern: ScoredConcern, threshold: number): boolean {
  const score = summary.concerns[concern];
  return score !== undefined && score.raw >= threshold;
}
