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

/** Lower raw_score means less healthy, so the bar gets more urgent as it shortens. */
function toneFor(raw: number): { bar: string; text: string } {
  if (raw < 40) return { bar: "bg-block", text: "text-block" };
  if (raw < 70) return { bar: "bg-adjust", text: "text-adjust" };
  return { bar: "bg-ok/35", text: "text-muted" };
}

function ScoreTrack({ raw, ui, index }: { raw: number; ui: number; index: number }) {
  const gap = ui - raw;
  const inflated = gap >= 8;
  const tone = toneFor(raw);
  const left = Math.min(raw, ui);
  const width = Math.abs(gap);
  // Vertical placement uses top rather than a translate, so transform stays
  // free for the scaleX that animates the bar.
  const rail = { top: "calc(50% - 3px)" } as const;
  const i = { "--i": index } as React.CSSProperties;

  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 h-1.5 rounded-full bg-sunken" style={rail} />

      {inflated ? (
        <div
          className="anim-fade absolute h-1.5 rounded-full bg-adjust/25"
          style={{ ...rail, ...i, left: `${left}%`, width: `${width}%` }}
        />
      ) : null}

      <div
        className={`anim-bar absolute left-0 h-1.5 w-full rounded-full ${tone.bar}`}
        style={{ ...rail, ...i, transform: `scaleX(${Math.max(raw, 1.5) / 100})` }}
      />

      {inflated ? (
        <span
          aria-hidden
          className="anim-mark pointer-events-none absolute h-3 w-3 rounded-full border-2 border-adjust bg-surface"
          style={{ ...i, top: "50%", left: `${ui}%`, transform: "translate(-50%, -50%)" }}
        />
      ) : null}
    </div>
  );
}

export function ScanPanel({ result }: { result: AdviseResult }) {
  const [active, setActive] = useState<string | null>(null);
  const { scan, maskPaths, imagePath } = result;
  const maskSrc = active ? maskPaths[active] : undefined;

  const gaps = SCORED_CONCERNS.flatMap((c) => {
    const s = scan.concerns[c];
    return s ? [{ concern: c as string, gap: s.ui - s.raw, raw: s.raw, ui: s.ui }] : [];
  }).sort((a, b) => b.gap - a.gap);
  const biggestGap = gaps[0];

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-4 sm:px-6">
        <h2 className="font-display text-xl">Your scan</h2>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
          Replayed from a real YouCam API call
        </span>
      </div>

      <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,240px)_1fr]">
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePath}
              alt="The photo that was analyzed"
              className="block h-full w-full object-cover"
            />
            {maskSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={maskSrc}
                src={maskSrc}
                alt=""
                aria-hidden
                className="anim-fade pointer-events-none absolute inset-0 h-full w-full object-contain"
              />
            ) : null}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            {active
              ? `Showing where the engine found ${(CONCERN_LABEL[active] ?? active).toLowerCase()}.`
              : "Select a concern to overlay what the engine measured."}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2 text-xs">
            <span className="label text-faint">Concern</span>
            <span className="label text-faint">Measured vs shown</span>
          </div>

          <ul className="space-y-2.5">
            {SCORED_CONCERNS.map((concern, index) => {
              const score = scan.concerns[concern];
              if (!score) return null;
              const isActive = active === concern;
              const gap = score.ui - score.raw;
              const tone = toneFor(score.raw);
              return (
                <li key={concern}>
                  <button
                    type="button"
                    onClick={() => setActive(isActive ? null : concern)}
                    aria-pressed={isActive}
                    className={`press w-full rounded-lg px-2 py-1.5 text-left ${isActive ? "bg-accent-soft" : "hover:bg-sunken"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm">{CONCERN_LABEL[concern] ?? concern}</span>
                      <span className="tnum text-sm">
                        <span className={`font-medium ${tone.text}`}>{score.raw.toFixed(1)}</span>
                        <span className="text-faint"> / {score.ui}</span>
                        {gap >= 8 ? (
                          <span className="ml-1 text-xs font-medium text-adjust">
                            +{gap.toFixed(0)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <ScoreTrack raw={score.raw} ui={score.ui} index={index} />
                  </button>
                </li>
              );
            })}
          </ul>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4 text-sm">
            <dt className="text-muted">Skin type label</dt>
            <dd className="text-right font-medium">{scan.skinType.whole ?? "not returned"}</dd>
            <dt className="text-muted">Fitzpatrick type</dt>
            <dd className="text-right font-medium">
              {result.fitzpatrick.value ?? "not determined"}
              <span className="ml-1 font-normal text-xs text-faint">
                {result.fitzpatrick.source === "self_reported" ? "you told us" : "from the photo"}
              </span>
            </dd>
            <dt className="text-muted">
              Skin age estimate
              <span className="block text-xs text-faint">display only, never used in a decision</span>
            </dt>
            <dd className="tnum text-right text-muted">{scan.skinAge ?? "not returned"}</dd>
          </dl>

          <p className="mt-4 rounded-lg bg-sunken p-3 text-xs leading-relaxed text-muted">
            YouCam returns two numbers per concern, for two different jobs. The solid bar is the{" "}
            <span className="font-medium text-ink">measured</span>{" "}
            <code className="font-mono">raw_score</code>. The ring is the{" "}
            <code className="font-mono">ui_score</code>, documented as a{" "}
            <span className="font-medium text-ink">motivator</span>, the number most apps show you.
            {biggestGap && biggestGap.gap >= 8 ? (
              <>
                {" "}
                Here the largest gap is{" "}
                <span className="font-medium text-ink">
                  {(CONCERN_LABEL[biggestGap.concern] ?? biggestGap.concern).toLowerCase()}
                </span>
                , measured at{" "}
                <span className="tnum font-medium text-ink">{biggestGap.raw.toFixed(1)}</span> and
                presented as <span className="tnum font-medium text-ink">{biggestGap.ui}</span>.
              </>
            ) : null}{" "}
            PatchTest decides on the measured number. These are appearance scores, not a health
            assessment.
          </p>
        </div>
      </div>
    </section>
  );
}
