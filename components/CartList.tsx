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

const HUMAN = (field: string, value: string): string => {
  const words = value.replace(/_/g, " ");
  switch (field) {
    case "pregnancy":
      return { pregnant: "you are pregnant", trying: "you are trying to conceive", breastfeeding: "you are breastfeeding" }[value] ?? words;
    case "isotretinoin":
      return value === "now"
        ? "you are taking isotretinoin"
        : "you stopped isotretinoin within the last six months";
    case "age":
      return value === "under_13" ? "you are under 13" : `you are ${words.replace(/^(\d+) (\d+)$/, "$1 to $2")}`;
    case "currently_using":
      return `you already use ${words}`;
    case "symptoms":
      return `you reported ${words}`;
    default:
      return words;
  }
};

/** Says which answer or measurement made a rule fire, in the shopper's words. */
function TriggerNote({ finding, fitzFromScan }: { finding: Finding; fitzFromScan: boolean }) {
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
    // Fitzpatrick normally comes off the photo, not the intake form, so saying
    // "what you told us" about it is simply wrong unless the shopper set it.
    if (t.field === "fitzpatrick") {
      return (
        <p className="mt-1.5 text-xs text-faint">
          Triggered by {fitzFromScan ? "the scan reading" : "the Fitzpatrick type you set,"}{" "}
          <span className="font-medium text-muted">type {t.value}</span>.
        </p>
      );
    }
    return (
      <p className="mt-1.5 text-xs text-faint">
        Triggered by what you told us:{" "}
        <span className="font-medium text-muted">{HUMAN(t.field, t.value)}</span>.
      </p>
    );
  }
  return null;
}

function FindingRow({
  finding,
  catalogIndex,
  fitzFromScan,
}: {
  finding: Finding;
  catalogIndex: AdviseResult["catalogIndex"];
  fitzFromScan: boolean;
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
      <TriggerNote finding={finding} fitzFromScan={fitzFromScan} />
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
  // `blocked` is the only thing that decides whether an item leaves. The
  // headline verdict cannot: VERDICT_RANK puts UNNECESSARY above BLOCK so the
  // least alarming label leads, which means a removed item can head its card
  // with "you don't need this". Reading the total off that label charged the
  // shopper for items that had already been struck through.
  const isOut = new Set(result.evaluation.blocked);
  const kept = result.lines.filter((l) => !isOut.has(l.sku));
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
        {result.lines.map((line, index) => {
          const item = byS.get(line.sku);
          const struck = isOut.has(line.sku);
          // An item that is out leads with why it is out. Everything else it
          // picked up is advice for using it, and there is no using it.
          const findings = struck
            ? (item?.findings ?? []).filter((f) => f.verdict === "BLOCK")
            : (item?.findings ?? []);
          const verdict: Verdict = struck ? "BLOCK" : (item?.verdict ?? "OK");

          return (
            <li
              key={line.sku}
              className="anim-stagger relative border-b border-line last:border-0"
              style={{ "--i": index } as React.CSSProperties}
            >
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
                        fitzFromScan={result.fitzpatrick.source === "api"}
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
