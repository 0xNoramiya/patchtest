import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { checkCart, resolveSwap, validateCheckCart, MAX_ITEMS, type CheckCartRequest } from "../check-cart";
import {
  AGE_BANDS,
  ISOTRETINOIN_STATUSES,
  PREGNANCY_STATUSES,
  RECENT_PROCEDURES,
  REPORTED_PRODUCTS,
  SYMPTOMS,
  type Intake,
} from "../intake";
import { PRESETS } from "../presets";
import { loadRules, loadThresholds } from "../rules/load";
import { VERDICTS } from "../rules/types";
import type { ScanSummary } from "../youcam/parse";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<ToolResult>;
};

const text = (...lines: string[]): ToolResult["content"] => [{ type: "text", text: lines.join("\n") }];
const failure = (message: string): ToolResult => ({ content: text(message), isError: true });

const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });

/**
 * The declared intake, as JSON Schema. Generated from the same constants the
 * engine reads, so a value an agent can send is a value a rule can match.
 */
const intakeSchema = {
  type: "object",
  description:
    "What the shopper declared about themselves. Everything here is self-reported; none of it is " +
    "read off a photo. Age gating in particular comes only from ageBand, never from a face.",
  properties: {
    ageBand: { ...enumOf(AGE_BANDS), description: "Declared age band. Defaults to 18_plus." },
    pregnancy: { ...enumOf(PREGNANCY_STATUSES), description: "Defaults to none." },
    isotretinoin: {
      ...enumOf(ISOTRETINOIN_STATUSES),
      description: "Oral isotretinoin, now or stopped within six months. Defaults to no.",
    },
    currentlyUsing: {
      type: "array",
      items: enumOf(REPORTED_PRODUCTS),
      description: "Actives the shopper is already on, which change what is safe to add.",
    },
    recentProcedures: { type: "array", items: enumOf(RECENT_PROCEDURES) },
    symptoms: {
      type: "array",
      items: enumOf(SYMPTOMS),
      description: "Self-reported signs. Some of these produce a referral rather than a product.",
    },
    goal: { type: "string", description: "What the shopper said they want, in their own words." },
  },
  additionalProperties: false,
} as const;

const findingSchema = {
  type: "object",
  properties: {
    ruleId: { type: "string" },
    verdict: enumOf(VERDICTS),
    message: { type: "string" },
    swap: {
      type: ["object", "null"],
      properties: { sku: { type: "string" }, name: { type: "string" }, price: { type: ["number", "null"] } },
      required: ["sku", "name"],
    },
    sourceUrls: { type: "array", items: { type: "string" } },
    sourceQuote: { type: ["string", "null"] },
  },
  required: ["ruleId", "verdict", "message", "sourceUrls"],
} as const;

const VERDICT_MEANING: Record<string, string> = {
  BLOCK: "Not for you right now. Unsafe given what the shopper declared or the scan measured",
  ADJUST: "Fine with a change: lower strength, alternate nights, add sunscreen",
  UNNECESSARY: "Nothing for it to do, on this skin or at this age",
  REFER: "Worth showing a professional rather than solving by shopping",
  ADD: "The rules inject this SKU because the routine needs it",
  OK: "No rule fired",
  UNKNOWN: "The title could not be parsed. NOT a safety clearance",
};

