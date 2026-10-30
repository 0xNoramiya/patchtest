import { isPregnantPlus, type Intake } from "../intake";
import type { ScanSummary } from "../youcam/parse";
import type { Catalog, Product, Thresholds } from "./load";
import { productBySku } from "./load";
import {
  type CartPredicate,
  type Evaluation,
  type Finding,
  type ItemEvaluation,
  type ItemPredicate,
  type Rule,
  type ScanPredicate,
  type Verdict,
  VERDICT_RANK,
  type When,
} from "./types";

export type EvaluationInput = {
  intake: Intake;
  scan: ScanSummary | null;
  /** SKUs the agent proposed. */
  cart: string[];
  catalog: Catalog;
  rules: Rule[];
  thresholds: Thresholds;
  /** Fitzpatrick actually in force: the shopper's answer if they gave one. */
  fitzpatrick: string | null;
};

type Ctx = EvaluationInput & { products: Product[] };

function resolveThreshold(t: Thresholds, key: string | number): number | null {
  if (typeof key === "number") return key;
  return t.values[key] ?? t.healthyByConcern[key] ?? null;
}

// --------------------------------------------------------------- predicates

function matchScan(p: ScanPredicate, ctx: Ctx): { ok: boolean; trigger?: Finding["trigger"] } {
  if (!ctx.scan) return { ok: false };

  if (p.raw_lt) {
    const score = ctx.scan.concerns[p.raw_lt.concern as keyof ScanSummary["concerns"]];
    const threshold = resolveThreshold(ctx.thresholds, p.raw_lt.threshold);
    if (!score || threshold === null || !(score.raw < threshold)) return { ok: false };
    return {
      ok: true,
      trigger: {
        kind: "scan",
        concern: p.raw_lt.concern,
        raw: score.raw,
        threshold,
        comparison: "below",
      },
    };
  }

  if (p.raw_gte) {
    const score = ctx.scan.concerns[p.raw_gte.concern as keyof ScanSummary["concerns"]];
    const threshold = resolveThreshold(ctx.thresholds, p.raw_gte.threshold);
    if (!score || threshold === null || !(score.raw >= threshold)) return { ok: false };
    return {
      ok: true,
      trigger: {
        kind: "scan",
        concern: p.raw_gte.concern,
        raw: score.raw,
        threshold,
        comparison: "at_or_above",
      },
    };
  }

  if (p.skin_type_any) {
    // Labels come back compound, such as "Dry & Sensitive", so this matches on
    // substring rather than equality.
    for (const [region, label] of Object.entries(ctx.scan.skinType)) {
      if (label && p.skin_type_any.some((want) => label.includes(want))) {
        return { ok: true, trigger: { kind: "scan_skin_type", region, label } };
      }
    }
    return { ok: false };
  }

  return { ok: false };
}

function activesOfClass(product: Product, cls: string) {
  return product.actives.filter((a) => a.class === cls);
}

function allTargetsHealthy(product: Product, ctx: Ctx): boolean {
  if (!ctx.scan) return false;
  const scannable = product.targets.filter((t) => t in ctx.thresholds.healthyByConcern);
  if (scannable.length === 0) return false;
  return scannable.every((t) => {
    const score = ctx.scan!.concerns[t as keyof ScanSummary["concerns"]];
    return score !== undefined && score.raw >= ctx.thresholds.healthyByConcern[t];
  });
}

function skinTypeContradicts(product: Product, ctx: Ctx): boolean {
  if (!ctx.scan) return false;
  const whole = ctx.scan.skinType.whole;
  if (!whole) return false;
  return product.tags.some((tag) =>
    ctx.thresholds.skinTypeContradictions[tag]?.some((label) => whole.includes(label)),
  );
}

function matchItem(p: ItemPredicate, product: Product, ctx: Ctx): boolean {
  if (p.any_of) {
    if (!p.any_of.some((branch) => matchItem(branch, product, ctx))) return false;
  }
  if (p.active_class_any && !product.actives.some((a) => p.active_class_any!.includes(a.class))) {
    return false;
  }
  if (p.active_pct_gt) {
    const hit = activesOfClass(product, p.active_pct_gt.class).some(
      (a) => (a.pct ?? 0) > p.active_pct_gt!.pct,
    );
    if (!hit) return false;
  }
  if (p.active_pct_gte_threshold) {
    const threshold = resolveThreshold(ctx.thresholds, p.active_pct_gte_threshold.threshold);
    if (threshold === null) return false;
    const hit = activesOfClass(product, p.active_pct_gte_threshold.class).some(
      (a) => (a.pct ?? 0) >= threshold,
    );
    if (!hit) return false;
  }
  if (p.tag_any && !product.tags.some((t) => p.tag_any!.includes(t))) return false;
  if (p.leave_on !== undefined && product.leave_on !== p.leave_on) return false;
  if (p.area_in && !p.area_in.includes(product.area)) return false;
  if (p.targets_any && !product.targets.some((t) => p.targets_any!.includes(t))) return false;
  if (p.all_targets_healthy && !allTargetsHealthy(product, ctx)) return false;
  if (p.skin_type_contradicts && !skinTypeContradicts(product, ctx)) return false;
  return true;
}

