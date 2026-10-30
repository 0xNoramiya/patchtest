import type { AdviseResult } from "@/lib/advise";
import type { Finding, Verdict } from "@/lib/rules/types";
import { ProductImage } from "./ProductImage";
import { VerdictBadge } from "./VerdictBadge";
import { sourceName, VERDICT_RAIL } from "./verdict";

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
      <p className="tnum mt-1.5 text-xs text-faint">
        Triggered by your measured {t.concern.replace("_", " ")} score of{" "}
        <span className="font-medium text-muted">{t.raw.toFixed(1)}</span>, which is{" "}
        {t.comparison === "below" ? "below" : "at or above"} our threshold of {t.threshold}.
      </p>
    );
  }
  if (t.kind === "scan_skin_type") {
    return (
      <p className="mt-1.5 text-xs text-faint">
        Triggered by the scan reporting your {t.region.replace("_", " ")} skin type as{" "}
        <span className="font-medium text-muted">{t.label}</span>.
      </p>
    );
  }
  if (t.kind === "intake") {
    return (
      <p className="mt-1.5 text-xs text-faint">
        Triggered by what you told us:{" "}
        <span className="font-medium text-muted">
          {t.field.replace(/_/g, " ")} is {t.value.replace(/_/g, " ")}
        </span>
        .
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
    <li className="border-t border-line pt-3 first:border-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictBadge verdict={finding.verdict} />
        <code className="font-mono text-xs text-faint">{finding.ruleId}</code>
        {finding.evidence === "heuristic" ? (
          <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-faint">our heuristic</span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed">{finding.message}</p>
      <TriggerNote finding={finding} />
      {finding.sourceQuote ? (
        <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-xs italic leading-relaxed text-muted">
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
      </div>
      {swap ? (
        <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-accent/20 bg-accent-soft/60 p-2">
          <ProductImage sku={finding.swapHint!} name={swap.name} size={36} />
          <p className="text-xs leading-snug">
            <span className="label text-accent">Try instead</span>
            <span className="mt-0.5 block font-medium">{swap.name}</span>
          </p>
          <span className="tnum ml-auto pr-1 text-xs text-muted">${swap.price}</span>
        </div>
      ) : null}
    </li>
  );
}

export function CartList({ result }: { result: AdviseResult }) {
  const byS = new Map(result.evaluation.items.map((i) => [i.sku, i]));
  const kept = result.lines.filter((l) => (byS.get(l.sku)?.verdict ?? "OK") !== "BLOCK");
  const total = kept.reduce((sum, l) => sum + l.product.price, 0);
  const removed = result.lines.length - kept.length;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-4 sm:px-6">
        <h2 className="font-display text-xl">Your cart, checked</h2>
        <p className="text-sm text-muted">
          <span className="tnum font-medium text-ink">${total}</span>
          {removed > 0 ? ` after ${removed} item${removed > 1 ? "s" : ""} came out` : ""}
        </p>
      </div>

      <ul>
        {result.lines.map((line) => {
          const item = byS.get(line.sku);
          const verdict: Verdict = item?.verdict ?? "OK";
          const findings = item?.findings ?? [];
          const struck = findings.some((f) => f.verdict === "BLOCK");

          return (
            <li key={line.sku} className="relative border-b border-line last:border-0">
              {/* A colour rail so the shape of the answer is scannable down the page. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 left-0 w-1 ${VERDICT_RAIL[verdict]}`}
              />
              <div className="px-4 py-4 pl-5 sm:px-6 sm:pl-7">
                <div className="flex items-start gap-3 sm:gap-4">
                  <ProductImage
                    sku={line.sku}
                    name={line.product.name}
                    size={64}
                    className={struck ? "opacity-60 grayscale" : ""}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="label text-faint">{ORIGIN_LABEL[line.origin]}</p>
                    <h3
                      className={`mt-0.5 font-display text-lg leading-snug ${struck ? "text-muted line-through decoration-block/40" : ""}`}
                    >
                      {line.product.name}
                    </h3>
                    <p className="tnum text-sm text-muted">${line.product.price}</p>
                  </div>
                  <VerdictBadge verdict={verdict} />
                </div>

                {findings.length > 0 ? (
                  <ul className="mt-3.5 space-y-3 rounded-lg bg-sunken p-3 sm:ml-20 sm:p-4">
                    {findings.map((finding, i) => (
                      <FindingRow
                        key={`${finding.ruleId}-${i}`}
                        finding={finding}
                        catalogIndex={result.catalogIndex}
                      />
                    ))}
                  </ul>
                ) : line.agentReason ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:ml-20">
                    {line.agentReason}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
