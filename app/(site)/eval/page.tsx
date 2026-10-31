import { readFileSync } from "node:fs";
import { loadRules } from "@/lib/rules/load";

export const metadata = { title: "Eval | PatchTest" };
export const dynamic = "force-dynamic";

type Results = {
  generated_at: string;
  model: string;
  runs_per_scenario: number;
  scenarios: number;
  total_runs: number;
  gold_status: string;
  metrics: Partial<Record<"guarded" | "baseline" | "review", Record<string, number | Record<string, number>>>>;
  mean_revision_rounds: number;
  cart_stability_across_runs: { guarded: number; baseline: number; review?: number };
  per_rule?: Record<string, { positive: number; positiveFired: number; negative: number; negativeFired: number }>;
  rows: Array<{
    id: string;
    name: string;
    kind: string;
    targets_rules: string[];
    rationale: string;
    flag_for_rifqi?: string;
    expected: { adjust_classes: string[]; block_classes: string[]; referral: boolean };
    runs: Array<{
      guardedCart: string[];
      baselineCart: string[];
      firedRules: string[];
      referrals: string[];
      missedCaveats: Array<{ sku: string; name: string; guardrailSaid: string | null; ruleId: string | null }>;
      unsafeLetThrough: Array<{ sku: string; name: string; guardrailSaid: string | null; ruleId: string | null }>;
      baseline: { unflaggedAdjust: string[]; unflaggedUnnecessary: string[] };
      guarded: { unflaggedAdjust: string[]; unflaggedUnnecessary: string[] };
    }>;
  }>;
};

const METRIC_LABEL: Record<string, string> = {
  unsafe_item_rate: "Sold an item the gold calls unsafe",
  unnecessary_item_rate: "Cart contained an item with nothing to do",
  unflagged_unnecessary_rate: "…and did not say so",
  unflagged_adjust_rate: "Sold an item needing a caveat, with no caveat",
  missing_spf_rate: "Left out sunscreen where it was required",
  missed_referral_rate: "Did not suggest seeing someone when it should",
  over_block_rate: "Removed something the gold says is fine",
  mean_cart_size: "Mean items in the cart",
  mean_cart_price: "Mean cart value, dollars",
};

const LOWER_IS_BETTER = new Set(Object.keys(METRIC_LABEL).filter((k) => k.endsWith("_rate")));

