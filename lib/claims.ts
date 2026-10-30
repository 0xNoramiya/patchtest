/**
 * PatchTest sells cosmetics. It does not diagnose, treat or cure anything, and
 * no string it shows may imply otherwise. This is enforced two ways: a test that
 * fails the build if a fixed string breaks the rules, and a runtime filter on
 * anything an LLM wrote.
 */

const CONDITIONS =
  "acne|rosacea|eczema|psoriasis|melasma|dermatitis|hyperpigmentation|folliculitis|keratosis";

export type ClaimViolation = { phrase: string; rule: string };

const FORBIDDEN: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "no diagnosis language", pattern: /\bdiagnos(?:e|es|ed|is|ing|tic)\b/gi },
  { rule: "no cure claims", pattern: /\bcures?\b|\bcured\b|\bcuring\b/gi },
  { rule: "no treats-a-condition claims", pattern: new RegExp(`\\btreats?\\s+(?:your\\s+|the\\s+)?(?:${CONDITIONS})\\b`, "gi") },
  { rule: "no telling the shopper they have a condition", pattern: new RegExp(`\\byou\\s+(?:have|has|are suffering from)\\s+(?:${CONDITIONS})\\b`, "gi") },
  { rule: "no severity assertions from a photo", pattern: new RegExp(`\\byou\\s+have\\s+(?:severe|moderate|mild)\\b`, "gi") },
  { rule: "no clinical proof claims", pattern: /\bclinically proven\b/gi },
  { rule: "no medical advice framing", pattern: /\bmedical (?:advice|diagnosis)\b/gi },
  { rule: "no eliminates/eradicates claims", pattern: /\b(?:eliminates?|eradicates?|heals?)\s+(?:your\s+)?(?:acne|breakouts|redness)\b/gi },
];

/**
 * "It does not diagnose anything" is the disclaimer, not the claim. A negation
 * in the few words before a match clears it.
 */
const NEGATION = /\b(?:not|never|cannot|can't|doesn't|does not|don't|do not|isn't|is not|without|no)\b[^.!?]{0,24}$/i;

export function lintClaims(text: string): ClaimViolation[] {
  const found: ClaimViolation[] = [];
  for (const { rule, pattern } of FORBIDDEN) {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
      if (NEGATION.test(before)) continue;
      found.push({ phrase: match[0], rule });
    }
  }
  return found;
}

/**
 * Applied to every piece of LLM-written text before it reaches a shopper.
 * Rewrites what it can and drops the sentence when it cannot.
 */
export function sanitizeClaims(text: string): { text: string; changed: boolean } {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept: string[] = [];
  let changed = false;

  for (const sentence of sentences) {
    const working = sentence
      .replace(new RegExp(`\\btreats?\\s+(?:your\\s+|the\\s+)?(${CONDITIONS})\\b`, "gi"), "is used for the look of $1")
      .replace(/\bclinically proven\b/gi, "formulated")
      .replace(new RegExp(`\\byou\\s+have\\s+(?:severe|moderate|mild)\\s+(${CONDITIONS})\\b`, "gi"), "your scan flagged $1-related signs");

    if (working !== sentence) changed = true;

    if (lintClaims(working).length > 0) {
      changed = true;
      continue; // not rewritable, so it does not ship
    }
    kept.push(working);
  }

  const result = kept.join(" ").trim();
  return { text: result, changed };
}
