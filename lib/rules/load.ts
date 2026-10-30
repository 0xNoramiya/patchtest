import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { ruleFileSchema, thresholdFileSchema, type Rule } from "./types";

export type Product = {
  sku: string;
  name: string;
  price: number;
  blurb: string;
  targets: string[];
  actives: Array<{ class: string; name?: string; pct?: number }>;
  leave_on: boolean;
  area: string;
  tags: string[];
};

export type Catalog = { store: string; currency: string; products: Product[] };

export type Thresholds = {
  values: Record<string, number>;
  healthyByConcern: Record<string, number>;
  skinTypeContradictions: Record<string, string[]>;
};

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

let rulesCache: Rule[] | null = null;
let catalogCache: Catalog | null = null;
let thresholdCache: Thresholds | null = null;

export function loadRules(): Rule[] {
  if (!rulesCache) {
    rulesCache = ruleFileSchema.parse(parse(read("rules/rules.yaml"))).rules;
  }
  return rulesCache;
}

export function loadCatalog(): Catalog {
  if (!catalogCache) {
    catalogCache = JSON.parse(read("data/catalog.json")) as Catalog;
  }
  return catalogCache;
}

export function loadThresholds(): Thresholds {
  if (thresholdCache) return thresholdCache;
  const parsed = thresholdFileSchema.parse(JSON.parse(read("rules/thresholds.json")));

  const values: Record<string, number> = {};
  for (const [key, entry] of Object.entries(parsed.thresholds)) values[key] = entry.value;
  // The one threshold the brief makes configurable at deploy time.
  if (process.env.HIGH_ACID_PCT) values.HIGH_ACID_PCT = Number(process.env.HIGH_ACID_PCT);

  const healthyByConcern: Record<string, number> = {};
  for (const [key, value] of Object.entries(parsed.healthy_by_concern)) {
    if (typeof value === "number") healthyByConcern[key] = value;
  }

  const skinTypeContradictions: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(parsed.skin_type_contradictions)) {
    if (Array.isArray(value)) skinTypeContradictions[key] = value;
  }

  thresholdCache = { values, healthyByConcern, skinTypeContradictions };
  return thresholdCache;
}

export function productBySku(catalog: Catalog, sku: string): Product | undefined {
  return catalog.products.find((p) => p.sku === sku);
}

/** Test seam: drops the memoised files so a test can swap them out. */
export function resetRuleCaches(): void {
  rulesCache = null;
  catalogCache = null;
  thresholdCache = null;
}
