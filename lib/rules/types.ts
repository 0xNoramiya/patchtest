import { z } from "zod";

export const VERDICTS = ["BLOCK", "ADJUST", "UNNECESSARY", "REFER", "ADD", "OK"] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * Which verdict becomes the headline when several rules fire on one item.
 * Clinician's call: lead with "you don't need this" wherever it applies, since
 * it is the least alarming way to not sell something, and show the safety
 * reason underneath. Every finding is still listed under the headline, and an
 * item carrying a BLOCK finding never stays in the cart whichever label it wears.
 */
export const VERDICT_RANK: Record<Verdict, number> = {
  UNNECESSARY: 5,
  BLOCK: 4,
  ADJUST: 2,
  REFER: 1,
  ADD: 0,
  OK: 0,
};

const stringList = z.array(z.string());

const scanPredicate = z.object({
  raw_lt: z.object({ concern: z.string(), threshold: z.string() }).optional(),
  raw_gte: z.object({ concern: z.string(), threshold: z.string() }).optional(),
  skin_type_any: stringList.optional(),
});
export type ScanPredicate = z.infer<typeof scanPredicate>;

export type ItemPredicate = {
  active_class_any?: string[];
  active_pct_gt?: { class: string; pct: number };
  active_pct_gte_threshold?: { class: string; threshold: string | number };
  tag_any?: string[];
  leave_on?: boolean;
  area_in?: string[];
  targets_any?: string[];
  all_targets_healthy?: boolean;
  skin_type_contradicts?: boolean;
  any_of?: ItemPredicate[];
};

const itemPredicate: z.ZodType<ItemPredicate> = z.lazy(() =>
  z.object({
    active_class_any: stringList.optional(),
    active_pct_gt: z.object({ class: z.string(), pct: z.number() }).optional(),
    active_pct_gte_threshold: z
      .object({ class: z.string(), threshold: z.union([z.string(), z.number()]) })
      .optional(),
    tag_any: stringList.optional(),
    leave_on: z.boolean().optional(),
    area_in: stringList.optional(),
    targets_any: stringList.optional(),
    all_targets_healthy: z.boolean().optional(),
    skin_type_contradicts: z.boolean().optional(),
    any_of: z.array(itemPredicate).optional(),
  }),
);

const cartPredicate = z.object({
  active_class_count_gte: z.object({ classes: stringList, count: z.number() }).optional(),
  has_active_class_any: stringList.optional(),
  missing_tag_any: stringList.optional(),
  duplicate_leave_on_active_class: z.boolean().optional(),
});
export type CartPredicate = z.infer<typeof cartPredicate>;

export type When = {
  pregnancy_in?: string[];
  isotretinoin_in?: string[];
  age_band_in?: string[];
  fitzpatrick_in?: string[];
  reported_use_any?: string[];
  symptoms_any?: string[];
  symptoms_all?: string[];
  recent_procedure_any?: string[];
  item?: ItemPredicate;
  scan?: ScanPredicate;
  cart?: CartPredicate;
  any_of?: When[];
};

const when: z.ZodType<When> = z.lazy(() =>
  z.object({
    pregnancy_in: stringList.optional(),
    isotretinoin_in: stringList.optional(),
    age_band_in: stringList.optional(),
    fitzpatrick_in: stringList.optional(),
    reported_use_any: stringList.optional(),
    symptoms_any: stringList.optional(),
    symptoms_all: stringList.optional(),
    recent_procedure_any: stringList.optional(),
    item: itemPredicate.optional(),
    scan: scanPredicate.optional(),
    cart: cartPredicate.optional(),
    any_of: z.array(when).optional(),
  }),
);

export const ruleSchema = z.object({
  id: z.string(),
  verdict: z.enum(VERDICTS),
  scope: z.enum(["item", "cart", "reported", "referral"]),
  when: when,
  message: z.string().min(1),
  swap_hint: z.string().default(""),
  evidence: z.enum(["guideline", "label", "review", "heuristic"]),
  source_urls: stringList.default([]),
  source_quote: z.string().default(""),
  source_accessed: z.string().optional(),
  verification: z.enum(["pending", "verified", "partial", "unverified", "not_applicable"]),
  status: z.enum(["draft", "approved", "retired"]),
  notes: z.string().optional(),
  priority: z.enum(["high", "normal"]).optional(),
  soft: z.boolean().optional(),
  ask_when: z.object({ scan: scanPredicate }).optional(),
  restrict: z
    .object({
      keep_only_tags: stringList.optional(),
      block_active_classes: stringList.optional(),
    })
    .optional(),
  add: z
    .object({
      default: z.string(),
      if_fitzpatrick_in: z.object({ scales: stringList, sku: z.string() }).optional(),
      if_concern_below: z
        .object({ concern: z.string(), threshold_key: z.string(), sku: z.string() })
        .optional(),
    })
    .optional(),
});
export type Rule = z.infer<typeof ruleSchema>;

export const ruleFileSchema = z.object({
  version: z.number(),
  status: z.string(),
  rules: z.array(ruleSchema),
});

export const thresholdFileSchema = z.object({
  thresholds: z.record(
    z.string(),
    z.object({ value: z.number(), used_by: stringList, meaning: z.string(), unit: z.string().optional() }),
  ),
  healthy_by_concern: z.record(z.string(), z.union([z.number(), z.string()])),
  skin_type_contradictions: z.record(z.string(), z.union([stringList, z.string()])),
});

/** A single rule firing. Every verdict the shopper sees traces back to one of these. */
export type Finding = {
  ruleId: string;
  verdict: Verdict;
  sku?: string;
  message: string;
  swapHint?: string;
  evidence: Rule["evidence"];
  sourceUrls: string[];
  sourceQuote?: string;
  /** What in the scan or the intake made this fire. Shown next to the verdict. */
  trigger?:
    | { kind: "scan"; concern: string; raw: number; threshold: number; comparison: "below" | "at_or_above" }
    | { kind: "scan_skin_type"; region: string; label: string }
    | { kind: "intake"; field: string; value: string }
    | { kind: "cart"; detail: string };
  notes?: string;
};

export type ItemEvaluation = {
  sku: string;
  verdict: Verdict;
  findings: Finding[];
};

export type Evaluation = {
  items: ItemEvaluation[];
  referrals: Finding[];
  /** Notices about things the shopper said they already use. */
  reported: Finding[];
  additions: Array<{ sku: string; ruleId: string; message: string }>;
  /** SKUs the agent must not propose again, fed back into the revision round. */
  blocked: string[];
  /** Questions the scan says are worth asking, surfaced by ask_when. */
  suggestedQuestions: Array<{ ruleId: string; concern: string; raw: number; threshold: number }>;
};