function duplicatedLeaveOnClasses(ctx: Ctx): Set<string> {
  const counts = new Map<string, number>();
  for (const product of ctx.products) {
    if (!product.leave_on) continue;
    for (const cls of new Set(product.actives.map((a) => a.class))) {
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, n]) => n >= 2).map(([cls]) => cls));
}

function matchCart(p: CartPredicate, ctx: Ctx): boolean {
  if (p.active_class_count_gte) {
    const present = new Set(
      ctx.products.flatMap((prod) =>
        prod.actives.map((a) => a.class).filter((c) => p.active_class_count_gte!.classes.includes(c)),
      ),
    );
    if (present.size < p.active_class_count_gte.count) return false;
  }
  if (p.has_active_class_any) {
    const hit = ctx.products.some((prod) =>
      prod.actives.some((a) => p.has_active_class_any!.includes(a.class)),
    );
    if (!hit) return false;
  }
  if (p.missing_tag_any) {
    const present = ctx.products.some((prod) => prod.tags.some((t) => p.missing_tag_any!.includes(t)));
    if (present) return false;
  }
  if (p.duplicate_leave_on_active_class && duplicatedLeaveOnClasses(ctx).size === 0) return false;
  return true;
}

/** Everything in `when` except the item clause, which is checked per product. */
function matchContext(w: When, ctx: Ctx): { ok: boolean; trigger?: Finding["trigger"] } {
  if (w.any_of) {
    const branch = w.any_of.map((b) => matchContext(b, ctx)).find((r) => r.ok);
    if (!branch) return { ok: false };
    return branch;
  }

  const { intake } = ctx;
  if (w.pregnancy_in) {
    const matches = w.pregnancy_in.some((v) =>
      v === "pregnant" || v === "trying"
        ? intake.pregnancy === v
        : intake.pregnancy === (v as Intake["pregnancy"]),
    );
    if (!matches) return { ok: false };
  }
  if (w.isotretinoin_in && !w.isotretinoin_in.includes(intake.isotretinoin)) return { ok: false };
  if (w.age_band_in && !w.age_band_in.includes(intake.ageBand)) return { ok: false };
  if (w.fitzpatrick_in && (!ctx.fitzpatrick || !w.fitzpatrick_in.includes(ctx.fitzpatrick))) {
    return { ok: false };
  }
  if (w.reported_use_any && !intake.currentlyUsing.some((u) => w.reported_use_any!.includes(u))) {
    return { ok: false };
  }
  if (w.symptoms_any && !intake.symptoms.some((s) => w.symptoms_any!.includes(s))) return { ok: false };
  if (w.symptoms_all && !w.symptoms_all.every((s) => intake.symptoms.includes(s as never))) {
    return { ok: false };
  }
  if (
    w.recent_procedure_any &&
    !intake.recentProcedures.some((p) => w.recent_procedure_any!.includes(p))
  ) {
    return { ok: false };
  }
  if (w.cart && !matchCart(w.cart, ctx)) return { ok: false };

  if (w.scan) return matchScan(w.scan, ctx);
  return { ok: true };
}

function findingFrom(
  rule: Rule,
  trigger: Finding["trigger"],
  sku?: string,
  overrides: Partial<Finding> = {},
): Finding {
  return {
    ruleId: rule.id,
    verdict: rule.verdict,
    message: rule.message,
    evidence: rule.evidence,
    sourceUrls: rule.source_urls,
    ...(rule.source_quote ? { sourceQuote: rule.source_quote } : {}),
    ...(rule.swap_hint ? { swapHint: rule.swap_hint } : {}),
    ...(rule.notes ? { notes: rule.notes } : {}),
    ...(sku ? { sku } : {}),
    ...(trigger ? { trigger } : {}),
    ...overrides,
  };
}

function intakeTrigger(rule: Rule, intake: Intake, fitzpatrick: string | null): Finding["trigger"] {
  const w = rule.when;
  if (w.pregnancy_in) return { kind: "intake", field: "pregnancy", value: intake.pregnancy };
  if (w.isotretinoin_in) return { kind: "intake", field: "isotretinoin", value: intake.isotretinoin };
  if (w.age_band_in) return { kind: "intake", field: "age", value: intake.ageBand };
  if (w.fitzpatrick_in && fitzpatrick) {
    return { kind: "intake", field: "fitzpatrick", value: fitzpatrick };
  }
  if (w.reported_use_any) {
    const used = intake.currentlyUsing.filter((u) => w.reported_use_any!.includes(u));
    return { kind: "intake", field: "currently_using", value: used.join(", ") };
  }
  if (w.symptoms_any || w.symptoms_all) {
    const all = [...(w.symptoms_all ?? []), ...(w.symptoms_any ?? [])];
    const reported = intake.symptoms.filter((s) => all.includes(s));
    return { kind: "intake", field: "symptoms", value: reported.join(", ") };
  }
  return undefined;
}

