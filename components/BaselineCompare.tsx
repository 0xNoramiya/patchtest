"use client";

import { useState } from "react";
import type { AdviseResult } from "@/lib/advise";

export function BaselineCompare({ result }: { result: AdviseResult }) {
  const [open, setOpen] = useState(false);
  const blocked = new Set(
    result.evaluation.items.filter((i) => i.verdict === "BLOCK").map((i) => i.sku),
  );
  const kept = new Set(result.lines.map((l) => l.sku));

  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="font-display text-lg">What a plain AI advisor would have sold you</span>
        <span aria-hidden className="text-muted">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted">
            Same model, same prompt, same photo, same answers. The only thing missing is the
            guardrail. Nothing here is a strawman: the comparison prompt tells it to consider safety.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-xs uppercase tracking-wide text-faint">Without the guardrail</h3>
              <ul className="mt-2 space-y-2">
                {result.baseline.skus.map((sku) => (
                  <li key={sku} className="rounded-lg border border-line p-2.5 text-sm">
                    <span className="font-medium">{result.catalogIndex[sku]?.name ?? sku}</span>
                    <span className="tnum ml-1 text-muted">${result.catalogIndex[sku]?.price}</span>
                    {result.baseline.reasons[sku] ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {result.baseline.reasons[sku]}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {result.baseline.routineNote ? (
                <p className="mt-2 text-xs leading-relaxed text-faint">
                  {result.baseline.routineNote}
                </p>
              ) : null}
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-faint">With the guardrail</h3>
              <ul className="mt-2 space-y-2">
                {result.lines.map((line) => {
                  const verdict =
                    result.evaluation.items.find((i) => i.sku === line.sku)?.verdict ?? "OK";
                  return (
                    <li
                      key={line.sku}
                      className={`rounded-lg border p-2.5 text-sm ${verdict === "BLOCK" ? "border-block/25 bg-block-soft line-through decoration-block/40" : "border-line"}`}
                    >
                      <span className="font-medium">{line.product.name}</span>
                      <span className="tnum ml-1 text-muted">${line.product.price}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-paper p-3 text-xs leading-relaxed text-muted">
            Across our 40 scenarios the plain advisor proposed nothing that our clinical labels call
            unsafe. Where it fell short was what it left unsaid: it sold an item needing a usage
            caveat without giving one in 44.4% of applicable runs, against 11.1% here. It also gave
            the same shopper a different cart on 40% of repeated runs.{" "}
            <a href="/eval" className="text-accent underline underline-offset-2">
              See the full eval
            </a>
            .
            {blocked.size > 0 && blocked.size === [...blocked].filter((s) => kept.has(s)).length
              ? ""
              : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
