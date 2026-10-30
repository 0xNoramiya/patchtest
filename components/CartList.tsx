import type { AdviseResult } from "@/lib/advise";
import type { Finding, Verdict } from "@/lib/rules/types";
import { VerdictBadge } from "./VerdictBadge";
import { sourceName } from "./verdict";

const ORIGIN_LABEL: Record<string, string> = {
  shopper: "You added this",
  suggested: "We suggested this",
  added_by_rule: "Added for safety",
};

function TriggerNote({ finding }: { finding: Finding }) {
  const t = finding.trigger;
  if (!t) return null;

  if (t.kind === "scan") {
    return (
      <p className="tnum mt-1 text-xs text-faint">
        Triggered by your measured {t.concern.replace("_", " ")} score of {t.raw.toFixed(1)}, which is{" "}
        {t.comparison === "below" ? "below" : "at or above"} our threshold of {t.threshold}.
      </p>
    );
  }
  if (t.kind === "scan_skin_type") {
    return (
      <p className="mt-1 text-xs text-faint">
        Triggered by the scan reporting your {t.region.replace("_", " ")} skin type as {t.label}.
      </p>
    );
  }
  if (t.kind === "intake") {
    return (
      <p className="mt-1 text-xs text-faint">
        Triggered by what you told us: {t.field.replace(/_/g, " ")} is {t.value.replace(/_/g, " ")}.
      </p>
    );
  }
  return null;
}

function FindingRow({
  finding,
  catalogIndex,
}: {
  finding: Finding;
  catalogIndex: AdviseResult["catalogIndex"];
}) {
  const swap = finding.swapHint ? catalogIndex[finding.swapHint] : undefined;
  return (
    <li className="border-t border-line/60 pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={finding.verdict} />
        <code className="font-mono text-xs text-faint">{finding.ruleId}</code>
        {finding.evidence === "heuristic" ? (
          <span className="rounded bg-paper px-1.5 py-0.5 text-xs text-faint">our heuristic</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed">{finding.message}</p>
      <TriggerNote finding={finding} />
      {finding.sourceQuote ? (
        <blockquote className="mt-2 border-l-2 border-line pl-3 text-xs italic leading-relaxed text-muted">
          &ldquo;{finding.sourceQuote}&rdquo;
        </blockquote>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {finding.sourceUrls.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            Source: {sourceName(url)}
          </a>
        ))}
        {swap ? (
          <span className="text-muted">
            Try <span className="font-medium text-ink">{swap.name}</span> instead, ${swap.price}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function CartList({ result }: { result: AdviseResult }) {
  const byS = new Map(result.evaluation.items.map((i) => [i.sku, i]));
  const total = result.lines
    .filter((l) => (byS.get(l.sku)?.verdict ?? "OK") !== "BLOCK")
    .reduce((sum, l) => sum + l.product.price, 0);

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line p-4 sm:p-6">
        <h2 className="font-display text-xl">Your cart, checked</h2>
        <p className="text-sm text-muted">
          <span className="tnum font-medium text-ink">${total}</span> after the blocked items come out
        </p>
      </div>

      <ul>
        {result.lines.map((line) => {
          const item = byS.get(line.sku);
          const verdict: Verdict = item?.verdict ?? "OK";
          const findings = item?.findings ?? [];
          return (
            <li key={line.sku} className="border-b border-line p-4 last:border-0 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-faint">
                    {ORIGIN_LABEL[line.origin]}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg leading-snug">{line.product.name}</h3>
                  <p className="tnum text-sm text-muted">${line.product.price}</p>
                </div>
                <VerdictBadge verdict={verdict} className="mt-5" />
              </div>

              {findings.length > 0 ? (
                <ul className="mt-4 space-y-3 rounded-lg bg-paper p-3 sm:p-4">
                  {findings.map((finding, i) => (
                    <FindingRow
                      key={`${finding.ruleId}-${i}`}
                      finding={finding}
                      catalogIndex={result.catalogIndex}
                    />
                  ))}
                </ul>
              ) : line.agentReason ? (
                <p className="mt-2 text-sm leading-relaxed text-muted">{line.agentReason}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
