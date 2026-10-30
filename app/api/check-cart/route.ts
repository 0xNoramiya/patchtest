import { NextResponse } from "next/server";
import { loadScanFixture } from "@/lib/advise";
import { EMPTY_INTAKE, effectiveFitzpatrick, type Intake } from "@/lib/intake";
import { matchCatalogue, parseProductName, type ParsedProduct } from "@/lib/match";
import { evaluate } from "@/lib/rules/engine";
import { loadCatalog, loadRules, loadThresholds, type Product } from "@/lib/rules/load";
import type { ScanSummary } from "@/lib/youcam/parse";
import type { FitzpatrickScale } from "@/lib/youcam/types";

export const dynamic = "force-dynamic";

type CheckCartRequest = {
  items: Array<{ name: string; price?: number; id?: string }>;
  profile?: {
    intake?: Partial<Intake>;
    scanLabel?: string;
    scan?: ScanSummary;
    fitzpatrick?: FitzpatrickScale | null;
  };
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Judges a cart from any shop. Product titles are parsed into active classes and
 * percentages, which is what the rules key on, so the same engine that runs the
 * site runs here. Titles it cannot read produce no verdict, and the response
 * says so rather than implying the item was cleared.
 */
export async function POST(request: Request) {
  let body: CheckCartRequest;
  try {
    body = (await request.json()) as CheckCartRequest;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400, headers: CORS });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items is required" }, { status: 400, headers: CORS });
  }

  const catalog = loadCatalog();
  const intake: Intake = { ...EMPTY_INTAKE, ...body.profile?.intake };

  let scan: ScanSummary | null = body.profile?.scan ?? null;
  if (!scan && body.profile?.scanLabel) {
    try {
      scan = (await loadScanFixture(body.profile.scanLabel)).summary;
    } catch {
      scan = null;
    }
  }

  const fitz = effectiveFitzpatrick(intake, body.profile?.fitzpatrick ?? scan?.fitzpatrick ?? null);

  // Our own products keep their real data. Everything else is read off the title.
  const parsed: Array<{ product: Product; parsed: ParsedProduct | null; input: string }> = body.items
    .slice(0, 40)
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

  const evaluation = evaluate({
    intake,
    scan,
    cart: parsed.map((p) => p.product.sku),
    catalog: ephemeralCatalog,
    rules: loadRules(),
    thresholds: loadThresholds(),
    fitzpatrick: fitz.value,
  });

  const items = parsed.map((entry) => {
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
        sourceUrls: f.sourceUrls,
        sourceQuote: f.sourceQuote ?? null,
      })),
    };
  });

  return NextResponse.json(
    {
      items,
      referrals: evaluation.referrals.map((r) => ({
        ruleId: r.ruleId,
        message: r.message,
        sourceUrls: r.sourceUrls,
      })),
      scanUsed: scan ? { fitzpatrick: fitz.value, source: fitz.source } : null,
      note: "Items whose title could not be read are returned as UNKNOWN. That is not a safety clearance.",
    },
    { headers: CORS },
  );
}
