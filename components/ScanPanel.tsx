"use client";

import { useState } from "react";
import type { AdviseResult } from "@/lib/advise";
import { SCORED_CONCERNS } from "@/lib/youcam/parse";

const CONCERN_LABEL: Record<string, string> = {
  acne: "Blemishes",
  redness: "Redness",
  oiliness: "Oiliness",
  moisture: "Moisture",
  age_spot: "Dark spots",
  wrinkle: "Lines",
  texture: "Texture",
};

export function ScanPanel({ result }: { result: AdviseResult }) {
  const [active, setActive] = useState<string | null>(null);
  const { scan, maskPaths, imagePath } = result;
  const maskSrc = active ? maskPaths[active] : undefined;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl">Your scan</h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
          Replayed scan, recorded from a real YouCam API call
        </span>
      </div>

      <div className="mt-5 grid gap-6 sm:grid-cols-[minmax(0,260px)_1fr]">
        <div>
          <div className="relative overflow-hidden rounded-lg border border-line bg-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePath} alt="The photo that was analyzed" className="block w-full" />
            {maskSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={maskSrc}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            ) : null}
          </div>
          <p className="mt-2 text-xs text-faint">
            {active
              ? `Showing where the engine found ${CONCERN_LABEL[active]?.toLowerCase() ?? active}.`
              : "Select a row to overlay what the engine measured."}
          </p>
        </div>

        <div>
          <table className="w-full text-sm">
            <caption className="sr-only">Skin analysis scores, higher is healthier</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                <th scope="col" className="pb-2 font-medium">Concern</th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Measured
                  <span className="block font-normal normal-case tracking-normal">raw_score</span>
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Shown by YouCam
                  <span className="block font-normal normal-case tracking-normal">ui_score</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {SCORED_CONCERNS.map((concern) => {
                const score = scan.concerns[concern];
                if (!score) return null;
                const isActive = active === concern;
                const gap = score.ui - score.raw;
                return (
                  <tr key={concern} className="border-b border-line/60 last:border-0">
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => setActive(isActive ? null : concern)}
                        aria-pressed={isActive}
                        className={`rounded px-1.5 py-0.5 text-left ${isActive ? "bg-accent-soft text-accent" : "hover:bg-paper"}`}
                      >
                        {CONCERN_LABEL[concern] ?? concern}
                      </button>
                    </td>
                    <td className="tnum py-2 text-right font-medium">{score.raw.toFixed(1)}</td>
                    <td className="tnum py-2 text-right text-muted">
                      {score.ui}
                      {gap >= 10 ? (
                        <span className="ml-1.5 text-xs text-adjust">+{gap.toFixed(0)}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
            <dt className="text-muted">Skin type label</dt>
            <dd className="text-right">{scan.skinType.whole ?? "not returned"}</dd>
            <dt className="text-muted">Fitzpatrick type</dt>
            <dd className="text-right">
              {result.fitzpatrick.value ?? "not determined"}
              <span className="ml-1 text-xs text-faint">
                {result.fitzpatrick.source === "self_reported" ? "you told us" : "from the photo"}
              </span>
            </dd>
            <dt className="text-muted">
              Skin age estimate
              <span className="block text-xs text-faint">display only, never used in a decision</span>
            </dt>
            <dd className="text-right text-muted">{scan.skinAge ?? "not returned"}</dd>
          </dl>

          <p className="mt-4 rounded-lg bg-paper p-3 text-xs leading-relaxed text-muted">
            PatchTest decides on the measured <code className="font-mono">raw_score</code>. YouCam
            documents <code className="font-mono">ui_score</code> as adjusted to be more favourable,
            as a psychological motivator. Both are shown here so you can see the difference. These
            are appearance scores, not a health assessment.
          </p>
        </div>
      </div>
    </section>
  );
}
