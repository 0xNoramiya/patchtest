import type { AdviseResult } from "@/lib/advise";
import { sourceName } from "./verdict";

export function Referrals({
  result,
  onAnswer,
}: {
  result: AdviseResult;
  /** Answering re-runs the whole evaluation with the symptom set. */
  onAnswer?: (symptoms: string[]) => void;
}) {
  const { referrals, reported, suggestedQuestions } = result.evaluation;
  if (referrals.length === 0 && reported.length === 0 && suggestedQuestions.length === 0) return null;

  return (
    <div className="space-y-3">
      {referrals.map((finding) => (
        <section
          key={finding.ruleId}
          className="rounded-xl border border-refer/25 bg-refer-soft p-4 shadow-card sm:p-5"
        >
          <h2 className="font-display text-lg text-refer">Worth showing a professional</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{finding.message}</p>
          {finding.sourceQuote ? (
            <blockquote className="mt-2 border-l-2 border-refer/30 pl-3 text-xs italic leading-relaxed text-muted">
              &ldquo;{finding.sourceQuote}&rdquo;
            </blockquote>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {finding.sourceUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="text-refer underline underline-offset-2">
                Source: {sourceName(url)}
              </a>
            ))}
          </div>
        </section>
      ))}

      {reported.map((finding) => (
        <section key={finding.ruleId} className="rounded-xl border border-block/25 bg-block-soft p-4 shadow-card sm:p-5">
          <h2 className="font-display text-lg text-block">About something you already use</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{finding.message}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {finding.sourceUrls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="text-block underline underline-offset-2">
                Source: {sourceName(url)}
              </a>
            ))}
          </div>
        </section>
      ))}

      {suggestedQuestions.length > 0 && referrals.length === 0 ? (
        <section className="rounded-xl border border-line bg-surface p-4 text-sm shadow-card sm:p-5">
          <h2 className="font-display text-base">One thing worth asking</h2>
          {suggestedQuestions.map((q) => (
            <div key={q.ruleId}>
              <p className="tnum mt-1.5 leading-relaxed text-muted">
                Your measured {q.concern.replace("_", " ")} score is {q.raw.toFixed(1)}, below our
                threshold of {q.threshold}. That is not a finding about your skin, it is just a
                reason to ask: do you get deep, painful bumps, or marks that stay behind?
              </p>
              {onAnswer ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAnswer(q.symptoms)}
                    className="press rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => onAnswer([])}
                    className="press rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-accent"
                  >
                    No
                  </button>
                  <span className="text-xs text-faint">
                    Either answer re-runs the verdicts. Nothing is sent anywhere.
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 leading-relaxed text-muted">
                  If so, tell us on the intake and we will change what we show you.
                </p>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