const checkCartTool: ToolDefinition = {
  name: "check_cart",
  title: "Check a skincare cart",
  description:
    "Judge a skincare cart before checkout and return a cited verdict for every item. Call this " +
    "before recommending, adding or buying any skincare product.\n\n" +
    "Each item comes back as one of: BLOCK (not for you right now), ADJUST (fine with a change), " +
    "UNNECESSARY (nothing for it to do), REFER (worth showing a professional), OK (no rule fired), " +
    "or UNKNOWN. Every verdict carries the rule id, a 25-word quote from the source behind it and " +
    "the source URL, so you can show the shopper why rather than asserting it.\n\n" +
    "Two things to know. UNKNOWN means the product title did not name an active ingredient or a " +
    "strength, so no rule could be applied. It is not a clearance, and you must not present it as " +
    "one. And the verdicts come from a deterministic rules engine, not from a language model: they " +
    "are not advice you should rewrite, soften or overrule.\n\n" +
    "Product titles are parsed for active ingredients and percentages, so pass titles as the shop " +
    "writes them ('Retinol 0.3% Night Serum'), not your own paraphrase.",
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 1,
        maxItems: MAX_ITEMS,
        description: "The cart. Any shop's products; they do not have to be ours.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "The product title, as the shop writes it." },
            price: { type: "number", description: "Optional. Only used for the cart total." },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      intake: intakeSchema,
      scanLabel: {
        type: "string",
        description:
          "Optional. A recorded YouCam skin scan to judge against; call list_scans for the labels " +
          "that exist. Without one, no rule that keys on a measurement can fire.",
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            input: { type: "string" },
            sku: { type: "string" },
            verdict: enumOf([...VERDICTS, "UNKNOWN"]),
            matchedCatalogue: { type: "boolean" },
            confidence: enumOf(["high", "medium", "low"]),
            findings: { type: "array", items: findingSchema },
          },
          required: ["input", "sku", "verdict", "findings"],
        },
      },
      referrals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ruleId: { type: "string" },
            message: { type: "string" },
            sourceUrls: { type: "array", items: { type: "string" } },
          },
          required: ["ruleId", "message", "sourceUrls"],
        },
      },
      warnings: { type: "array", items: { type: "string" } },
      note: { type: "string" },
    },
    required: ["items", "referrals", "warnings", "note"],
  },
  async run(args) {
    const request: CheckCartRequest = {
      items: (args.items as CheckCartRequest["items"]) ?? [],
      profile: {
        intake: (args.intake as Partial<Intake>) ?? {},
        scanLabel: typeof args.scanLabel === "string" ? args.scanLabel : undefined,
      },
    };
    const parsed = validateCheckCart(request);
    if ("error" in parsed) return failure(parsed.error);

    const result = await checkCart(parsed.value);

    const lines = [`${result.items.length} item(s) judged.`, ""];
    for (const item of result.items) {
      lines.push(`${item.verdict}  ${item.input}`);
      lines.push(`  ${VERDICT_MEANING[item.verdict] ?? item.verdict}`);
      for (const f of item.findings) {
        lines.push(`  [${f.ruleId}] ${f.verdict}: ${f.message}`);
        if (f.swap) {
          const price = f.swap.price === null ? "" : ` ($${f.swap.price})`;
          lines.push(`    instead: ${f.swap.name}${price} [${f.swap.sku}]`);
        }
        if (f.sourceQuote) lines.push(`    source says: "${f.sourceQuote}"`);
        for (const url of f.sourceUrls) lines.push(`    ${url}`);
      }
      lines.push("");
    }
    for (const r of result.referrals) {
      lines.push(`REFER [${r.ruleId}] ${r.message}`);
    }
    if (result.referrals.length) lines.push("");
    for (const w of result.warnings) lines.push(`warning: ${w}`);
    lines.push(result.note);

    return {
      content: [
        { type: "text", text: lines.join("\n") },
        { type: "text", text: JSON.stringify(result) },
      ],
      structuredContent: result,
    };
  },
};

