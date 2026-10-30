import { describe, expect, it } from "vitest";
import { evaluate, type EvaluationInput } from "./engine";
import { makeIntake, makeScan, STRONG_LEAVE_ON_AHA, withExtraProduct } from "./fixtures";
import { loadCatalog, loadRules, loadThresholds } from "./load";
import type { Intake } from "../intake";
import type { ScanSummary } from "../youcam/parse";
import type { Evaluation } from "./types";

const catalog = loadCatalog();
const rules = loadRules();
const thresholds = loadThresholds();

type RunOpts = {
  cart: string[];
  intake?: Partial<Intake>;
  scan?: ScanSummary | null;
  fitzpatrick?: string | null;
  catalogOverride?: typeof catalog;
};

function run({ cart, intake, scan, fitzpatrick = null, catalogOverride }: RunOpts): Evaluation {
  const input: EvaluationInput = {
    intake: makeIntake(intake),
    scan: scan === undefined ? makeScan() : scan,
    cart,
    catalog: catalogOverride ?? catalog,
    rules,
    thresholds,
    fitzpatrick,
  };
  return evaluate(input);
}

/** Did a specific rule land on a specific SKU? */
function fired(result: Evaluation, ruleId: string, sku?: string): boolean {
  const inItems = result.items.some(
    (i) => (sku === undefined || i.sku === sku) && i.findings.some((f) => f.ruleId === ruleId),
  );
  const elsewhere = [...result.referrals, ...result.reported].some((f) => f.ruleId === ruleId);
  const added = result.additions.some((a) => a.ruleId === ruleId);
  return inItems || elsewhere || added;
}

function verdictOf(result: Evaluation, sku: string) {
  return result.items.find((i) => i.sku === sku)?.verdict;
}

describe("the catalogue and rules load", () => {
  it("has 25 products and 24 rules", () => {
    expect(catalog.products).toHaveLength(26);
    expect(rules).toHaveLength(24);
  });

  it("gives every rule that is not a pure heuristic at least one source", () => {
    for (const rule of rules) {
      if (rule.evidence === "heuristic") continue;
      expect(rule.source_urls.length, `${rule.id} has no source`).toBeGreaterThan(0);
    }
  });
});

describe("R-PREG-01 retinoids in pregnancy", () => {
  it("blocks adapalene when pregnant", () => {
    const r = run({ cart: ["LL-105"], intake: { pregnancy: "pregnant" } });
    expect(verdictOf(r, "LL-105")).toBe("BLOCK");
    expect(fired(r, "R-PREG-01", "LL-105")).toBe(true);
  });

  it("blocks retinol when trying to conceive", () => {
    expect(verdictOf(run({ cart: ["LL-106"], intake: { pregnancy: "trying" } }), "LL-106")).toBe("BLOCK");
  });

  it("does not fire when not pregnant", () => {
    expect(fired(run({ cart: ["LL-105"] }), "R-PREG-01")).toBe(false);
  });
});

describe("R-PREG-02 reported hydroquinone", () => {
  it("raises a notice about what the shopper already uses", () => {
    const r = run({ cart: ["LL-101"], intake: { pregnancy: "pregnant", currentlyUsing: ["hydroquinone"] } });
    expect(r.reported.some((f) => f.ruleId === "R-PREG-02" && f.verdict === "BLOCK")).toBe(true);
  });

  it("does not fire when not pregnant", () => {
    expect(fired(run({ cart: ["LL-101"], intake: { currentlyUsing: ["hydroquinone"] } }), "R-PREG-02")).toBe(false);
  });
});

describe("R-PREG-03 peels and strong salicylic in pregnancy", () => {
  it("blocks the at-home peel", () => {
    expect(verdictOf(run({ cart: ["LL-110"], intake: { pregnancy: "pregnant" } }), "LL-110")).toBe("BLOCK");
  });

  it("leaves the 2% salicylic cleanser alone, since the rule is above 2%", () => {
    expect(fired(run({ cart: ["LL-102"], intake: { pregnancy: "pregnant" } }), "R-PREG-03")).toBe(false);
  });
});

describe("R-PREG-04 benzoyl peroxide in pregnancy", () => {
  it("adjusts rather than blocks", () => {
    const r = run({ cart: ["LL-103"], intake: { pregnancy: "pregnant" } });
    expect(verdictOf(r, "LL-103")).toBe("ADJUST");
  });

  it("does not fire for someone trying to conceive", () => {
    expect(fired(run({ cart: ["LL-103"], intake: { pregnancy: "trying" } }), "R-PREG-04")).toBe(false);
  });
});

