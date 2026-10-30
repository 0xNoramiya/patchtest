import { describe, expect, it } from "vitest";
import { matchCatalogue, parseProductName } from "./match";
import { loadCatalog } from "./rules/load";

const classesOf = (name: string) => parseProductName(name).actives.map((a) => a.class).sort();
const pctOf = (name: string, cls: string) =>
  parseProductName(name).actives.find((a) => a.class === cls)?.pct;

describe("reading an active out of a product title", () => {
  it.each([
    ["Retinol 0.5% Night Serum", ["retinoid"]],
    ["Adapalene Gel 0.1% Acne Treatment", ["retinoid"]],
    ["Salicylic Acid 2% Exfoliating Cleanser", ["bha"]],
    ["Benzoyl Peroxide 5% Acne Wash", ["bpo"]],
    ["Glycolic Acid 7% Toning Solution", ["aha"]],
    ["Niacinamide 10% + Zinc 1%", ["niacinamide"]],
    ["Azelaic Acid Suspension 10%", ["azelaic"]],
    ["Vitamin C 15% Brightening Serum", ["vitamin_c"]],
    ["Mineral Sunscreen SPF 50", ["sunscreen"]],
    ["Facial Wax Strips", ["hair_removal"]],
  ])("reads %s", (name, expected) => {
    expect(classesOf(name)).toStrictEqual(expected.sort());
  });

  it("ties each percentage to its own ingredient", () => {
    const name = "AHA 30% + BHA 2% Peeling Solution";
    expect(pctOf(name, "aha")).toBe(30);
    expect(pctOf(name, "bha")).toBe(2);
  });

  it("reads a percentage that comes before the ingredient", () => {
    expect(pctOf("2% Salicylic Acid Cleanser", "bha")).toBe(2);
  });

  it("finds both actives in a combination product", () => {
    expect(classesOf("Retinol and Vitamin C Night Treatment")).toStrictEqual(["retinoid", "vitamin_c"]);
  });
});

describe("rinse-off, area and tags", () => {
  it("marks a cleanser as rinse-off", () => {
    expect(parseProductName("Salicylic Acid 2% Cleanser").leave_on).toBe(false);
  });

  it("marks a serum as leave-on", () => {
    expect(parseProductName("Retinol 1% Serum").leave_on).toBe(true);
  });

  it("spots a body product", () => {
    expect(parseProductName("Salicylic Acid Body Spray for Back and Chest").area).toBe("chest");
  });

  it("tags a strong at-home peel", () => {
    const p = parseProductName("AHA 30% + BHA 2% Peeling Solution");
    expect(p.tags).toContain("at_home_peel");
    expect(p.tags).toContain("high_strength");
  });

  it("tags an anti-aging product", () => {
    expect(parseProductName("Advanced Anti-Aging Firming Cream").tags).toContain("anti_aging");
  });
});

describe("confidence is honest about what it could read", () => {
  it("is high when it has an active and a strength", () => {
    expect(parseProductName("Retinol 0.5% Serum").confidence).toBe("high");
  });

  it("is medium when it has an active but no strength", () => {
    expect(parseProductName("Retinol Night Serum").confidence).toBe("medium");
  });

  it("is low when it reads nothing", () => {
    const p = parseProductName("Daily Glow Elixir");
    expect(p.confidence).toBe("low");
    expect(p.actives).toStrictEqual([]);
  });
});

describe("matching our own catalogue", () => {
  it("finds the real product when the title is ours", () => {
    const products = loadCatalog().products;
    expect(matchCatalogue("10-Minute Renewal Peel, 30% AHA + 2% BHA", products)?.sku).toBe("LL-110");
  });

  it("returns nothing for a title from another shop", () => {
    expect(matchCatalogue("Some Other Brand Night Oil", loadCatalog().products)).toBeUndefined();
  });
});

describe("the parser feeds the same rules the app uses", () => {
  it("produces a retinoid that the pregnancy rule would catch", () => {
    const p = parseProductName("Retinol 0.5% Night Serum");
    expect(p.actives.some((a) => a.class === "retinoid")).toBe(true);
    expect(p.leave_on).toBe(true);
  });
});
