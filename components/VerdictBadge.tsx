import type { Verdict } from "@/lib/rules/types";
import { VERDICT_CLASS, VERDICT_LABEL } from "./verdict";

export function VerdictBadge({ verdict, className = "" }: { verdict: Verdict; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium ${VERDICT_CLASS[verdict]} ${className}`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