describe("R-PREG-05 strong leave-on AHA in pregnancy", () => {
  it("adjusts a leave-on AHA above 10%", () => {
    const r = run({
      cart: [STRONG_LEAVE_ON_AHA.sku],
      intake: { pregnancy: "pregnant" },
      catalogOverride: withExtraProduct(catalog, STRONG_LEAVE_ON_AHA),
    });
    expect(fired(r, "R-PREG-05", STRONG_LEAVE_ON_AHA.sku)).toBe(true);
  });

  it("fires on the 15% lactic acid serum in the shipped catalogue", () => {
    expect(fired(run({ cart: ["LL-126"], intake: { pregnancy: "pregnant" } }), "R-PREG-05")).toBe(true);
  });

  it("does not fire on the 10% toner, which sits at the documented safe ceiling", () => {
    expect(fired(run({ cart: ["LL-109"], intake: { pregnancy: "pregnant" } }), "R-PREG-05")).toBe(false);
  });
});

describe("R-BF-01 breastfeeding and chest products", () => {
  it("adjusts the body spray", () => {
    expect(verdictOf(run({ cart: ["LL-124"], intake: { pregnancy: "breastfeeding" } }), "LL-124")).toBe("ADJUST");
  });

  it("does not fire on a face product", () => {
    expect(fired(run({ cart: ["LL-101"], intake: { pregnancy: "breastfeeding" } }), "R-BF-01")).toBe(false);
  });
});

describe("R-ISO-01 procedures on isotretinoin", () => {
  it("blocks wax strips while on isotretinoin", () => {
    expect(verdictOf(run({ cart: ["LL-120"], intake: { isotretinoin: "now" } }), "LL-120")).toBe("BLOCK");
  });

  it("still blocks within six months of stopping", () => {
    expect(verdictOf(run({ cart: ["LL-119"], intake: { isotretinoin: "stopped_under_6m" } }), "LL-119")).toBe("BLOCK");
  });

  it("does not fire for someone who never took it", () => {
    expect(fired(run({ cart: ["LL-120"] }), "R-ISO-01")).toBe(false);
  });
});

describe("R-ISO-02 actives on isotretinoin", () => {
  it("blocks the glycolic toner while on isotretinoin", () => {
    expect(verdictOf(run({ cart: ["LL-109"], intake: { isotretinoin: "now" } }), "LL-109")).toBe("BLOCK");
  });

  it("does not fire after stopping, unlike R-ISO-01", () => {
    expect(fired(run({ cart: ["LL-109"], intake: { isotretinoin: "stopped_under_6m" } }), "R-ISO-02")).toBe(false);
  });
});

describe("R-AGE-01 actives under 13", () => {
  it("blocks retinol", () => {
    const r = run({ cart: ["LL-106"], intake: { ageBand: "under_13" } });
    expect(verdictOf(r, "LL-106")).toBe("BLOCK");
    expect(r.items[0].findings[0].message).toMatch(/nothing in young skin/i);
  });

  it("leaves a plain cleanser alone", () => {
    expect(fired(run({ cart: ["LL-101"], intake: { ageBand: "under_13" } }), "R-AGE-01")).toBe(false);
  });
});

describe("R-AGE-02 anti-aging between 13 and 17", () => {
  it("calls vitamin C unnecessary", () => {
    expect(verdictOf(run({ cart: ["LL-112"], intake: { ageBand: "13_17" } }), "LL-112")).toBe("UNNECESSARY");
  });

  it("does not fire for an adult", () => {
    expect(fired(run({ cart: ["LL-112"] }), "R-AGE-02")).toBe(false);
  });
});

describe("R-FITZ-01 at-home peels on deeper skin tones", () => {
  it("blocks the 30% peel at Fitzpatrick V", () => {
    const r = run({ cart: ["LL-110"], fitzpatrick: "V" });
    expect(verdictOf(r, "LL-110")).toBe("BLOCK");
    expect(fired(r, "R-FITZ-01", "LL-110")).toBe(true);
  });

  it("does not fire at Fitzpatrick II", () => {
    expect(fired(run({ cart: ["LL-110"], fitzpatrick: "II" }), "R-FITZ-01")).toBe(false);
  });
});

describe("R-FITZ-02 retinoids on deeper skin tones", () => {
  it("adjusts rather than blocks", () => {
    expect(verdictOf(run({ cart: ["LL-106"], fitzpatrick: "IV" }), "LL-106")).toBe("ADJUST");
  });

  it("does not fire at Fitzpatrick III", () => {
    expect(fired(run({ cart: ["LL-106"], fitzpatrick: "III" }), "R-FITZ-02")).toBe(false);
  });
});