const listRulesTool: ToolDefinition = {
  name: "list_rules",
  title: "List the rules",
  description:
    "The full rule corpus check_cart decides with: every rule's id, verdict, message, evidence " +
    "class, source URL, a quote of 25 words or fewer from that source, and the date it was read. " +
    "Use it to show a shopper the basis for a verdict, or to see what is and is not covered. The " +
    "corpus is finite, and a cart with no findings means no rule matched, not that it was cleared.",
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: {
    type: "object",
    properties: {
      verdict: { ...enumOf(VERDICTS), description: "Only rules producing this verdict." },
      id: { type: "string", description: "One rule, by id (for example R-PREG-01)." },
    },
    additionalProperties: false,
  },
  async run(args) {
    const wantVerdict = typeof args.verdict === "string" ? args.verdict : null;
    const wantId = typeof args.id === "string" ? args.id.toUpperCase() : null;

    // The same set evaluate() uses: everything except retired.
    const live = loadRules().filter((r) => r.status !== "retired");
    const rules = live.filter(
      (r) => (!wantVerdict || r.verdict === wantVerdict) && (!wantId || r.id.toUpperCase() === wantId),
    );
    if (!rules.length) {
      return failure(
        `No rule matched. ${live.length} rules are in force; ids look like R-PREG-01. ` +
          `Call list_rules with no arguments to see them all.`,
      );
    }

    const shaped = rules.map((r) => ({
      id: r.id,
      verdict: r.verdict,
      scope: r.scope,
      message: r.message,
      swap: resolveSwap(r.swap_hint),
      evidence: r.evidence,
      sourceUrls: r.source_urls,
      sourceQuote: r.source_quote || null,
      sourceAccessed: r.source_accessed ?? null,
      verification: r.verification,
      notes: r.notes ?? null,
    }));

    const lines = [`${rules.length} of ${live.length} rules in force.`, ""];
    for (const r of shaped) {
      lines.push(`${r.id}  ${r.verdict}  (${r.scope}, evidence: ${r.evidence}, ${r.verification})`);
      lines.push(`  ${r.message}`);
      if (r.swap) lines.push(`  instead: ${r.swap.name} [${r.swap.sku}]`);
      if (r.sourceQuote) lines.push(`  source says: "${r.sourceQuote}"`);
      for (const url of r.sourceUrls) lines.push(`  ${url}${r.sourceAccessed ? ` (read ${r.sourceAccessed})` : ""}`);
      if (r.notes) lines.push(`  caveat: ${r.notes}`);
      lines.push("");
    }

    return { content: text(...lines), structuredContent: { rules: shaped, inForce: live.length } };
  },
};

/** The concerns worth naming for a scan: the ones measured below their healthy mark. */
function belowHealthy(summary: ScanSummary, healthy: Record<string, number>) {
  return Object.entries(summary.concerns)
    .flatMap(([concern, score]) => {
      const mark = healthy[concern];
      if (!score || mark === undefined || score.raw >= mark) return [];
      return [{ concern, raw: Math.round(score.raw * 10) / 10, ui: score.ui, healthy: mark }];
    })
    .sort((a, b) => a.raw - b.raw);
}

const listScansTool: ToolDefinition = {
  name: "list_scans",
  title: "List the recorded skin scans",
  description:
    "The recorded YouCam skin scans a check_cart call can be judged against, by label. Each was " +
    "really run through the YouCam AI Skin Analysis and AI Fitzpatrick Skin Type APIs on an " +
    "AI-generated face, and replays for free.\n\n" +
    "Each concern carries two numbers because the API returns two: ui is the display score, " +
    "documented as a motivator, and raw is the measurement. The rules decide on raw only. Show a " +
    "shopper ui if you like, but do not reason from it.",
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: { type: "object", additionalProperties: false },
  async run() {
    const dir = path.join(process.cwd(), "fixtures/scans");
    const labels = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    const healthy = loadThresholds().healthyByConcern;

    const scans = [];
    for (const label of labels) {
      const raw = JSON.parse(await readFile(path.join(dir, label, "fixture.json"), "utf8")) as {
        summary: ScanSummary;
      };
      const preset = PRESETS.find((p) => p.scanLabel === label);
      scans.push({
        label,
        fitzpatrick: raw.summary.fitzpatrick,
        skinType: raw.summary.skinType.whole ?? null,
        concernsBelowHealthy: belowHealthy(raw.summary, healthy),
        usedByPreset: preset ? preset.title : null,
      });
    }

    const lines = [`${scans.length} recorded scans.`, ""];
    for (const s of scans) {
      lines.push(`${s.label}  Fitzpatrick ${s.fitzpatrick ?? "unknown"}${s.skinType ? `, ${s.skinType}` : ""}`);
      if (s.usedByPreset) lines.push(`  demo preset: ${s.usedByPreset}`);
      if (s.concernsBelowHealthy.length) {
        for (const c of s.concernsBelowHealthy) {
          lines.push(`  ${c.concern}: raw ${c.raw} (below ${c.healthy}), ui shows ${c.ui}`);
        }
      } else {
        lines.push("  nothing measured below its healthy mark");
      }
      lines.push("");
    }

    return { content: text(...lines), structuredContent: { scans } };
  },
};

/** Deterministic order, so a client can cache the list. */
export const TOOLS: ToolDefinition[] = [checkCartTool, listRulesTool, listScansTool];

export function toolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}
