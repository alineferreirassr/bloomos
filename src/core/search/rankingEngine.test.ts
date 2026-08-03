import { describe, expect, it } from "vitest";
import { applyRankingBoosts, buildResultKey, RECENCY_BOOST, FAVORITE_BOOST } from "@/core/search/rankingEngine";
import type { SearchResult } from "@/core/search/types";

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return { entityType: "client", entityId: "client_1", title: "Naomi Whitfield", route: "/clients/client_1", ...overrides };
}

describe("buildResultKey", () => {
  it("joins entityType and entityId with a colon", () => {
    expect(buildResultKey("client", "client_1")).toBe("client:client_1");
  });
});

describe("applyRankingBoosts", () => {
  it("returns the same array reference when no boost context is given", () => {
    const results = [makeResult()];
    expect(applyRankingBoosts(results, {})).toBe(results);
  });

  it("boosts a result whose key is in recentKeys", () => {
    const results = [makeResult({ score: 50 })];
    const [boosted] = applyRankingBoosts(results, { recentKeys: new Set(["client:client_1"]) });
    expect(boosted.score).toBe(50 + RECENCY_BOOST);
  });

  it("boosts a result whose key is in favoriteKeys", () => {
    const results = [makeResult({ score: 50 })];
    const [boosted] = applyRankingBoosts(results, { favoriteKeys: new Set(["client:client_1"]) });
    expect(boosted.score).toBe(50 + FAVORITE_BOOST);
  });

  it("stacks both boosts when a result is both recent and favorited", () => {
    const results = [makeResult({ score: 50 })];
    const [boosted] = applyRankingBoosts(results, { recentKeys: new Set(["client:client_1"]), favoriteKeys: new Set(["client:client_1"]) });
    expect(boosted.score).toBe(50 + RECENCY_BOOST + FAVORITE_BOOST);
  });

  it("treats an unscored result as score 0 before boosting", () => {
    const results = [makeResult({ score: undefined })];
    const [boosted] = applyRankingBoosts(results, { favoriteKeys: new Set(["client:client_1"]) });
    expect(boosted.score).toBe(FAVORITE_BOOST);
  });

  it("leaves an unrelated result untouched", () => {
    const results = [makeResult({ score: 50 })];
    const [unchanged] = applyRankingBoosts(results, { favoriteKeys: new Set(["client:someone_else"]) });
    expect(unchanged.score).toBe(50);
  });

  it("never mutates the input array", () => {
    const results = [makeResult({ score: 50 })];
    const original = results[0];
    applyRankingBoosts(results, { favoriteKeys: new Set(["client:client_1"]) });
    expect(results[0]).toBe(original);
    expect(original.score).toBe(50);
  });
});
