/**
 * Runs one scenario through both arms so the loop can be eyeballed.
 *   pnpm agent <scan-label> [--pregnant] [--under13] [--iso] [--live]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EMPTY_INTAKE, type Intake } from "../lib/intake";
import { loadCatalog, loadRules, loadThresholds, productBySku } from "../lib/rules/load";
import { runBaselineAgent, runGuardedAgent } from "../lib/agent/run";
import type { ScanSummary } from "../lib/youcam/parse";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

async function main() {
  const label = process.argv[2] ?? "synthetic-09-olive";
  const args = process.argv.slice(3);
  const raw = JSON.parse(
    await readFile(path.join(process.cwd(), "fixtures", "scans", label, "fixture.json"), "utf8"),
  );
  const scan = raw.summary as ScanSummary;

  const goalFlag = args.indexOf("--goal");
  const intake: Intake = {
    ...EMPTY_INTAKE,
    goal: goalFlag > -1 ? args[goalFlag + 1] : "I want clearer skin and fewer dark marks",
    ...(args.includes("--pregnant") ? { pregnancy: "pregnant" as const } : {}),
    ...(args.includes("--under13") ? { ageBand: "under_13" as const } : {}),
    ...(args.includes("--iso") ? { isotretinoin: "now" as const } : {}),
  };

  const input = {
    scan,
    intake,
    catalog: loadCatalog(),
    rules: loadRules(),
    thresholds: loadThresholds(),
    fitzpatrick: scan.fitzpatrick,
    mode: args.includes("--live") ? ("live" as const) : ("replay" as const),
    label,
  };

  const catalog = input.catalog;
  const name = (sku: string) => productBySku(catalog, sku)?.name ?? sku;

  console.log(`scan ${label}: fitz=${scan.fitzpatrick} acne=${scan.concerns.acne?.raw.toFixed(1)} redness=${scan.concerns.redness?.raw.toFixed(1)}`);
  console.log(`intake: age=${intake.ageBand} pregnancy=${intake.pregnancy} isotretinoin=${intake.isotretinoin}\n`);

  const baseline = await runBaselineAgent(input);
  console.log(`--- BASELINE (${baseline.source}), no guardrail ---`);
  for (const sku of baseline.finalCart) console.log(`  ${sku}  ${name(sku)}`);

  const guarded = await runGuardedAgent(input);
  console.log(`\n--- GUARDED (${guarded.source}), ${guarded.revisionRounds} revision round(s) ---`);
  for (const item of guarded.evaluation.items) {
    console.log(`  ${item.verdict.padEnd(12)} ${item.sku}  ${name(item.sku)}`);
    for (const f of item.findings) console.log(`      ${f.ruleId}: ${f.message.slice(0, 90)}`);
  }
  for (const a of guarded.evaluation.additions) console.log(`  ADDED        ${a.sku}  ${name(a.sku)} (${a.ruleId})`);
  for (const r of guarded.evaluation.referrals) console.log(`  REFER        ${r.ruleId}: ${r.message.slice(0, 90)}`);
  for (const r of guarded.evaluation.reported) console.log(`  REPORTED     ${r.ruleId}: ${r.message.slice(0, 90)}`);
  console.log(`\n  rounds used: ${guarded.revisionRounds}, blocked along the way: ${guarded.rounds.flatMap((r) => r.blocked).join(", ") || "none"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
