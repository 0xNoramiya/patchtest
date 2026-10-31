import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { sanitizeClaims } from "../claims";
import type { Intake } from "../intake";
import { evaluate, evaluateFinal } from "../rules/engine";
import type { Catalog, Product, Thresholds } from "../rules/load";
import { productBySku } from "../rules/load";
import type { Rule } from "../rules/types";
import type { ScanSummary } from "../youcam/parse";
import { buildRevisionPrompt, buildUserPrompt, SYSTEM_PROMPT } from "./prompts";
import { promptKey, readRecorded, record } from "./replay";
import { proposedCartSchema, type AgentArm, type AgentResult, type AgentRound, type ProposedCart } from "./types";

export const AGENT_MODEL = "claude-sonnet-5-5";
export const MAX_REVISION_ROUNDS = 2;

export type AgentInput = {
  scan: ScanSummary | null;
  intake: Intake;
  catalog: Catalog;
  rules: Rule[];
  thresholds: Thresholds;
  fitzpatrick: string | null;
  /** replay serves recorded answers so the deployed demo works without a key. */
  mode: "live" | "replay";
  label?: string;
  /** Which repeat of this scenario this is. Keeps repeat runs from sharing a cache entry. */
  run?: number;
};

async function propose(
  system: string,
  user: string,
  mode: "live" | "replay",
  meta: { label?: string; run: number },
): Promise<{ cart: ProposedCart; source: "live" | "replay" }> {
  // The run index is part of the key so that repeat runs are genuinely repeated
  // calls rather than the same cached answer counted three times. The arm is
  // not part of the key: the guarded arm's first proposal is the same prompt as
  // the baseline's, so both arms start from the identical cart and the only
  // difference between them is the guardrail.
  const key = promptKey(system, user, `${AGENT_MODEL}#${meta.run}`);
  const recorded = await readRecorded(key);
  if (recorded) return { cart: recorded, source: "replay" };

  if (mode === "replay") {
    throw new Error(
      `No recorded agent response for this input (key ${key}). Run the eval in live mode to record it.`,
    );
  }

  const { output } = await generateText({
    model: anthropic(AGENT_MODEL),
    output: Output.object({ schema: proposedCartSchema }),
    system,
    prompt: user,
  });
  await record(key, { model: AGENT_MODEL, label: meta.label, run: meta.run }, output);
  return { cart: output, source: "live" };
}

/** Drops anything the model invented and anything it listed twice. */
function realSkus(cart: ProposedCart, catalog: Catalog): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of cart.items) {
    const product = productBySku(catalog, item.sku);
    if (product && !seen.has(product.sku)) {
      seen.add(product.sku);
      out.push(product.sku);
    }
  }
  return out;
}

function violationsFor(
  skus: string[],
  evaluation: ReturnType<typeof evaluate>,
  catalog: Catalog,
): Array<{ sku: string; name: string; reasons: string[] }> {
  return evaluation.items
    .filter((item) => item.findings.some((f) => f.verdict === "BLOCK"))
    .map((item) => ({
      sku: item.sku,
      name: (productBySku(catalog, item.sku) as Product).name,
      reasons: item.findings.filter((f) => f.verdict === "BLOCK").map((f) => f.message),
    }))
    .filter((v) => skus.includes(v.sku));
}

/**
 * The guarded arm. The model proposes, the engine decides, violations go back,
 * and the engine always has the last word. The model never sets a verdict.
 */
export async function runGuardedAgent(input: AgentInput): Promise<AgentResult & { evaluation: ReturnType<typeof evaluate> }> {
  const system = SYSTEM_PROMPT;
  const baseUser = buildUserPrompt(input);
  const rounds: AgentRound[] = [];
  let source: "live" | "replay" = "replay";
  let user = baseUser;
  let cart: string[] = [];
  let routineNote = "";
  let claimsFiltered = false;
  let evaluation = evaluate({ ...input, cart: [] });

  for (let round = 0; round <= MAX_REVISION_ROUNDS; round += 1) {
    const { cart: proposed, source: s } = await propose(system, user, input.mode, { label: input.label, run: input.run ?? 0 });
    if (s === "live") source = "live";

    const clean = sanitizeClaims(proposed.routine_note);
    if (clean.changed) claimsFiltered = true;
    routineNote = clean.text;

    cart = realSkus(proposed, input.catalog);
    evaluation = evaluate({ ...input, cart });
    const violations = violationsFor(cart, evaluation, input.catalog);

    rounds.push({ round, proposed, blocked: violations.map((v) => v.sku) });

    if (violations.length === 0 || round === MAX_REVISION_ROUNDS) break;
    const feedback = buildRevisionPrompt(violations);
    rounds[rounds.length - 1].feedback = feedback;
    user = `${baseUser}\n\nYou proposed: ${cart.join(", ")}\n\n${feedback}`;
  }

  // The engine, not the model, has the last word. Anything still carrying a
  // BLOCK finding after the final round comes out, and additions go in.
  const finalCart = [
    ...cart.filter((sku) => !evaluation.blocked.includes(sku)),
    ...evaluation.additions.map((a) => a.sku),
  ];
  const finalEvaluation = evaluateFinal({ ...input, cart: finalCart });

  return {
    arm: "guarded",
    finalCart,
    rounds,
    revisionRounds: Math.max(0, rounds.length - 1),
    routineNote,
    claimsFiltered,
    source,
    evaluation: finalEvaluation,
  };
}

/**
 * The baseline. Identical model, identical prompt, identical inputs. The only
 * thing missing is the guardrail. Whatever it proposes is what it would sell.
 */
export async function runBaselineAgent(input: AgentInput): Promise<AgentResult> {
  const system = SYSTEM_PROMPT;
  const user = buildUserPrompt(input);
  const { cart: proposed, source } = await propose(system, user, input.mode, { label: input.label, run: input.run ?? 0 });
  const clean = sanitizeClaims(proposed.routine_note);

  return {
    arm: "baseline",
    finalCart: realSkus(proposed, input.catalog),
    rounds: [{ round: 0, proposed, blocked: [] }],
    revisionRounds: 0,
    routineNote: clean.text,
    claimsFiltered: clean.changed,
    source,
  };
}

export type { AgentArm };
