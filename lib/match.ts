import type { Product } from "./rules/load";

/**
 * Turns a product name from any shop into something the rules engine can judge.
 *
 * This is what lets PatchTest work outside its own catalogue. The rules key on
 * active classes and percentages, and skincare product names almost always
 * carry both: "Retinol 0.5% Night Serum", "Salicylic Acid 2% Exfoliating
 * Cleanser". Parsing the title gets you most of the way.
 *
 * It is deliberately conservative. A title it cannot read produces no actives,
 * which produces no verdict, and a missing verdict is never presented as a
 * safety claim.
 */

const ACTIVE_PATTERNS: Array<{ class: string; name: string; patterns: RegExp[] }> = [
  { class: "retinoid", name: "retinoid", patterns: [/\bretinols?\b/i, /\bretinal(?:dehyde)?\b/i, /\bretinyl\b/i, /\badapalene\b/i, /\btretinoin\b/i, /\btazarotene\b/i, /\bgranactive retinoid\b/i] },
  { class: "aha", name: "alpha hydroxy acid", patterns: [/\bglycolic\b/i, /\blactic\b/i, /\bmandelic\b/i, /\balpha[- ]hydroxy\b/i, /\bAHA\b/] },
  { class: "bha", name: "salicylic acid", patterns: [/\bsalicylic\b/i, /\bbeta[- ]hydroxy\b/i, /\bBHA\b/] },
  { class: "bpo", name: "benzoyl peroxide", patterns: [/\bbenzoyl\s*peroxide\b/i, /\bBPO\b/] },
  { class: "vitamin_c", name: "vitamin C", patterns: [/\bvitamin\s*c\b/i, /\bascorbic\b/i, /\bascorbate\b/i] },
  { class: "azelaic", name: "azelaic acid", patterns: [/\bazelaic\b/i] },
  { class: "niacinamide", name: "niacinamide", patterns: [/\bniacinamide\b/i] },
  { class: "peptide", name: "peptides", patterns: [/\bpeptides?\b/i, /\bmatrixyl\b/i, /\bargireline\b/i] },
  { class: "ceramide", name: "ceramides", patterns: [/\bceramides?\b/i] },
  { class: "centella", name: "centella", patterns: [/\bcentella\b/i, /\bcica\b/i, /\bmadecassoside\b/i] },
  { class: "humectant", name: "humectant", patterns: [/\bhyaluronic\b/i, /\bglycerin\b/i, /\bsqualane\b/i] },
  { class: "physical_exfoliant", name: "physical exfoliant", patterns: [/\bscrub\b/i, /\bmicrodermabrasion\b/i, /\bexfoliating beads?\b/i, /\bpolish(?:ing)?\b/i] },
  { class: "hair_removal", name: "wax", patterns: [/\bwax(?:ing)?\s*strips?\b/i, /\bdepilator/i, /\bhair removal\b/i] },
  { class: "sunscreen", name: "UV filter", patterns: [/\bSPF\s*\d+/i, /\bsunscreen\b/i, /\bsunblock\b/i, /\bzinc oxide\b/i, /\btitanium dioxide\b/i, /\bavobenzone\b/i] },
];

const RINSE_OFF = /\b(cleanser|wash|foam|shampoo|scrub|mask|peel|rinse|cleansing)\b/i;
const BODY_AREA = /\b(body|back|chest|shoulder|d[ée]collet)/i;

const TAG_PATTERNS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "peel", pattern: /\bpeel(?:ing)?\b/i },
  { tag: "cleanser", pattern: /\b(cleanser|wash|cleansing|foam)\b/i },
  { tag: "moisturizer", pattern: /\b(moisturi[sz]er|cream|lotion|balm)\b/i },
  { tag: "spf", pattern: /\b(SPF\s*\d+|sunscreen|sunblock)\b/i },
  { tag: "mineral", pattern: /\b(mineral|zinc oxide|titanium dioxide)\b/i },
  { tag: "tinted", pattern: /\btinted\b/i },
  { tag: "anti_aging", pattern: /\b(anti[- ]?aging|anti[- ]?ageing|firming|lifting|wrinkle|youth|rejuvenat)/i },
  { tag: "scrub", pattern: /\b(scrub|polish(?:ing)?|microdermabrasion)\b/i },
  { tag: "wax", pattern: /\bwax(?:ing)?\s*strips?\b/i },
  { tag: "exfoliating", pattern: /\b(exfoliat|resurfac|renewal)/i },
  { tag: "gentle", pattern: /\b(gentle|soothing|calming|barrier|hydrating)\b/i },
  { tag: "eye", pattern: /\beye\b/i },
];

/** Percentages tied to the active they sit next to, not just the first one found. */
function percentFor(name: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = pattern.exec(name);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    // Anchored, so the number has to sit against the ingredient rather than
    // merely somewhere nearby. "AHA 30% + BHA 2%" must give BHA 2, not 30.
    const after = /^\s*(?:acid\s*)?(\d+(?:\.\d+)?)\s*%/i.exec(name.slice(end, end + 18));
    if (after) return Number(after[1]);
    const before = /(\d+(?:\.\d+)?)\s*%\s*$/.exec(name.slice(Math.max(0, start - 16), start));
    if (before) return Number(before[1]);
  }
  return undefined;
}

export type ParsedProduct = Product & {
  /** How much of the title we could actually read. */
  confidence: "high" | "medium" | "low";
  parsedFrom: string;
};

export function parseProductName(rawName: string, price = 0, sku?: string): ParsedProduct {
  const name = rawName.replace(/\s+/g, " ").trim();

  const actives: Product["actives"] = [];
  for (const entry of ACTIVE_PATTERNS) {
    if (entry.patterns.some((p) => p.test(name))) {
      const pct = percentFor(name, entry.patterns);
      actives.push({ class: entry.class, name: entry.name, ...(pct !== undefined ? { pct } : {}) });
    }
  }

  const tags = TAG_PATTERNS.filter((t) => t.pattern.test(name)).map((t) => t.tag);

  // A peel at peel strength is the thing the skin tone rule cares about.
  const aha = actives.find((a) => a.class === "aha");
  if (tags.includes("peel")) {
    tags.push("at_home_peel");
    if ((aha?.pct ?? 0) >= 20) tags.push("high_strength");
  }

  const leaveOn = !RINSE_OFF.test(name);
  const area = BODY_AREA.test(name) ? "chest" : "face";

  const hasPct = actives.some((a) => a.pct !== undefined);
  const confidence: ParsedProduct["confidence"] =
    actives.length > 0 && hasPct ? "high" : actives.length > 0 ? "medium" : "low";

  return {
    sku: sku ?? `EXT-${Buffer.from(name).toString("base64url").slice(0, 10)}`,
    name,
    price,
    blurb: "",
    targets: [],
    actives,
    leave_on: leaveOn,
    area,
    tags,
    confidence,
    parsedFrom: name,
  };
}

/** Uses the real catalogue entry when a title clearly refers to one of ours. */
export function matchCatalogue(name: string, products: Product[]): Product | undefined {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return products.find((p) => {
    const target = p.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return normalized === target || normalized.includes(target) || target.includes(normalized);
  });
}
