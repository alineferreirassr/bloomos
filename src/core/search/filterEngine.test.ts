import { describe, expect, it } from "vitest";
import { applySearchResultFilters } from "@/core/search/filterEngine";
import type { SearchResult } from "@/core/search/types";

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return { entityType: "client", entityId: "client_1", title: "Naomi Whitfield", route: "/clients/client_1", ...overrides };
}

describe("applySearchResultFilters", () => {
  it("returns all results unchanged when no filters are given", () => {
    const results = [makeResult()];
    expect(applySearchResultFilters(results)).toBe(results);
  });

  it("filters by entityTypes", () => {
    const results = [makeResult({ entityType: "client" }), makeResult({ entityType: "lead", entityId: "lead_1" })];
    expect(applySearchResultFilters(results, { entityTypes: ["lead"] })).toHaveLength(1);
  });

  it("excludes a result missing a status when a status filter is set", () => {
    const results = [makeResult({ status: undefined })];
    expect(applySearchResultFilters(results, { statuses: ["active"] })).toHaveLength(0);
  });

  it("keeps a result whose status matches the filter", () => {
    const results = [makeResult({ status: "active" })];
    expect(applySearchResultFilters(results, { statuses: ["active"] })).toHaveLength(1);
  });

  it("filters by owner", () => {
    const results = [makeResult({ owner: "Ana" }), makeResult({ owner: "Marina", entityId: "client_2" })];
    expect(applySearchResultFilters(results, { owners: ["Ana"] })).toHaveLength(1);
  });

  it("filters by tags, requiring at least one overlap", () => {
    const results = [makeResult({ tags: ["vip"] }), makeResult({ tags: ["standard"], entityId: "client_2" })];
    expect(applySearchResultFilters(results, { tags: ["vip"] })).toHaveLength(1);
  });

  it("filters by archived state", () => {
    const results = [makeResult({ archived: true }), makeResult({ archived: false, entityId: "client_2" })];
    expect(applySearchResultFilters(results, { archived: true })).toHaveLength(1);
  });

  it("excludes a result below minHealth", () => {
    const results = [makeResult({ health: 40 }), makeResult({ health: 90, entityId: "client_2" })];
    expect(applySearchResultFilters(results, { minHealth: 80 })).toHaveLength(1);
  });

  it("filters by updatedAfter/updatedBefore bounds", () => {
    const results = [
      makeResult({ lastUpdatedAt: "2026-01-01T00:00:00.000Z" }),
      makeResult({ lastUpdatedAt: "2026-06-01T00:00:00.000Z", entityId: "client_2" }),
    ];
    expect(applySearchResultFilters(results, { updatedAfter: "2026-03-01T00:00:00.000Z" })).toHaveLength(1);
    expect(applySearchResultFilters(results, { updatedBefore: "2026-03-01T00:00:00.000Z" })).toHaveLength(1);
  });

  it("combines multiple filter fields with AND semantics", () => {
    const results = [makeResult({ entityType: "client", archived: false }), makeResult({ entityType: "client", archived: true, entityId: "client_2" })];
    expect(applySearchResultFilters(results, { entityTypes: ["client"], archived: false })).toHaveLength(1);
  });
});
