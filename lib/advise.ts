import { readFile } from "node:fs/promises";
import path from "node:path";
import { runBaselineAgent, runGuardedAgent } from "./agent/run";
import { config, hasSecret } from "./env";
import { EMPTY_INTAKE, effectiveFitzpatrick, type Intake } from "./intake";
import { evaluate } from "./rules/engine";
import { loadCatalog, loadRules, loadThresholds, productBySku, type Product } from "./rules/load";
import type { Evaluation } from "./rules/types";
import type { ScanSummary } from "./youcam/parse";

export type AdviseRequest = {
  scanLabel: string;
  intake: Partial<Intake>;
  /** SKUs the shopper put in their cart themselves. */
  wantedSkus?: string[];
  mode?: "live" | "replay";
};

export type CartLine = {
  sku: string;
  product: Product;
  /** Did the shopper add it, or did we suggest it? */
  origin: "shopper" | "suggested" | "added_by_rule";
  agentReason?: string;
};

export type AdviseResult = {
  scanLabel: string;
  scan: ScanSummary;
  maskPaths: Record<string, string>;
  imagePath: string;
  fitzpatrick: { value: string | null; source: "self_reported" | "api" | "none" };
  lines: CartLine[];
  evaluation: Evaluation;
  routineNote: string;
  revisionRounds: number;
  claimsFiltered: boolean;
  source: "live" | "replay";
  baseline: { skus: string[]; routineNote: string; reasons: Record<string, string> };
  /** Minimal lookup so the client can resolve swap hints and baseline skus. */
  catalogIndex: Record<string, { name: string; price: number }>;
};

export async function loadScanFixture(
  label: string,
): Promise<{ summary: ScanSummary; maskPaths: Record<string, string>; imagePath: string }> {
  const raw = JSON.parse(
    await readFile(path.join(process.cwd(), "fixtures", "scans", label, "fixture.json"), "utf8"),
  ) as { summary: ScanSummary; local_masks?: Record<string, string[]> };

  // The signed mask URLs YouCam returned expired two hours after the scan. These
  // are the files we downloaded at scan time and committed next to the scores.
  const maskPaths: Record<string, string> = {};
  for (const [key, files] of Object.entries(raw.local_masks ?? {})) {
    const file = files[0];
    if (file) maskPaths[key.replace(/:whole$/, "")] = `/api/fixture/scans/${label}/${file}`;
  }

  return {
    summary: raw.summary,
    maskPaths,
    imagePath: `/api/fixture/scans/${label}/input.jpg`,
  };
}

/**
 * The whole pipeline for one shopper.
 *
 * The engine evaluates what the shopper actually put in their cart as well as
 * what the agent proposed. That matters: if the agent quietly drops the thing
 * the shopper asked for, they never learn why. Every item they added gets a
 * verdict and a reason, even when the answer is no.
 */
export async function advise(req: AdviseRequest): Promise<AdviseResult> {
  const { summary: scan, maskPaths, imagePath } = await loadScanFixture(req.scanLabel);
  const intake: Intake = { ...EMPTY_INTAKE, ...req.intake };
  const catalog = loadCatalog();
  const fitz = effectiveFitzpatrick(intake, scan.fitzpatrick);

  const input = {
    scan,
    intake,
    catalog,
    rules: loadRules(),
    thresholds: loadThresholds(),
    fitzpatrick: fitz.value,
    // Scans and model calls are budgeted separately. A scan costs 22 units of a
    // fixed allowance, so it defaults to replay. A model call costs cents, so it
    // runs live whenever a key is present and falls back to recorded answers when
    // it is not. That is what lets the demo presets work with no keys at all
    // while an arbitrary intake still gets a real answer.
    mode: req.mode ?? (hasSecret("ANTHROPIC_API_KEY") ? "live" : "replay"),
    label: `advise-${req.scanLabel}`,
    run: 0,
  };

  const [guarded, baseline] = await Promise.all([runGuardedAgent(input), runBaselineAgent(input)]);

  const wanted = (req.wantedSkus ?? []).filter((sku) => productBySku(catalog, sku));
  const addedByRule = new Set(guarded.evaluation.additions.map((a) => a.sku));

  const order = [...new Set([...wanted, ...guarded.finalCart])];
  const agentReasons = new Map(
    guarded.rounds.at(-1)?.proposed.items.map((i) => [i.sku, i.reason]) ?? [],
  );

  const lines: CartLine[] = order.map((sku) => ({
    sku,
    product: productBySku(catalog, sku) as Product,
    origin: wanted.includes(sku) ? "shopper" : addedByRule.has(sku) ? "added_by_rule" : "suggested",
    agentReason: agentReasons.get(sku),
  }));

  // One evaluation over everything the shopper will see.
  const evaluation = evaluate({ ...input, cart: lines.map((l) => l.sku) });

  return {
    scanLabel: req.scanLabel,
    scan,
    maskPaths,
    imagePath,
    fitzpatrick: fitz,
    lines,
    evaluation,
    routineNote: guarded.routineNote,
    revisionRounds: guarded.revisionRounds,
    claimsFiltered: guarded.claimsFiltered,
    source: guarded.source === "live" || baseline.source === "live" ? "live" : "replay",
    baseline: {
      skus: baseline.finalCart,
      routineNote: baseline.routineNote,
      reasons: Object.fromEntries(
        baseline.rounds[0].proposed.items.map((i) => [i.sku, i.reason]),
      ),
    },
    catalogIndex: Object.fromEntries(
      catalog.products.map((p) => [p.sku, { name: p.name, price: p.price }]),
    ),
  };
}
