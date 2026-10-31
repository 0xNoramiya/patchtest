import { loadScanFixture } from "./advise";
import { EMPTY_INTAKE, effectiveFitzpatrick, type Intake } from "./intake";
import { matchCatalogue, parseProductName, type ParsedProduct } from "./match";
import { evaluateFinal } from "./rules/engine";
import { loadCatalog, loadRules, loadThresholds, productBySku, type Product } from "./rules/load";
import type { Verdict } from "./rules/types";
import type { ScanSummary } from "./youcam/parse";
import type { FitzpatrickScale } from "./youcam/types";

/** Longer than this is a page scrape, not a cart. */
export const MAX_ITEMS = 40;

export type CheckCartRequest = {
  items: Array<{ name: string; price?: number; id?: string }>;
  profile?: {
    intake?: Partial<Intake>;
    scanLabel?: string;
    scan?: ScanSummary;
    fitzpatrick?: FitzpatrickScale | null;
  };
};

export type CheckCartItem = {
  input: string;
  sku: string;
  matchedCatalogue: boolean;
  confidence: ParsedProduct["confidence"];
  actives: Product["actives"];
  verdict: Verdict | "UNKNOWN";
  findings: Array<{
    ruleId: string;
    verdict: Verdict;
    message: string;
    /** The rule's swap, resolved against our catalogue: a bare SKU means nothing to a caller. */
    swap: { sku: string; name: string; price: number | null } | null;
    sourceUrls: string[];
    sourceQuote: string | null;
  }>;
};

export type CheckCartResult = {
  items: CheckCartItem[];
  referrals: Array<{ ruleId: string; message: string; sourceUrls: string[] }>;
  scanUsed: { fitzpatrick: FitzpatrickScale | null; source: string } | null;
  /** Anything asked for that could not be honoured. Never left silent. */
  warnings: string[];
  note: string;
};

export const UNREADABLE_NOTE =
  "Items whose title could not be read are returned as UNKNOWN. That is not a safety clearance.";

/** Rules carry a swap as a SKU. Nobody outside this catalogue can read one. */
export function resolveSwap(sku: string | undefined): CheckCartItem["findings"][number]["swap"] {
  if (!sku) return null;
  const product = productBySku(loadCatalog(), sku);
  return product
    ? { sku, name: product.name, price: product.price }
    : { sku, name: sku, price: null };
}

/** Shared by the HTTP route and the MCP tool, so one bad shape reads the same in both. */
export function validateCheckCart(body: unknown): { error: string } | { value: CheckCartRequest } {
  if (typeof body !== "object" || body === null) return { error: "Expected a JSON object" };
  const req = body as CheckCartRequest;
  if (!Array.isArray(req.items) || req.items.length === 0) {
    return { error: "items is required and must be a non-empty array of product titles" };
  }
  if (req.items.some((item) => typeof item?.name !== "string" || item.name.trim() === "")) {
    return { error: "every item needs a non-empty name" };
  }
  return { value: req };
}

/**
 * Judges a cart from any shop. Product titles are parsed into active classes and
 * percentages, which is what the rules key on, so the same engine that runs the
 * site runs here. Titles it cannot read produce no verdict, and the result says
 * so rather than implying the item was cleared.
 */
export async function checkCart(req: CheckCartRequest): Promise<CheckCartResult> {
  const warnings: string[] = [];
  const catalog = loadCatalog();
  const intake: Intake = { ...EMPTY_INTAKE, ...req.profile?.intake };

  let scan: ScanSummary | null = req.profile?.scan ?? null;
  if (!scan && req.profile?.scanLabel) {
    try {
      scan = (await loadScanFixture(req.profile.scanLabel)).summary;
    } catch {
      scan = null;
      warnings.push(
        `No recorded scan called "${req.profile.scanLabel}". Judged without scan scores, so no rule ` +
          `that keys on a measurement could fire. Call list_scans for the labels that exist.`,
      );
    }
  }

  const fitz = effectiveFitzpatrick(intake, req.profile?.fitzpatrick ?? scan?.fitzpatrick ?? null);

  if (req.items.length > MAX_ITEMS) {
    warnings.push(`Only the first ${MAX_ITEMS} of ${req.items.length} items were judged.`);
  }

  // Our own products keep their real data. Everything else is read off the title.
  const parsed: Array<{ product: Product; parsed: ParsedProduct | null; input: string }> = req.items
    .slice(0, MAX_ITEMS)
    .map((item) => {
      const known = matchCatalogue(item.name, catalog.products);
      if (known) return { product: known, parsed: null, input: item.name };
      const p = parseProductName(item.name, item.price ?? 0, item.id);
      return { product: p, parsed: p, input: item.name };
    });

  const ephemeralCatalog = {
    ...catalog,
    products: [...catalog.products, ...parsed.filter((p) => p.parsed).map((p) => p.product)],
  };

  const evaluation = evaluateFinal({
    intake,
    scan,
    cart: parsed.map((p) => p.product.sku),
    catalog: ephemeralCatalog,
    rules: loadRules(),
    thresholds: loadThresholds(),
    fitzpatrick: fitz.value,
  });

  const items: CheckCartItem[] = parsed.map((entry) => {
    const result = evaluation.items.find((i) => i.sku === entry.product.sku);
    const readable = entry.parsed ? entry.parsed.confidence !== "low" : true;
    return {
      input: entry.input,
      sku: entry.product.sku,
      matchedCatalogue: entry.parsed === null,
      confidence: entry.parsed?.confidence ?? "high",
      actives: entry.product.actives,
      verdict: readable ? (result?.verdict ?? "OK") : "UNKNOWN",
      findings: (result?.findings ?? []).map((f) => ({
        ruleId: f.ruleId,
        verdict: f.verdict,
        message: f.message,
        swap: resolveSwap(f.swapHint),
        sourceUrls: f.sourceUrls,
        sourceQuote: f.sourceQuote ?? null,
      })),
    };
  });

  return {
    items,
    referrals: evaluation.referrals.map((r) => ({
      ruleId: r.ruleId,
      message: r.message,
      sourceUrls: r.sourceUrls,
    })),
    scanUsed: scan ? { fitzpatrick: fitz.value, source: fitz.source } : null,
    warnings,
    note: UNREADABLE_NOTE,
  };
}
