import type { Verdict } from "@/lib/rules/types";

export const VERDICT_LABEL: Record<Verdict, string> = {
  BLOCK: "Not for you right now",
  ADJUST: "Adjust",
  UNNECESSARY: "You don't need this",
  REFER: "Worth showing a professional",
  ADD: "Added",
  OK: "Looks fine",
};

export const VERDICT_CLASS: Record<Verdict, string> = {
  BLOCK: "bg-block-soft text-block border-block/25",
  ADJUST: "bg-adjust-soft text-adjust border-adjust/25",
  UNNECESSARY: "bg-unnecessary-soft text-unnecessary border-unnecessary/25",
  REFER: "bg-refer-soft text-refer border-refer/25",
  ADD: "bg-accent-soft text-accent border-accent/25",
  OK: "bg-accent-soft text-accent border-accent/25",
};

/** Short human label for a source domain, used on the "Source" links. */
export function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("aad.org")) return "AAD";
    if (host.includes("nhs.uk")) return "NHS";
    if (host.includes("fda.gov")) return "FDA";
    if (host.includes("dailymed")) return "FDA label";
    if (host.includes("mothertobaby")) return "MotherToBaby";
    if (host.includes("pubmed") || host.includes("pmc.ncbi")) return "PubMed";
    if (host.includes("law.cornell")) return "21 CFR";
    return host;
  } catch {
    return "Source";
  }
}
