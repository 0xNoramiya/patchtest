import { readFileSync } from "node:fs";
import { loadCatalog, loadRules, loadThresholds } from "@/lib/rules/load";
import { SCAN_UNIT_COST, UNIT_COST } from "@/lib/ledger";
import { SD_CONCERNS } from "@/lib/youcam/types";
import { sourceName } from "@/components/verdict";
import { VerdictBadge } from "@/components/VerdictBadge";

export const metadata = { title: "Methods | PatchTest" };

const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Source checked, supports the rule",
  partial: "Source checked, says less than the rule",
  unverified: "Could not be checked",
  not_applicable: "Our own heuristic, no source claimed",
  pending: "Not yet checked",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-20">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function MethodsPage() {
  const rules = loadRules();
  const thresholds = loadThresholds();
  const catalog = loadCatalog();
  const thresholdFile = JSON.parse(readFileSync("rules/thresholds.json", "utf8")) as {
    thresholds: Record<string, { value: number; meaning: string; calibration?: string; used_by: string[] }>;
    _calibration: { basis: string; limitation: string };
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-4xl">How PatchTest decides</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        Everything on this page is checkable. The rules are data, the thresholds are numbers you can
        read, and every source was fetched and quoted rather than remembered.
      </p>

      <Section id="principle" title="The LLM proposes, the rules decide">
        <p>
          A language model reads your intake, your scan and the catalogue, and proposes a routine. It
          never sets a verdict. A pure TypeScript function then evaluates every item against{" "}
          {rules.length} rules held in a YAML file, and that function produces the verdicts you see.
        </p>
        <p>
          When the rules reject something, the rejection goes back to the model and it revises, up to
          two rounds. The rules still have the last word afterwards. Anything the model writes in
          prose passes through a filter that rewrites or drops wording a shop has no business using before it reaches you.
        </p>
        <p>
          The engine evaluates what you put in your cart as well as what the model proposed. If the
          model quietly drops the thing you asked for, you would never learn why. Every item you
          added gets a verdict, even when the answer is no.
        </p>
      </Section>

      <Section id="youcam" title="Which YouCam APIs are used, and where">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <th className="py-2 font-medium">API</th>
              <th className="py-2 font-medium">What we take from it</th>
              <th className="py-2 font-medium">Units</th>
              <th className="py-2 font-medium">In the code</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            <tr className="border-b border-line/60">
              <td className="py-3 align-top font-medium">AI Skin Analysis, SD tier</td>
              <td className="py-3 align-top">
                Eight concerns: {SD_CONCERNS.join(", ")}. We read <code className="font-mono text-xs">raw_score</code>{" "}
                and the mask overlays.
              </td>
              <td className="tnum py-3 align-top">{UNIT_COST.skin_analysis_sd}</td>
              <td className="py-3 align-top font-mono text-xs">lib/youcam/client.ts</td>
            </tr>
            <tr className="border-b border-line/60">
              <td className="py-3 align-top font-medium">AI Fitzpatrick Skin Type Analysis</td>
              <td className="py-3 align-top">
                One value, <code className="font-mono text-xs">I</code> to{" "}
                <code className="font-mono text-xs">VI</code>. Drives the three skin tone rules. You
                can override it.
              </td>
              <td className="tnum py-3 align-top">{UNIT_COST.fitzpatrick}</td>
              <td className="py-3 align-top font-mono text-xs">lib/youcam/client.ts</td>
            </tr>
            <tr>
              <td className="py-3 align-top font-medium">File API</td>
              <td className="py-3 align-top">
                Pre-signed upload. One upload serves both analyses.
              </td>
              <td className="tnum py-3 align-top">{UNIT_COST.file}</td>
              <td className="py-3 align-top font-mono text-xs">lib/youcam/client.ts</td>
            </tr>
          </tbody>
        </table>
        <p>
          One full scan costs <span className="font-medium text-ink">{SCAN_UNIT_COST} units</span>,
          charged only when a task succeeds. Failed tasks are free. Every live call is written to an
          append-only ledger with the endpoint, the units, the status and a SHA-256 of the image.
          The image itself is never stored. A circuit breaker refuses live calls past the hard stop
          or the daily cap and falls back to a replayed scan.
        </p>
      </Section>

      <Section id="raw" title="Why we decide on raw_score">
        <p>
          YouCam returns two numbers per concern. Its own documentation describes{" "}
          <code className="font-mono text-xs">ui_score</code> as adjusted to be more favourable, as a
          psychological motivator. A tool whose job is to say no cannot decide on a number designed
          to encourage.
        </p>
        <p>
          On our recorded scans the adjustment is not a flat lift, it is a compression toward the
          middle. On one face a texture <code className="font-mono text-xs">raw_score</code> of 17.8
          is presented as 53. We also found that the overall score the API returns is the mean of the{" "}
          <code className="font-mono text-xs">ui_score</code> values, not the measured ones. Both
          numbers are shown to you, labelled.
        </p>
        <p>
          The engine is tested on this. One test replaces every{" "}
          <code className="font-mono text-xs">ui_score</code> with nonsense and asserts the verdicts
          come back identical.
        </p>
      </Section>

      <Section id="age" title="Why we never read age off your face">
        <p>
          The skin analysis returns a <code className="font-mono text-xs">skin_age</code>. We display
          it and no rule reads it. Age bands drive blocking rules, and a blocking rule should not rest
          on an estimate the vendor does not describe as an identity check. Across our nine recorded
          scans the returned value ranged from 8 years below to 20 years above the age the face was
          generated to depict.
        </p>
        <p>
          The same principle applies to the scan generally. A low score never asserts that you have
          anything. It only decides which question is worth asking you.
        </p>
      </Section>

      <Section id="thresholds" title="Thresholds, all of them heuristic">
        <p>{thresholdFile._calibration.basis}</p>
        <p className="rounded-lg border border-adjust/25 bg-adjust-soft p-3 text-ink">
          {thresholdFile._calibration.limitation}
        </p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-faint">
              <th className="py-2 font-medium">Threshold</th>
              <th className="py-2 font-medium">Value</th>
              <th className="py-2 font-medium">What it does and how it was set</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {Object.entries(thresholdFile.thresholds).map(([key, entry]) => (
              <tr key={key} className="border-b border-line/60 align-top">
                <td className="py-3 font-mono text-xs">{key}</td>
                <td className="tnum py-3">{entry.value}</td>
                <td className="py-3 text-muted">
                  {entry.meaning}
                  {entry.calibration ? (
                    <span className="mt-1 block text-xs text-faint">{entry.calibration}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs">
          Healthy-score cutoffs per concern:{" "}
          {Object.entries(thresholds.healthyByConcern)
            .map(([k, v]) => `${k} ${v}`)
            .join(", ")}
          .
        </p>
      </Section>

      <Section id="rules" title={`All ${rules.length} rules, with sources`}>
        <p>
          Every rule carries the quote that backs it and the date it was checked. Where a source says
          less than the rule claims, the rule says so rather than overclaiming.
        </p>
        <div className="mt-4 space-y-3">
          {rules.map((rule) => (
            <details key={rule.id} className="rounded-xl border border-line bg-surface p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-xs text-faint">{rule.id}</code>
                  <VerdictBadge verdict={rule.verdict} />
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      rule.verification === "verified"
                        ? "bg-accent-soft text-accent"
                        : rule.verification === "partial"
                          ? "bg-adjust-soft text-adjust"
                          : "bg-paper text-faint"
                    }`}
                  >
                    {VERIFICATION_LABEL[rule.verification]}
                  </span>
                  <span className="rounded bg-paper px-1.5 py-0.5 text-xs text-faint">
                    {rule.evidence}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink">{rule.message}</p>
              </summary>
              <div className="mt-3 border-t border-line pt-3 text-xs leading-relaxed">
                {rule.source_quote ? (
                  <blockquote className="border-l-2 border-line pl-3 italic text-muted">
                    &ldquo;{rule.source_quote}&rdquo;
                    {rule.source_accessed ? (
                      <span className="not-italic text-faint"> (checked {rule.source_accessed})</span>
                    ) : null}
                  </blockquote>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {rule.source_urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline underline-offset-2"
                    >
                      {sourceName(url)}
                    </a>
                  ))}
                </div>
                {rule.notes ? <p className="mt-2 text-muted">{rule.notes}</p> : null}
              </div>
            </details>
          ))}
        </div>
      </Section>

      <Section id="limits" title="Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-medium text-ink">Fitzpatrick from a photo is a proxy.</span> The
            real scale is about how skin responds to sun, which a camera cannot see. You can override
            it and your answer wins.
          </li>
          <li>
            <span className="font-medium text-ink">Scan scores are not clinical grades.</span> They
            describe how skin looks in one photo under one set of lighting conditions. The seven
            scales are not comparable to each other: on our bank the acne score only ever used the top
            fifth of its range, while redness used almost all of it.
          </li>
          <li>
            <span className="font-medium text-ink">The gold labels come from one clinician.</span>{" "}
            They are not externally validated and they have not been through any review process
            beyond one physician writing them.
          </li>
          <li>
            <span className="font-medium text-ink">The thresholds were calibrated on nine AI
            generated faces.</span> A generated face is not a sample of real skin.
          </li>
          <li>
            <span className="font-medium text-ink">Coverage is finite.</span> {rules.length} rules
            cover the situations we found sources for. Anything outside them gets no verdict, and a
            missing verdict is not a safety claim.
          </li>
          <li>
            <span className="font-medium text-ink">English only.</span>
          </li>
          <li>
            <span className="font-medium text-ink">Not a medical device.</span> PatchTest does not
            diagnose anything, and it is not a substitute for seeing someone.
          </li>
        </ul>
      </Section>

      <Section id="catalogue" title="The catalogue">
        <p>
          {catalog.products.length} products in a fictional store called {catalog.store}. Every
          product, name and price is invented. Hydroquinone is deliberately absent: it is not sold
          over the counter in the US and cosmetics containing it are banned in Indonesia. One rule
          still covers it, for shoppers who report already using it.
        </p>
      </Section>
    </div>
  );
}
