import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintClaims, sanitizeClaims } from "./claims";
import { loadCatalog, loadRules } from "./rules/load";

describe("the claim linter catches what it should", () => {
  it.each([
    "This will diagnose your skin",
    "A cure for breakouts",
    "Treats acne in four weeks",
    "You have severe acne",
    "Clinically proven to work",
    "Eliminates acne fast",
  ])("rejects %s", (text) => {
    expect(lintClaims(text).length).toBeGreaterThan(0);
  });

  it.each([
    "Not for you right now. Pregnancy guidance says to avoid retinoids.",
    "Your acne raw_score is 81.7 out of 100.",
    "Worth showing a professional.",
    "A daily wash for skin that looks congested.",
    "Do you get deep, painful bumps or scarring?",
  ])("allows %s", (text) => {
    expect(lintClaims(text)).toStrictEqual([]);
  });
});

describe("the runtime filter rewrites or drops LLM text", () => {
  it("rewrites a treats-a-condition claim", () => {
    const { text, changed } = sanitizeClaims("This serum treats acne quickly.");
    expect(changed).toBe(true);
    expect(lintClaims(text)).toStrictEqual([]);
  });

  it("drops a sentence it cannot rewrite", () => {
    const { text } = sanitizeClaims("Start with the cleanser. We will diagnose you. Then moisturize.");
    expect(text).toBe("Start with the cleanser. Then moisturize.");
  });

  it("leaves clean text untouched", () => {
    const input = "Use the cleanser at night and sunscreen every morning.";
    expect(sanitizeClaims(input)).toStrictEqual({ text: input, changed: false });
  });
});

describe("every shipped string passes the linter", () => {
  it("passes for all rule messages and notes", () => {
    for (const rule of loadRules()) {
      for (const field of [rule.message, rule.notes ?? "", rule.source_quote]) {
        expect(lintClaims(field), `${rule.id}: ${field}`).toStrictEqual([]);
      }
    }
  });

  it("passes for every product name and blurb", () => {
    for (const p of loadCatalog().products) {
      expect(lintClaims(`${p.name} ${p.blurb}`), p.sku).toStrictEqual([]);
    }
  });

  it("passes for every string in the UI source", () => {
    const files = JSON.parse(readFileSync("eval/ui-strings.json", "utf8")) as string[];
    for (const text of files) {
      expect(lintClaims(text), text).toStrictEqual([]);
    }
  });
});