describe("R-FITZ-03 benzoyl peroxide strength on deeper skin tones", () => {
  it("adjusts 5% down to 2.5%", () => {
    const r = run({ cart: ["LL-104"], fitzpatrick: "VI" });
    expect(fired(r, "R-FITZ-03", "LL-104")).toBe(true);
    expect(r.items[0].findings.find((f) => f.ruleId === "R-FITZ-03")?.swapHint).toBe("LL-103");
  });

  it("does not fire on the 2.5% wash", () => {
    expect(fired(run({ cart: ["LL-103"], fitzpatrick: "VI" }), "R-FITZ-03")).toBe(false);
  });
});

describe("R-STACK-01 stacked actives", () => {
  it("adjusts when a retinoid and an acid are both in the cart", () => {
    const r = run({ cart: ["LL-106", "LL-109"] });
    expect(fired(r, "R-STACK-01", "LL-106")).toBe(true);
    expect(fired(r, "R-STACK-01", "LL-109")).toBe(true);
  });

  it("does not fire for one active plus a moisturizer", () => {
    expect(fired(run({ cart: ["LL-106", "LL-114"] }), "R-STACK-01")).toBe(false);
  });
});

describe("R-STACK-02 reported tretinoin plus benzoyl peroxide", () => {
  it("adjusts the benzoyl peroxide", () => {
    const r = run({ cart: ["LL-104"], intake: { currentlyUsing: ["tretinoin"] } });
    expect(fired(r, "R-STACK-02", "LL-104")).toBe(true);
  });

  it("does not fire when tretinoin was not reported", () => {
    expect(fired(run({ cart: ["LL-104"] }), "R-STACK-02")).toBe(false);
  });
});

describe("R-SPF-01 sunscreen alongside actives", () => {
  it("adds plain mineral sunscreen when nothing calls for a tint", () => {
    const r = run({ cart: ["LL-106"], scan: makeScan({ age_spot: 95 }) });
    expect(r.additions).toContainEqual(expect.objectContaining({ sku: "LL-121", ruleId: "R-SPF-01" }));
  });

  it("adds the tinted mineral sunscreen at Fitzpatrick V", () => {
    const r = run({ cart: ["LL-106"], fitzpatrick: "V", scan: makeScan({ age_spot: 95 }) });
    expect(r.additions[0].sku).toBe("LL-122");
  });

  it("adds the tinted mineral sunscreen when the age_spot raw_score is low", () => {
    const r = run({ cart: ["LL-106"], scan: makeScan({ age_spot: 40 }) });
    expect(r.additions[0].sku).toBe("LL-122");
  });

  it("adds nothing when sunscreen is already in the cart", () => {
    expect(run({ cart: ["LL-106", "LL-121"] }).additions).toHaveLength(0);
  });
});

describe("R-SENS-01 reactive skin", () => {
  it("adjusts actives when the redness raw_score is low", () => {
    const r = run({ cart: ["LL-106"], scan: makeScan({ redness: 40 }) });
    expect(fired(r, "R-SENS-01", "LL-106")).toBe(true);
    const finding = r.items[0].findings.find((f) => f.ruleId === "R-SENS-01");
    expect(finding?.trigger).toMatchObject({ kind: "scan", concern: "redness", raw: 40 });
  });

  it("fires on a compound Sensitive skin type label", () => {
    expect(fired(run({ cart: ["LL-106"], scan: makeScan({}, "Dry & Sensitive") }), "R-SENS-01")).toBe(true);
  });

  it("does not fire on a plain Dry label", () => {
    expect(fired(run({ cart: ["LL-106"], scan: makeScan({}, "Dry") }), "R-SENS-01")).toBe(false);
  });

  it("does not fire when redness is healthy", () => {
    expect(fired(run({ cart: ["LL-106"] }), "R-SENS-01")).toBe(false);
  });
});

describe("R-NEED-01 anti-aging with nothing to work on", () => {
  it("calls the peptide cream unnecessary when the wrinkle score is high", () => {
    const r = run({ cart: ["LL-118"], scan: makeScan({ wrinkle: 95 }) });
    expect(verdictOf(r, "LL-118")).toBe("UNNECESSARY");
  });

  it("does not fire when the wrinkle score is low", () => {
    expect(fired(run({ cart: ["LL-118"], scan: makeScan({ wrinkle: 40 }) }), "R-NEED-01")).toBe(false);
  });
});

