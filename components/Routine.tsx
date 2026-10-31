import type { AdviseResult } from "@/lib/advise";
import { buildRoutine } from "@/lib/routine";

function Column({ title, steps }: { title: string; steps: ReturnType<typeof buildRoutine>["morning"] }) {
  if (steps.length === 0) return null;
  return (
    <div>
      <p className="label text-faint">{title}</p>
      <ol className="mt-2 space-y-2">
        {steps.map((step) => (
          <li key={step.sku} className="text-sm leading-relaxed">
            <span className="font-medium">{step.name}</span>
            {step.notes.map((note) => (
              <span key={note} className="mt-0.5 block text-muted">
                {note}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * When to use what is left, built from the catalogue's tags and the engine's
 * own ADJUST findings. Nothing on this page is written by the model.
 */
export function Routine({ result }: { result: AdviseResult }) {
  const products = result.lines.map((l) => l.product);
  const routine = buildRoutine(products, result.evaluation);
  if (routine.morning.length === 0 && routine.evening.length === 0) return null;

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-6">
      <h2 className="font-display text-lg">How to use it</h2>
      <p className="mt-1 text-xs text-faint">
        Built from the verdicts above, not written by the model. Any instruction here is the wording
        of the rule that produced it.
      </p>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <Column title="Morning" steps={routine.morning} />
        <Column title="Evening" steps={routine.evening} />
      </div>
    </section>
  );
}
