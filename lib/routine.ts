import type { Evaluation } from "./rules/types";
import type { Product } from "./rules/load";

export type RoutineStep = {
  sku: string;
  name: string;
  /** Taken verbatim from the ADJUST findings on this item, so it stays sourced. */
  notes: string[];
};

export type Routine = { morning: RoutineStep[]; evening: RoutineStep[] };

/**
 * When to use each surviving item, from the catalogue's own tags.
 *
 * This is a schedule, not advice. The only instruction text it carries is
 * copied out of the ADJUST findings, which already carry a source and have
 * already been through the claim linter. Nothing here is written by a model,
 * which is the point: the note that used to sit here was, and it kept
 * describing a cart the rules had not agreed to.
 */
export function buildRoutine(
  products: Product[],
  evaluation: Evaluation,
): Routine {
  const findings = new Map(evaluation.items.map((i) => [i.sku, i.findings]));
  const out: Routine = { morning: [], evening: [] };

  for (const product of products) {
    if (evaluation.blocked.includes(product.sku)) continue;

    const notes = (findings.get(product.sku) ?? [])
      .filter((f) => f.verdict === "ADJUST")
      .map((f) => f.message);
    const step: RoutineStep = { sku: product.sku, name: product.name, notes };

    const tags = new Set(product.tags);
    const morning = tags.has("spf") || tags.has("morning");
    const evening = tags.has("night");
    const twice = tags.has("cleanser") || tags.has("moisturizer") || tags.has("barrier");

    if (morning) out.morning.push(step);
    if (evening) out.evening.push(step);
    if (!morning && !evening) {
      if (twice) {
        out.morning.push(step);
        out.evening.push(step);
      } else {
        // Anything left is a leave-on active with no stated time. Night is the
        // cautious default: it keeps actives away from the day's sun exposure.
        out.evening.push(step);
      }
    }
  }

  // Cleanse, treat, moisturise, protect. Sunscreen is always last in the morning.
  const rank = (step: RoutineStep, products: Product[]) => {
    const tags = new Set(products.find((p) => p.sku === step.sku)?.tags ?? []);
    if (tags.has("cleanser")) return 0;
    if (tags.has("spf")) return 3;
    if (tags.has("moisturizer") || tags.has("barrier")) return 2;
    return 1;
  };
  out.morning.sort((a, b) => rank(a, products) - rank(b, products));
  out.evening.sort((a, b) => rank(a, products) - rank(b, products));

  return out;
}