function Bar({ value, tone }: { value: number; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "bad" ? "bg-block" : tone === "good" ? "bg-accent" : "bg-unnecessary";
  return (
    <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-paper">
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </span>
  );
}

export default function EvalPage() {
  let results: Results | null = null;
  try {
    results = JSON.parse(readFileSync("eval/results.json", "utf8")) as Results;
  } catch {
    // Not run yet. The page says so below.
  }
  const rules = loadRules();

  if (!results) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-4xl">Eval</h1>
        <p className="mt-3 text-muted">No results recorded yet. Run <code className="font-mono">pnpm eval</code>.</p>
      </div>
    );
  }

  const g = results.metrics.guarded as Record<string, number>;
  const b = results.metrics.baseline as Record<string, number>;
  // The review arm was added after the first eval, so a results file recorded
  // before it exists is still renderable.
  const r = results.metrics.review as Record<string, number> | undefined;
  // Counted off the results file rather than hardcoded. This sentence said
  // "both arms" and 240 for a while after the third arm landed.
  const arms = Object.keys(results.metrics).length;

  // One row per scenario, showing what the plain advisor actually did with the
  // shopper's cart rather than what our labels say about the scenario.
  const letThrough = results.rows
    .map((r) => ({ row: r, items: r.runs[0]?.unsafeLetThrough ?? [] }))
    .filter((x) => x.items.length > 0);
  const noCaveat = results.rows
    .map((r) => ({ row: r, items: r.runs[0]?.missedCaveats ?? [] }))
    .filter((x) => x.items.length > 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-4xl">Eval</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        {results.scenarios} scenarios covering all {rules.length} rules, run through all {arms}{" "}
        arms {results.runs_per_scenario} times each. That is {results.total_runs * arms} agent
        results on <code className="font-mono text-sm">{results.model}</code>.
      </p>

      <section className="mt-6 rounded-xl border border-adjust/25 bg-adjust-soft p-4 sm:p-5">
        <h2 className="font-display text-lg">Read this before the numbers</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink">
          <p>
            <span className="font-medium">The guarded arm cannot fail the covered rules.</span> It is
            0% unsafe on them by construction, because the same engine that produces the verdicts is
            the one being scored. That number is not evidence of anything and we are not presenting
            it as a result.
          </p>
          <p>
            <span className="font-medium">The baseline is not a strawman.</span> Same model, same
            prompt, same inputs. Its prompt tells it to consider pregnancy, age, interactions and
            when to refer. The guarded arm&rsquo;s first proposal is literally the same API call as
            the baseline&rsquo;s, so the only difference between the two is the guardrail.
          </p>
          <p>
            <span className="font-medium">The model is not the weak point.</span> Asked to{" "}
            <em>recommend</em> a routine, the plain advisor proposed nothing our labels call unsafe,
            in any run. It does not suggest retinoids to a pregnant shopper. What it does not do is
            take anything out of the cart the shopper already filled, or say a word about it.
          </p>
          <p>
            <span className="font-medium">
              The plain advisor&rsquo;s numbers measure a task it was never set.
            </span>{" "}
            It is asked to recommend a routine, so it has no mechanism for commenting on, or
            removing, an item it did not itself propose. Reporting that as a safety gap would be
            scoring it on someone else&rsquo;s job, which is why there is a third arm.
          </p>
          <p>
            <span className="font-medium">The third arm is the fair comparison.</span> Same model,
            same catalogue, same shopper, handed the cart and told in as many words to review it for
            safety. It is the honest version of the question &ldquo;do you need a rules engine for
            this?&rdquo; and it answers most of it: the unsafe rate falls from{" "}
            <span className="tnum font-medium">{b.unsafe_item_rate}%</span> to{" "}
            <span className="tnum font-medium">{r ? r.unsafe_item_rate : "n/a"}%</span>. Asked
            directly, the model is nearly as safe as the engine. We would rather publish that than
            keep a headline that rested on a task nobody gave it.
          </p>
          <p>
            <span className="font-medium">What the third arm costs instead.</span> It removes things
            our labels say are fine in{" "}
            <span className="tnum font-medium">{r ? r.over_block_rate : "n/a"}%</span> of runs, drops
            required sunscreen in{" "}
            <span className="tnum font-medium">{r ? r.missing_spf_rate : "n/a"}%</span>, and gives
            the same shopper the same cart only{" "}
            <span className="tnum font-medium">
              {results.cart_stability_across_runs.review ?? "n/a"}%
            </span>{" "}
            of the time, against {results.cart_stability_across_runs.guarded}% here. It is safe by
            being erratic and over-cautious: it strips the cart to{" "}
            <span className="tnum font-medium">{r ? r.mean_cart_size : "n/a"}</span> items where the
            engine keeps {g.mean_cart_size}. And it cites nothing, so none of it can be checked.
          </p>
          <p>
            <span className="font-medium">The gold labels are {results.gold_status.toLowerCase()}.</span>{" "}
            One author, no second reader, no external validation.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Results</h2>
        <table className="mt-4 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line label text-faint">
              <th className="py-2 font-medium">Measure</th>
              <th className="py-2 text-right font-medium">With guardrail</th>
              <th className="py-2 text-right font-medium">Asked to review</th>
              <th className="py-2 text-right font-medium">Plain advisor</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(METRIC_LABEL).map((key) => {
              const isRate = LOWER_IS_BETTER.has(key);
              const guarded = g[key];
              const baseline = b[key];
              const review = r?.[key];
              if (typeof guarded !== "number") return null;
              const better = isRate && guarded < baseline;
              return (
                <tr key={key} className="border-b border-line/60 align-top">
                  <td className="py-3 pr-4">{METRIC_LABEL[key]}</td>
                  <td className="tnum w-32 py-3 text-right">
                    <span className={better ? "font-medium text-accent" : ""}>
                      {guarded}
                      {isRate ? "%" : ""}
                    </span>
                    {isRate ? <Bar value={guarded} tone={guarded === 0 ? "good" : "neutral"} /> : null}
                  </td>
                  <td className="tnum w-32 py-3 text-right">
                    {typeof review === "number" ? (
                      <>
                        <span>
                          {review}
                          {isRate ? "%" : ""}
                        </span>
                        {isRate ? <Bar value={review} tone="neutral" /> : null}
                      </>
                    ) : (
                      <span className="text-faint">n/a</span>
                    )}
                  </td>
                  <td className="tnum w-32 py-3 text-right">
                    <span className={better ? "font-medium text-block" : ""}>
                      {baseline}
                      {isRate ? "%" : ""}
                    </span>
                    {isRate ? <Bar value={baseline} tone={baseline > guarded ? "bad" : "neutral"} /> : null}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-line/60">
              <td className="py-3 pr-4">Gave the same shopper the same cart on all three runs</td>
              <td className="tnum py-3 text-right">{results.cart_stability_across_runs.guarded}%</td>
              <td className="tnum py-3 text-right">
                {results.cart_stability_across_runs.review ?? "n/a"}
                {typeof results.cart_stability_across_runs.review === "number" ? "%" : ""}
              </td>
              <td className="tnum py-3 text-right">{results.cart_stability_across_runs.baseline}%</td>
            </tr>
            <tr>
              <td className="py-3 pr-4">Mean revision rounds used</td>
              <td className="tnum py-3 text-right">{results.mean_revision_rounds}</td>
              <td className="tnum py-3 text-right text-faint">n/a</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 space-y-2 rounded-lg bg-surface p-4 text-sm leading-relaxed text-muted">
          <p>
            <span className="font-medium text-ink">What actually separates them.</span> Apart
            from the items each arm removes, all three propose near-identical carts. The rest of the
            difference is what the shopper is told about what stays. An item needing a usage caveat
            went out without one in{" "}
            <span className="tnum font-medium text-ink">{b.unflagged_adjust_rate}%</span> of
            applicable runs for the plain advisor and{" "}
            <span className="tnum font-medium text-ink">
              {r ? r.unflagged_adjust_rate : "n/a"}%
            </span>{" "}
            for the arm asked to review, against{" "}
            <span className="tnum font-medium text-ink">{g.unflagged_adjust_rate}%</span> here.
            Telling the model to check the cart roughly halves that. It does not close it, and it
            does not make any of it checkable.
          </p>
          <p>
            <span className="font-medium text-ink">And consistency.</span> The plain advisor gave the
            same shopper the same answer on only{" "}
            <span className="tnum font-medium text-ink">{results.cart_stability_across_runs.baseline}%</span>{" "}
            of scenarios across three identical runs. The guardrail does not make the model
            deterministic, but the verdict on whatever it proposes is: the engine is a pure function,
            and a unit test asserts identical output for identical input.
          </p>
          <p>
            <span className="font-medium text-ink">Our own gaps, unedited.</span> The guarded arm is
            not at zero on the unflagged-caveat measure. Every miss is the same scenario: a
            Fitzpatrick IV shopper whose cart ends up holding both the 5% and the 2.5% benzoyl
            peroxide. Our gold labels the whole ingredient class as needing a caveat, while the rule
            is strength-specific and correctly says nothing about the 2.5%. We think the gold is
            over-specified there, and we have left the number as it is rather than editing the
            labels to improve our own score. It is flagged for clinician review.
          </p>
          <p>
            <span className="font-medium text-ink">One rule never fired.</span> R-SPF-01 adds
            sunscreen when a cart has actives and none. It shows 0 of 3 on its own scenario because
            the advisor had already put sunscreen in. The outcome the gold asked for, sunscreen
            present, was met every time. A rule that never needs to fire is not a broken rule, but it
            is also not evidence that it works.
          </p>
        </div>
      </section>

      {letThrough.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl">What the plain advisor let through</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            In each of these the shopper had already put the item in their cart. The advisor did not
            recommend it, and it did not remove it or say anything about it either. The quote is what
            PatchTest said about the very same item.
          </p>
          <ul className="mt-5 space-y-3">
            {letThrough.map(({ row, items }) => (
              <li key={row.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line bg-sunken px-4 py-2.5">
                  <code className="font-mono text-xs text-faint">{row.id}</code>
                  <span className="text-sm font-medium">{row.name}</span>
                </div>
                {items.map((item) => (
                  <div key={item.sku} className="flex gap-3 px-4 py-3.5">
                    <span aria-hidden className="mt-1 h-full w-0.5 shrink-0 self-stretch rounded-full bg-block" />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="label text-block">Sold anyway</span>{" "}
                        <span className="font-medium">{item.name}</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        <span className="font-medium text-ink">PatchTest said:</span>{" "}
                        {item.guardrailSaid}{" "}
                        <code className="font-mono text-xs text-faint">{item.ruleId}</code>
                      </p>
                    </div>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {noCaveat.length > 0 ? (
        <section className="mt-12">
          <h2 className="font-display text-2xl">What it sold without a word</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Not unsafe, but incomplete. These are items that needed a usage caveat, sold with none.
          </p>
          <ul className="mt-5 space-y-3">
            {noCaveat.map(({ row, items }) => (
              <li key={row.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line bg-sunken px-4 py-2.5">
                  <code className="font-mono text-xs text-faint">{row.id}</code>
                  <span className="text-sm font-medium">{row.name}</span>
                </div>
                {items.map((item) => (
                  <div key={item.sku} className="flex gap-3 px-4 py-3.5">
                    <span aria-hidden className="mt-1 h-full w-0.5 shrink-0 self-stretch rounded-full bg-adjust" />
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="label text-adjust">No caveat given</span>{" "}
                        <span className="font-medium">{item.name}</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        <span className="font-medium text-ink">PatchTest said:</span>{" "}
                        {item.guardrailSaid}{" "}
                        <code className="font-mono text-xs text-faint">{item.ruleId}</code>
                      </p>
                    </div>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {results.per_rule ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Per-rule coverage</h2>
          <p className="mt-2 text-sm text-muted">
            Did each rule fire on the scenarios built to trigger it, and stay quiet on the ones built
            not to?
          </p>
          <table className="mt-4 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line label text-faint">
                <th className="py-2 font-medium">Rule</th>
                <th className="py-2 text-right font-medium">Fired when it should</th>
                <th className="py-2 text-right font-medium">Stayed quiet when it should</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(results.per_rule).sort().map(([ruleId, stat]) => (
                <tr key={ruleId} className="border-b border-line/60">
                  <td className="py-2 font-mono text-xs">{ruleId}</td>
                  <td className="tnum py-2 text-right">
                    {stat.positive === 0 ? (
                      <span className="text-faint">no positive case</span>
                    ) : (
                      <span className={stat.positiveFired === stat.positive ? "text-accent" : "text-adjust"}>
                        {stat.positiveFired} of {stat.positive}
                      </span>
                    )}
                  </td>
                  <td className="tnum py-2 text-right">
                    {stat.negative === 0 ? (
                      <span className="text-faint">no negative case</span>
                    ) : (
                      <span className={stat.negativeFired === 0 ? "text-accent" : "text-adjust"}>
                        {stat.negative - stat.negativeFired} of {stat.negative}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-faint">
        Generated {new Date(results.generated_at).toUTCString()}. Raw output is in{" "}
        <code className="font-mono">eval/results.json</code>, scenarios in{" "}
        <code className="font-mono">eval/scenarios.json</code>, labels in{" "}
        <code className="font-mono">eval/gold.json</code>.
      </p>
    </div>
  );
}
