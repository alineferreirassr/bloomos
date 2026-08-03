import { describe, expect, it } from "vitest";
import { levenshteinDistance, isFuzzyMatch, scoreMatch, MATCH_TIER_SCORES } from "@/core/search/fuzzyMatch";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("amore", "amore")).toBe(0);
  });

  it("returns the length of the other string when one is empty", () => {
    expect(levenshteinDistance("", "bloom")).toBe(5);
    expect(levenshteinDistance("bloom", "")).toBe(5);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshteinDistance("amore", "amoro")).toBe(1);
  });

  it("counts insertions/deletions correctly", () => {
    expect(levenshteinDistance("bloom", "blooms")).toBe(1);
  });
});

describe("isFuzzyMatch", () => {
  it("matches a short term within 1 edit", () => {
    expect(isFuzzyMatch("evnt", "event")).toBe(true);
  });

  it("matches a typo within a longer term's 2-edit tolerance", () => {
    expect(isFuzzyMatch("amroe", "amore")).toBe(true);
  });

  it("rejects a candidate too far in length", () => {
    expect(isFuzzyMatch("ab", "abcdefgh")).toBe(false);
  });

  it("rejects an empty term or candidate", () => {
    expect(isFuzzyMatch("", "anything")).toBe(false);
    expect(isFuzzyMatch("anything", "")).toBe(false);
  });

  it("respects an explicit maxDistance override", () => {
    expect(isFuzzyMatch("abc", "abz", 0)).toBe(false);
    expect(isFuzzyMatch("abc", "abz", 1)).toBe(true);
  });
});

describe("scoreMatch", () => {
  it("scores an exact match at the top tier", () => {
    expect(scoreMatch("Sofia Marchetti", "Sofia Marchetti")).toEqual({ tier: "exact", score: MATCH_TIER_SCORES.exact });
  });

  it("scores a whole-string prefix match", () => {
    expect(scoreMatch("Sofia", "Sofia Marchetti")).toEqual({ tier: "prefix", score: MATCH_TIER_SCORES.prefix });
  });

  it("scores a word-prefix match when the term starts a later word", () => {
    expect(scoreMatch("March", "Sofia Marchetti")).toEqual({ tier: "wordPrefix", score: MATCH_TIER_SCORES.wordPrefix });
  });

  it("scores a substring match found mid-word", () => {
    expect(scoreMatch("chett", "Sofia Marchetti")).toEqual({ tier: "substring", score: MATCH_TIER_SCORES.substring });
  });

  it("falls back to a fuzzy match for a near-miss typo", () => {
    expect(scoreMatch("Amroe", "Amore")).toEqual({ tier: "fuzzy", score: MATCH_TIER_SCORES.fuzzy });
  });

  it("returns tier none and score 0 for a completely unrelated term", () => {
    expect(scoreMatch("zzzzzzzz", "Sofia Marchetti")).toEqual({ tier: "none", score: 0 });
  });

  it("returns tier none for an empty term", () => {
    expect(scoreMatch("", "Sofia Marchetti")).toEqual({ tier: "none", score: 0 });
  });
});