// ------------------------------------------------------------------ evaluate

/**
 * Pure function. Same inputs, same verdicts, every time. The LLM never reaches
 * in here, and nothing here reads ui_score or skin_age.
 */
export function evaluate(input: EvaluationInput): Evaluation {
  const products = input.cart
    .map((sku) => productBySku(input.catalog, sku))
    .filter((p): p is Product => Boolean(p));
  const ctx: Ctx = { ...input, products };

  const active = input.rules.filter((r) => r.status !== "retired");
  const findingsBySku = new Map<string, Finding[]>();
  const push = (sku: string, finding: Finding) => {
    const list = findingsBySku.get(sku) ?? [];
    list.push(finding);
    findingsBySku.set(sku, list);
  };

  const referrals: Finding[] = [];
  const reported: Finding[] = [];
  const additions: Evaluation["additions"] = [];
  const suggestedQuestions: Evaluation["suggestedQuestions"] = [];

  for (const rule of active) {
    // A low score never asserts a finding. It only says a question is worth asking.
    if (rule.ask_when) {
      const asked = matchScan(rule.ask_when.scan, ctx);
      if (asked.ok && asked.trigger?.kind === "scan") {
        suggestedQuestions.push({
          ruleId: rule.id,
          concern: asked.trigger.concern,
          raw: asked.trigger.raw,
          threshold: asked.trigger.threshold,
        });
      }
    }

    const context = matchContext(rule.when, ctx);
    if (!context.ok) continue;
    const trigger = context.trigger ?? intakeTrigger(rule, input.intake, input.fitzpatrick);

    if (rule.scope === "reported") {
      reported.push(findingFrom(rule, trigger));
      continue;
    }

    if (rule.scope === "referral") {
      referrals.push(findingFrom(rule, trigger));
      for (const product of products) {
        const keep = rule.restrict?.keep_only_tags;
        const blockClasses = rule.restrict?.block_active_classes;
        const failsKeep = keep ? !product.tags.some((t) => keep.includes(t)) : false;
        const failsClass = blockClasses
          ? product.actives.some((a) => blockClasses.includes(a.class))
          : false;
        if (failsKeep || failsClass) {
          push(
            product.sku,
            findingFrom(rule, trigger, product.sku, {
              verdict: "BLOCK",
              message: rule.message,
            }),
          );
        }
      }
      continue;
    }

    if (rule.verdict === "ADD" && rule.add) {
      let sku = rule.add.default;
      if (
        rule.add.if_fitzpatrick_in &&
        input.fitzpatrick &&
        rule.add.if_fitzpatrick_in.scales.includes(input.fitzpatrick)
      ) {
        sku = rule.add.if_fitzpatrick_in.sku;
      } else if (rule.add.if_concern_below && input.scan) {
        const { concern, threshold_key, sku: altSku } = rule.add.if_concern_below;
        const score = input.scan.concerns[concern as keyof ScanSummary["concerns"]];
        const threshold = ctx.thresholds.healthyByConcern[threshold_key];
        if (score && threshold !== undefined && score.raw < threshold) sku = altSku;
      }
      if (!input.cart.includes(sku)) {
        additions.push({ sku, ruleId: rule.id, message: rule.message });
      }
      continue;
    }

    // item and cart scope both land a verdict on each matching product
    const duplicated = rule.when.cart?.duplicate_leave_on_active_class
      ? duplicatedLeaveOnClasses(ctx)
      : null;

    for (const product of products) {
      if (duplicated && !product.actives.some((a) => duplicated.has(a.class))) continue;
      if (rule.when.item && !matchItem(rule.when.item, product, ctx)) continue;
      if (!rule.when.item && !duplicated && rule.scope === "item") continue;
      push(product.sku, findingFrom(rule, trigger, product.sku));
    }
  }

  const items: ItemEvaluation[] = products.map((product) => {
    const findings = findingsBySku.get(product.sku) ?? [];
    const verdict = findings.reduce<Verdict>(
      (worst, f) => (VERDICT_RANK[f.verdict] > VERDICT_RANK[worst] ? f.verdict : worst),
      "OK",
    );
    return { sku: product.sku, verdict, findings };
  });

  return {
    items,
    referrals,
    reported,
    additions,
    // Keyed off the finding, not the headline. An item can be shown as
    // UNNECESSARY while still carrying a BLOCK finding, and the agent must not
    // be allowed to propose it again either way.
    blocked: items
      .filter((i) => i.findings.some((f) => f.verdict === "BLOCK"))
      .map((i) => i.sku),
    suggestedQuestions,
  };
}
