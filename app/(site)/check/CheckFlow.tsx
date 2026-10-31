"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BaselineCompare } from "@/components/BaselineCompare";
import { CartList } from "@/components/CartList";
import { IntakeForm } from "@/components/Intake";
import { Referrals } from "@/components/Referrals";
import { LiveScan, type BudgetState } from "@/components/LiveScan";
import { ProductImage } from "@/components/ProductImage";
import { ScanPanel } from "@/components/ScanPanel";
import type { AdviseResult } from "@/lib/advise";
import { EMPTY_INTAKE, type Intake } from "@/lib/intake";
import type { Preset } from "@/lib/presets";
import type { ScanListing } from "@/app/api/scans/route";

type Step = "consent" | "intake" | "cart" | "scan" | "working" | "results";

type CatalogItem = { sku: string; name: string; price: number; blurb: string; tags: string[] };

const STEP_ORDER: Step[] = ["consent", "intake", "cart", "scan", "results"];

function Progress({ step }: { step: Step }) {
  const index = STEP_ORDER.indexOf(step === "working" ? "scan" : step);
  return (
    <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-1 text-xs text-faint">
      {["Consent", "About you", "Your cart", "Your scan", "Verdicts"].map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span className={i <= index ? "font-medium text-accent" : ""}>{label}</span>
          {i < 4 ? <span aria-hidden>&rsaquo;</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function CheckFlow() {
  const params = useSearchParams();
  const presetId = params.get("preset");

  // Starting on "consent" would flash that screen before the preset effect runs.
  const [step, setStep] = useState<Step>(presetId ? "working" : "consent");
  const [intake, setIntake] = useState<Intake>(EMPTY_INTAKE);
  const [wanted, setWanted] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [scans, setScans] = useState<ScanListing[]>([]);
  const [result, setResult] = useState<AdviseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetState | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setCatalog(d.products)).catch(() => {});
    fetch("/api/scans").then((r) => r.json()).then((d) => setScans(d.scans)).catch(() => {});
    fetch("/api/budget").then((r) => r.json()).then(setBudget).catch(() => {});
  }, []);

  const run = useCallback(
    async (scanLabel: string, intakeToUse: Intake, wantedSkus: string[]) => {
      setStep("working");
      setError(null);
      try {
        const res = await fetch("/api/advise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scanLabel, intake: intakeToUse, wantedSkus }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        const advice = data as AdviseResult;
        setResult(advice);
        setStep("results");

        // Left here for the browser extension to pick up. It stays on this
        // device: it is read by the extension's content script on this origin
        // and never sent anywhere by the page itself.
        try {
          window.localStorage.setItem(
            "patchtest.profile",
            JSON.stringify({
              intake: intakeToUse,
              scanLabel,
              fitzpatrick: advice.fitzpatrick.value,
              savedAt: new Date().toISOString(),
            }),
          );
        } catch {
          // Blocked storage is not worth failing the page over.
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setStep("scan");
      }
    },
    [],
  );

  // A preset skips straight to the answer, which is what the demo needs.
  useEffect(() => {
    if (!presetId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/presets");
      const { presets } = (await res.json()) as { presets: Preset[] };
      if (cancelled) return;
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) {
        // Otherwise an unknown id leaves the page spinning on "working" for ever.
        setError(`There is no preset called "${presetId}". Pick one from the home page.`);
        setStep("consent");
        return;
      }
      const presetIntake: Intake = { ...EMPTY_INTAKE, ...preset.intake, goal: preset.goal };
      setIntake(presetIntake);
      setWanted(preset.wantedSkus);
      await run(preset.scanLabel, presetIntake, preset.wantedSkus);
    })();
    return () => { cancelled = true; };
  }, [presetId, run]);

  if (step === "results" && result) {
    return (
      <div className="anim-rise mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl">What we found</h1>
          <Link href="/check" className="text-sm text-accent underline underline-offset-2">
            Start again
          </Link>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {result.revisionRounds > 0
            ? `The advisor proposed a cart, our rules rejected part of it, and it revised ${result.revisionRounds} time${result.revisionRounds > 1 ? "s" : ""}.`
            : "The advisor proposed a cart and our rules checked every item in it."}{" "}
          Final verdicts are always computed by the rules, never written by the model.
        </p>

        <div className="mt-6 space-y-5">
          <Referrals result={result} />
          <CartList result={result} />
          <section className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6">
            <h2 className="font-display text-lg">How to use it</h2>
            {result.routineNote ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{result.routineNote}</p>
                {result.claimsFiltered ? (
                  <p className="mt-2 text-xs text-faint">
                    Part of what the model wrote was rewritten or removed by our claim filter.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                The usage note is written by the model, from the routine it proposed. This time the
                rules ended up with a different cart to the one it described, so it is withheld
                rather than shown next to a cart it does not match. The verdicts above are the
                engine&rsquo;s and are unaffected.
              </p>
            )}
          </section>
          <ScanPanel result={result} />
          <BaselineCompare result={result} />

          <section className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6">
            <h2 className="font-display text-lg">Take this to other shops</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              PatchTest also ships as a browser extension. It reads the cart on a shop&rsquo;s own
              page, matches each product title to its active ingredients and strengths, and applies
              these same rules there. Your profile from this scan has been saved to this browser for
              it to pick up.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href="/store"
                className="press rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-accent"
              >
                Open the demo shop
              </a>
              <a
                href="/extension"
                className="press rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-accent"
              >
                How to install it
              </a>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Progress step={step} />

      {step === "consent" ? (
        <section className="anim-rise">
          <h1 className="font-display text-3xl">Before we start</h1>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
            <p>
              <span className="font-medium text-ink">What gets sent.</span> If you run a live scan,
              your photo is sent to YouCam, which is Perfect Corp, to be analyzed. YouCam says
              results and generated images are kept for about 24 hours and then deleted.
            </p>
            <p>
              <span className="font-medium text-ink">What we keep.</span> Nothing about you is stored
              on our server beyond the scan scores, which we cache so the same photo is never
              charged twice. We do not store your photo. We do not ask for your name or email.
            </p>
            <p>
              <span className="font-medium text-ink">What this is not.</span> PatchTest is a
              hackathon project. It is not a medical device and it does not diagnose anything. Scan
              scores describe how skin looks in a photo, not your health.
            </p>
            <p>
              <span className="font-medium text-ink">In this demo</span> you will choose from scans
              that were already run through the YouCam APIs, so no new photo of you is sent anywhere.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("intake")}
            className="press mt-7 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90"
          >
            I understand, continue
          </button>
        </section>
      ) : null}

      {step === "intake" ? (
        <section className="anim-rise">
          <h1 className="font-display text-3xl">About you</h1>
          <p className="mt-2 text-sm text-muted">
            This takes about 30 seconds. Everything here is what you tell us, not what we guess.
          </p>
          <div className="mt-6">
            <IntakeForm value={intake} onChange={setIntake} />
          </div>
          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("cart")}
              className="press rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90"
            >
              Next
            </button>
            <button type="button" onClick={() => setStep("consent")} className="text-sm text-muted">
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === "cart" ? (
        <section className="anim-rise">
          <h1 className="font-display text-3xl">What is in your cart?</h1>
          <p className="mt-2 text-sm text-muted">
            Pick anything you were already planning to buy. We will give each one a verdict, even if
            the answer is no. Leave it empty and we will just suggest a routine.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {catalog.map((item) => {
              const checked = wanted.includes(item.sku);
              return (
                <li key={item.sku}>
                  <label
                    className={`flex h-full cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors ${
                      checked ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setWanted(checked ? wanted.filter((s) => s !== item.sku) : [...wanted, item.sku])
                      }
                      className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                    />
                    <ProductImage sku={item.sku} name={item.name} size={40} />
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{item.name}</span>
                      <span className="tnum block text-xs text-muted">${item.price}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-7 flex gap-3">
            <button
              type="button"
              onClick={() => setStep("scan")}
              className="press rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90"
            >
              Next
            </button>
            <button type="button" onClick={() => setStep("intake")} className="text-sm text-muted">
              Back
            </button>
          </div>
        </section>
      ) : null}

      {step === "scan" ? (
        <section className="anim-rise">
          <h1 className="font-display text-3xl">Choose a scan</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Every one of these is a real result from the YouCam AI Skin Analysis and AI Fitzpatrick
            Skin Type APIs, recorded once and replayed since. The faces are AI generated, so nobody
            real is being analyzed here. The number shown is each face&rsquo;s lowest measured score.
          </p>
          {error ? (
            <p className="mt-4 rounded-lg border border-block/25 bg-block-soft p-3 text-sm text-block">
              {error}
            </p>
          ) : null}

          {liveOpen && budget ? (
            <div className="mt-5">
              <LiveScan
                budget={budget}
                onScanned={(label) => run(label, intake, wanted)}
                onCancel={() => setLiveOpen(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLiveOpen(true)}
              className="press mt-5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-accent"
            >
              Or run a live scan on your own photo
              {budget && !budget.liveAvailable ? (
                <span className="ml-2 text-xs text-faint">(currently unavailable)</span>
              ) : null}
            </button>
          )}
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {scans.map((scan) => (
              <li key={scan.label}>
                <button
                  type="button"
                  onClick={() => run(scan.label, intake, wanted)}
                  className="press block w-full overflow-hidden rounded-xl border border-line bg-surface text-left shadow-card hover:border-accent/50 hover:shadow-raised"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scan.imagePath} alt="" className="aspect-[3/4] w-full object-cover" />
                  <span className="block p-2.5 text-xs">
                    <span className="block font-medium">Fitzpatrick {scan.fitzpatrick}</span>
                    <span className="tnum block text-faint">
                      {scan.skinType}
                      {scan.headline ? ` · ${scan.headline.concern.replace("_", " ")} ${scan.headline.raw.toFixed(0)}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setStep("cart")} className="mt-6 text-sm text-muted">
            Back
          </button>
        </section>
      ) : null}

      {step === "working" ? (
        <section className="anim-rise py-16 text-center">
          <p className="font-display text-2xl">Checking your cart</p>
          <p className="mt-2 text-sm text-muted">
            Reading the scan, running the advisor, then applying every rule.
          </p>
        </section>
      ) : null}
    </div>
  );
}