describe("R-NEED-02 product that contradicts the scan", () => {
  it("calls a mattifying gel unnecessary on dry skin", () => {
    expect(verdictOf(run({ cart: ["LL-116"], scan: makeScan({}, "Dry") }), "LL-116")).toBe("UNNECESSARY");
  });

  it("also matches the compound label the API really returns", () => {
    expect(verdictOf(run({ cart: ["LL-116"], scan: makeScan({}, "Dry & Sensitive") }), "LL-116")).toBe("UNNECESSARY");
  });

  it("does not fire on oily skin", () => {
    expect(fired(run({ cart: ["LL-116"], scan: makeScan({}, "Oily") }), "R-NEED-02")).toBe(false);
  });
});

describe("R-DUP-01 duplicate active classes", () => {
  it("flags two leave-on retinoids", () => {
    const r = run({ cart: ["LL-106", "LL-107"] });
    expect(fired(r, "R-DUP-01", "LL-106")).toBe(true);
    expect(fired(r, "R-DUP-01", "LL-107")).toBe(true);
  });

  it("does not fire on one retinoid plus a moisturizer", () => {
    expect(fired(run({ cart: ["LL-106", "LL-114"] }), "R-DUP-01")).toBe(false);
  });
});

describe("R-REF-01 deep painful bumps or scarring", () => {
  it("refers and keeps only gentle basics", () => {
    const r = run({ cart: ["LL-107", "LL-101", "LL-121"], intake: { symptoms: ["deep_painful_bumps"] } });
    expect(r.referrals.some((f) => f.ruleId === "R-REF-01")).toBe(true);
    expect(verdictOf(r, "LL-107")).toBe("BLOCK");
    expect(verdictOf(r, "LL-101")).not.toBe("BLOCK");
    expect(verdictOf(r, "LL-121")).not.toBe("BLOCK");
  });

  it("does not refer when no symptom was reported", () => {
    expect(run({ cart: ["LL-107"] }).referrals).toHaveLength(0);
  });
});

describe("R-REF-02 flushing with redness and bumps", () => {
  it("refers and holds the acids", () => {
    const r = run({
      cart: ["LL-109"],
      intake: { symptoms: ["flushing", "persistent_redness", "eye_irritation"] },
    });
    expect(r.referrals.some((f) => f.ruleId === "R-REF-02")).toBe(true);
    expect(verdictOf(r, "LL-109")).toBe("BLOCK");
  });

  it("does not fire on flushing alone", () => {
    expect(fired(run({ cart: ["LL-109"], intake: { symptoms: ["flushing"] } }), "R-REF-02")).toBe(false);
  });
});

describe("R-REF-03 changed mole or non-healing sore", () => {
  it("refers with high priority", () => {
    const r = run({ cart: ["LL-101"], intake: { symptoms: ["mole_changed"] } });
    expect(r.referrals.some((f) => f.ruleId === "R-REF-03")).toBe(true);
  });

  it("does not block the gentle cleanser", () => {
    expect(verdictOf(run({ cart: ["LL-101"], intake: { symptoms: ["sore_not_healing"] } }), "LL-101")).toBe("OK");
  });
});

describe("R-REF-04 soft referral", () => {
  it("refers when over-the-counter products have not helped", () => {
    expect(fired(run({ cart: ["LL-101"], intake: { symptoms: ["otc_no_change"] } }), "R-REF-04")).toBe(true);
  });

  it("does not fire with no symptoms", () => {
    expect(fired(run({ cart: ["LL-101"] }), "R-REF-04")).toBe(false);
  });
});

describe("scores trigger questions, never diagnoses", () => {
  it("suggests the acne question when the raw score is low, without referring", () => {
    const r = run({ cart: ["LL-101"], scan: makeScan({ acne: 30 }) });
    expect(r.suggestedQuestions).toContainEqual(
      expect.objectContaining({ ruleId: "R-REF-01", concern: "acne", raw: 30 }),
    );
    expect(r.referrals).toHaveLength(0);
  });
});

describe("decisions never read ui_score or skin_age", () => {
  it("produces identical verdicts when ui_score and skin_age are replaced with nonsense", () => {
    const honest = makeScan({ wrinkle: 95 });
    const flattering: typeof honest = {
      ...honest,
      concerns: Object.fromEntries(
        Object.entries(honest.concerns).map(([k, v]) => [k, { ...v, ui: 1 }]),
      ) as typeof honest.concerns,
      overall: 1,
      skinAge: 99,
    };
    const a = run({ cart: ["LL-118", "LL-106", "LL-109"], scan: honest });
    const b = run({ cart: ["LL-118", "LL-106", "LL-109"], scan: flattering });
    expect(b.items).toStrictEqual(a.items);
    expect(b.additions).toStrictEqual(a.additions);
  });
});

