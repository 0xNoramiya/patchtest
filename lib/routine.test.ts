import { describe, expect, it } from "vitest";
import { buildRoutine } from "./routine";
import { evaluateFinal } from "./rules/engine";
import { makeIntake, makeScan } from "./rules/fixtures";
import { loadCatalog, loadRules, loadThresholds, productBySku } from "./rules/load";
import type { Product } from "./rules/load";

const catalog = loadCatalog();
const rules = loadRules();
const thresholds = loadThresholds();

function routineFor(cart: string[], intake = {}) {
  const evaluation = evaluateFinal({
    intake: makeIntake(intake),
    scan: makeScan(),
    cart,
    catalog,
    rules,
    thresholds,
    fitzpatrick: null,
  });
  const products = cart.map((sku) => productBySku(catalog, sku)).filter((p): p is Product => Boolean(p));
  return { routine: buildRoutine(products, evaluation), evaluation };
}

const names = (steps: { name: string }[]) => steps.map((s) => s.name);

describe("the routine is built from the final cart", () => {
  it("never schedules an item the rules removed", () => {
    const { routine, evaluation } = routineFor(["LL-105", "LL-101"], { pregnancy: "pregnant" });
    expect(evaluation.blocked).toContain("LL-105");
    const scheduled = [...names(routine.morning), ...names(routine.evening)];
    expect(scheduled.join(" ")).not.toContain("Adapalene");
  });

  it("puts sunscreen in the morning and a night active in the evening", () => {
    const { routine } = routineFor(["LL-106", "LL-121"]);
    expect(names(routine.evening).join(" ")).toContain("Retinol");
    expect(names(routine.morning).join(" ")).toContain("SPF");
    expect(names(routine.evening).join(" ")).not.toContain("SPF");
  });

  it("uses a cleanser twice a day", () => {
    const { routine } = routineFor(["LL-101"]);
    expect(names(routine.morning)).toStrictEqual(["Everyday Gentle Cleanser"]);
    expect(names(routine.evening)).toStrictEqual(["Everyday Gentle Cleanser"]);
  });

  it("carries the rule's own wording rather than inventing an instruction", () => {
    const { routine, evaluation } = routineFor(["LL-107", "LL-121"]);
    const adjust = evaluation.items
      .flatMap((i) => i.findings)
      .filter((f) => f.verdict === "ADJUST")
      .map((f) => f.message);
    const notes = [...routine.morning, ...routine.evening].flatMap((s) => s.notes);
    for (const note of notes) expect(adjust).toContain(note);
  });

  it("cleanses before it treats, and protects last", () => {
    const { routine } = routineFor(["LL-121", "LL-101", "LL-114"]);
    const order = names(routine.morning);
    expect(order.indexOf("Everyday Gentle Cleanser")).toBe(0);
    expect(order.at(-1)).toContain("SPF");
  });
});
