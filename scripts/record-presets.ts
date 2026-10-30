/**
 * Runs every demo preset once in live mode so its agent response is recorded.
 * The deployed site serves these from replay and never needs an LLM key.
 *   pnpm record-presets
 */
import path from "node:path";
import { advise } from "../lib/advise";
import { PRESETS } from "../lib/presets";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

async function main() {
  for (const preset of PRESETS) {
    const result = await advise({
      scanLabel: preset.scanLabel,
      intake: { ...preset.intake, goal: preset.goal },
      wantedSkus: preset.wantedSkus,
      mode: "live",
    });

    console.log(`\n=== ${preset.id}: ${preset.title} (${result.source})`);
    console.log(`    scan ${preset.scanLabel}, fitzpatrick ${result.fitzpatrick.value} (${result.fitzpatrick.source})`);
    for (const line of result.lines) {
      const item = result.evaluation.items.find((i) => i.sku === line.sku);
      const tag = line.origin === "shopper" ? "in cart" : line.origin === "added_by_rule" ? "added" : "suggested";
      console.log(`    ${String(item?.verdict ?? "OK").padEnd(12)} ${tag.padEnd(10)} ${line.sku} ${line.product.name}`);
      for (const f of item?.findings ?? []) console.log(`        ${f.ruleId}  ${f.message.slice(0, 80)}`);
    }
    for (const r of result.evaluation.referrals) console.log(`    REFER        ${r.ruleId}`);
    for (const r of result.evaluation.reported) console.log(`    REPORTED     ${r.ruleId}`);
    console.log(`    baseline would sell: ${result.baseline.skus.join(", ")}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