describe("source verification", () => {
  it("leaves no rule unverified", () => {
    const pending = rules.filter((r) => r.verification === "pending").map((r) => r.id);
    expect(pending).toStrictEqual([]);
  });

  it("gives every sourced rule a quote under 25 words and an access date", () => {
    for (const rule of rules) {
      if (rule.source_urls.length === 0) continue;
      expect(rule.source_quote.length, `${rule.id} has no quote`).toBeGreaterThan(0);
      expect(rule.source_quote.split(/\s+/).length, `${rule.id} quote too long`).toBeLessThanOrEqual(25);
      expect(rule.source_accessed, `${rule.id} has no access date`).toBeTruthy();
    }
  });

  it("has a signed-off status on every rule", () => {
    expect(rules.every((r) => r.status === "approved")).toBe(true);
  });
});

describe("verdict precedence", () => {
  it("leads with UNNECESSARY when an item is both unsafe and pointless", () => {
    const r = run({
      cart: ["LL-106"],
      intake: { pregnancy: "pregnant" },
      scan: makeScan({ wrinkle: 95, texture: 95, age_spot: 95 }),
    });
    expect(verdictOf(r, "LL-106")).toBe("UNNECESSARY");
  });

  it("still keeps that item out of the cart and out of the agent's next plan", () => {
    const r = run({
      cart: ["LL-106"],
      intake: { pregnancy: "pregnant" },
      scan: makeScan({ wrinkle: 95, texture: 95, age_spot: 95 }),
    });
    expect(r.blocked).toContain("LL-106");
    expect(r.items[0].findings.some((f) => f.ruleId === "R-PREG-01" && f.verdict === "BLOCK")).toBe(true);
  });
});

describe("sunscreen and basics are never called unnecessary", () => {
  const allHealthy = makeScan({
    acne: 99, redness: 99, oiliness: 99, moisture: 99, age_spot: 99, wrinkle: 99, texture: 99,
  });

  it.each(["LL-121", "LL-122", "LL-123", "LL-101"])(
    "leaves %s alone even when every score is healthy",
    (sku) => {
      expect(verdictOf(run({ cart: [sku], scan: allHealthy }), sku)).not.toBe("UNNECESSARY");
    },
  );

  it("still calls a rich cream out on oily skin", () => {
    expect(verdictOf(run({ cart: ["LL-115"], scan: makeScan({}, "Oily") }), "LL-115")).toBe("UNNECESSARY");
  });
});

describe("R-REF-01 holds the strong actives without over-blocking", () => {
  const referred = { symptoms: ["deep_painful_bumps"] as const };

  it.each(["LL-104", "LL-110", "LL-107", "LL-112"])("holds %s", (sku) => {
    expect(verdictOf(run({ cart: [sku], intake: { symptoms: [...referred.symptoms] } }), sku)).toBe("BLOCK");
  });

  it.each(["LL-101", "LL-114", "LL-121", "LL-116", "LL-111"])("leaves %s available", (sku) => {
    const r = run({ cart: [sku], intake: { symptoms: [...referred.symptoms] } });
    expect(r.items.find((i) => i.sku === sku)?.findings.some((f) => f.ruleId === "R-REF-01")).toBe(false);
  });
});

describe("demo fixtures are paired coherently", () => {
  // These two faces read as men. A pregnancy, trying-to-conceive or
  // breastfeeding scenario pointed at one of them looks like an obvious mistake
  // to anyone who opens it, because it is one.
  const MALE_FACES = ["synthetic-02-acne", "synthetic-07-oily"];
  const GESTATIONAL = ["pregnant", "trying", "breastfeeding"];

  it("never shows a pregnancy or breastfeeding preset on a face that reads as a man", async () => {
    const { PRESETS } = await import("../presets");
    for (const preset of PRESETS) {
      if (preset.intake.pregnancy && GESTATIONAL.includes(preset.intake.pregnancy)) {
        expect(MALE_FACES, `${preset.id} uses ${preset.scanLabel}`).not.toContain(preset.scanLabel);
      }
    }
  });

  it("never pairs a pregnancy or breastfeeding eval scenario with one either", async () => {
    const { readFileSync } = await import("node:fs");
    const { scenarios } = JSON.parse(readFileSync("eval/scenarios.json", "utf8")) as {
      scenarios: Array<{ id: string; scan: string; intake: { pregnancy?: string } }>;
    };
    for (const s of scenarios) {
      if (s.intake.pregnancy && GESTATIONAL.includes(s.intake.pregnancy)) {
        expect(MALE_FACES, `${s.id} uses ${s.scan}`).not.toContain(s.scan);
      }
    }
  });
});
