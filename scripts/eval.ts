/**
 * Runs every scenario through both arms, three times each, and scores the
 * results against eval/gold.json.
 *
 *   pnpm eval            replay only, free, fails if anything is unrecorded
 *   pnpm eval --live     makes real LLM calls and records them for replay
 *   pnpm eval --runs 1   fewer repeats
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMPTY_INTAKE, type Intake } from "../lib/intake";
import { runBaselineAgent, runGuardedAgent, AGENT_MODEL } from "../lib/agent/run";
import { evaluate } from "../lib/rules/engine";
import { loadCatalog, loadRules, loadThresholds, productBySku } from "../lib/rules/load";
import type { ScanSummary } from "../lib/youcam/parse";
import { ADJUST_CUES, rate, REFERRAL_CUES, scoreArm, UNNECESSARY_CUES, type GoldExpectation, type ScenarioScore } from "../eval/score";

process.loadEnvFile(path.join(process.cwd(), ".env.local"));

type Scenario = {
  id: string;
  name: string;
  scan: string;
  goal: string;
  intake: Partial<Intake>;
  targets_rules: string[];
  kind: "positive" | "negative" | "control";
};

const catalog = loadCatalog();
const rules = loadRules();
const thresholds = loadThresholds();

async function loadScan(label: string): Promise<ScanSummary> {
  const raw = JSON.parse(
    await readFile(path.join(process.cwd(), "fixtures", "scans", label, "fixture.json"), "utf8"),
  );
  return raw.summary as ScanSummary;
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const runsFlag = args.indexOf("--runs");
  const RUNS = runsFlag > -1 ? Number(args[runsFlag + 1]) : 3;

  const scenarios = (JSON.parse(await readFile("eval/scenarios.json", "utf8")) as { scenarios: Scenario[] }).scenarios;
  const gold = JSON.parse(await readFile("eval/gold.json", "utf8")) as {
    labels: Record<string, { expected: GoldExpectation; rationale: string; flag_for_rifqi?: string }>;
  };

  const rows: Array<Record<string, unknown>> = [];
  let done = 0;

  for (const scenario of scenarios) {
    const scan = await loadScan(scenario.scan);
    const intake: Intake = { ...EMPTY_INTAKE, ...scenario.intake, goal: scenario.goal };
    const expected = gold.labels[scenario.id].expected;

    const perRun: Array<{ run: number; guarded: ScenarioScore; baseline: ScenarioScore; guardedCart: string[]; baselineCart: string[]; revisionRounds: number; referrals: string[] }> = [];

    for (let run = 0; run < RUNS; run += 1) {
      const input = {
        scan, intake, catalog, rules, thresholds,
        fitzpatrick: scan.fitzpatrick,
        mode: live ? ("live" as const) : ("replay" as const),
        label: `${scenario.id}-r${run}`,
        run,
      };

      const baseline = await runBaselineAgent(input);
      const guarded = await runGuardedAgent(input);

      // What the engine would have said about the baseline's cart, for reporting
      // only. The baseline never sees it.
      const baselineEval = evaluate({ ...input, cart: baseline.finalCart });
      const baselineReferred =
        REFERRAL_CUES.test(baseline.routineNote) ||
        baseline.rounds[0].proposed.items.some((i) => REFERRAL_CUES.test(i.reason));

      // What each arm actually told the shopper about each item.
      const guardedFlaggedUnnecessary = guarded.evaluation.items
        .filter((i) => i.findings.some((f) => f.verdict === "UNNECESSARY"))
        .map((i) => i.sku);
      const guardedFlaggedAdjust = guarded.evaluation.items
        .filter((i) => i.findings.some((f) => f.verdict === "ADJUST"))
        .map((i) => i.sku);

      const baselineText = new Map(
        baseline.rounds[0].proposed.items.map((i) => [i.sku, `${i.reason} ${baseline.routineNote}`]),
      );
      const baselineFlagged = (cue: RegExp) =>
        [...baselineText.entries()].filter(([, text]) => cue.test(text)).map(([sku]) => sku);

      const proposedByGuarded = guarded.rounds[0].proposed.items
        .map((i) => productBySku(catalog, i.sku)?.sku)
        .filter((s): s is string => Boolean(s));
      const removed = proposedByGuarded.filter((sku) => !guarded.finalCart.includes(sku));

      perRun.push({
        run,
        guarded: scoreArm(
          {
            cart: guarded.finalCart,
            referred: guarded.evaluation.referrals.length > 0,
            removed,
            revisionRounds: guarded.revisionRounds,
            flaggedUnnecessary: guardedFlaggedUnnecessary,
            flaggedAdjust: guardedFlaggedAdjust,
          },
          expected, catalog,
        ),
        baseline: scoreArm(
          {
            cart: baseline.finalCart,
            referred: baselineReferred,
            removed: [],
            revisionRounds: 0,
            flaggedUnnecessary: baselineFlagged(UNNECESSARY_CUES),
            flaggedAdjust: baselineFlagged(ADJUST_CUES),
          },
          expected, catalog,
        ),
        guardedCart: guarded.finalCart,
        baselineCart: baseline.finalCart,
        revisionRounds: guarded.revisionRounds,
        referrals: guarded.evaluation.referrals.map((r) => r.ruleId),
      });

      void baselineEval;
    }

    const stable = (carts: string[][]) =>
      new Set(carts.map((c) => [...c].sort().join(","))).size === 1;

    rows.push({
      ...scenario,
      expected,
      rationale: gold.labels[scenario.id].rationale,
      flag_for_rifqi: gold.labels[scenario.id].flag_for_rifqi,
      runs: perRun,
      guarded_stable: stable(perRun.map((r) => r.guardedCart)),
      baseline_stable: stable(perRun.map((r) => r.baselineCart)),
    });

    done += 1;
    process.stdout.write(`\r${done}/${scenarios.length} scenarios`.padEnd(40));
  }
  process.stdout.write("\n");

  // Every run, paired with the gold entry it was scored against, so each metric
  // can use the denominator that actually applies to it.
  type Paired = { expected: GoldExpectation; guarded: ScenarioScore; baseline: ScenarioScore; revisionRounds: number };
  const allRuns: Paired[] = rows.flatMap((r) =>
    (r.runs as Array<{ guarded: ScenarioScore; baseline: ScenarioScore; revisionRounds: number }>).map((run) => ({
      expected: r.expected as GoldExpectation,
      ...run,
    })),
  );
  const n = allRuns.length;

  const agg = (arm: "guarded" | "baseline") => {
    const s = allRuns.map((r) => r[arm]);
    // Denominators differ on purpose. A missed referral is only possible on a
    // scenario where gold says to refer, and missing sunscreen is only possible
    // where gold says sunscreen is required.
    const referralRuns = allRuns.filter((r) => r.expected.referral);
    const spfRuns = allRuns.filter((r) => r.expected.require_spf);
    return {
      unsafe_item_rate: rate(s.filter((x) => x.unsafeItems.length > 0).length, n),
      unnecessary_item_rate: rate(s.filter((x) => x.unnecessaryItems.length > 0).length, n),
      unflagged_unnecessary_rate: rate(s.filter((x) => x.unflaggedUnnecessary.length > 0).length, n),
      unflagged_adjust_rate: rate(
        allRuns.filter((r) => r.expected.adjust_classes.length > 0 && r[arm].unflaggedAdjust.length > 0).length,
        allRuns.filter((r) => r.expected.adjust_classes.length > 0).length,
      ),
      missing_spf_rate: rate(spfRuns.filter((r) => r[arm].missingSpf).length, spfRuns.length),
      missed_referral_rate: rate(referralRuns.filter((r) => r[arm].missedReferral).length, referralRuns.length),
      over_block_rate: rate(s.filter((x) => x.overBlocked.length > 0).length, n),
      mean_cart_size: Math.round((s.reduce((a, x) => a + x.cartSize, 0) / n) * 10) / 10,
      mean_cart_price: Math.round((s.reduce((a, x) => a + x.totalPrice, 0) / n) * 100) / 100,
      _denominators: { all_runs: n, referral_runs: referralRuns.length, spf_runs: spfRuns.length },
    };
  };

  const results = {
    generated_at: new Date().toISOString(),
    model: AGENT_MODEL,
    runs_per_scenario: RUNS,
    scenarios: scenarios.length,
    total_runs: n,
    gold_status: "DRAFT, not yet reviewed by a clinician",
    metrics: { guarded: agg("guarded"), baseline: agg("baseline") },
    mean_revision_rounds:
      Math.round((allRuns.reduce((a, r) => a + r.revisionRounds, 0) / n) * 100) / 100,
    cart_stability_across_runs: {
      guarded: rate(rows.filter((r) => r.guarded_stable).length, rows.length),
      baseline: rate(rows.filter((r) => r.baseline_stable).length, rows.length),
    },
    rows,
  };

  await writeFile("eval/results.json", `${JSON.stringify(results, null, 2)}\n`);

  console.log(`\nmodel: ${AGENT_MODEL}, ${scenarios.length} scenarios x 2 arms x ${RUNS} runs = ${n * 2} agent results\n`);
  const m = results.metrics;
  for (const k of Object.keys(m.guarded) as Array<keyof typeof m.guarded>) {
    if (k === "_denominators") continue;
    console.log(
      `  ${String(k).padEnd(28)} guarded ${String(m.guarded[k]).padStart(7)}   baseline ${String(m.baseline[k]).padStart(7)}`,
    );
  }
  console.log(`\n  mean revision rounds used: ${results.mean_revision_rounds}`);
  console.log(`  identical cart across ${RUNS} runs: guarded ${results.cart_stability_across_runs.guarded}%, baseline ${results.cart_stability_across_runs.baseline}%`);
  console.log("\n  Rates are percentages of runs. Written to eval/results.json");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
