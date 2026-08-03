import { describe, expect, it } from "vitest";
import { computeSearchAnalytics } from "@/core/search/searchAnalyticsEngine";
import type { SearchHistoryEntry } from "@/types/globalSearch";
import type { WorkspaceFavorite, WorkspaceRecentItem } from "@/types/smartWorkspace";

function makeHistory(overrides: Partial<SearchHistoryEntry> = {}): SearchHistoryEntry {
  return { id: "hist_1", workspace_id: "ws_1", member_id: "member_1", term: "vip", entityTypes: null, resultCount: 5, searched_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makeRecentItem(overrides: Partial<WorkspaceRecentItem> = {}): WorkspaceRecentItem {
  return { id: "recent_1", workspace_id: "ws_1", member_id: "member_1", entity_type: "client", entity_id: "client_1", label: "Naomi Whitfield", href: "/clients/client_1", viewed_at: "2026-01-01T00:00:00.000Z", visit_count: 1, action: "view", ...overrides };
}

function makeFavorite(overrides: Partial<WorkspaceFavorite> = {}): WorkspaceFavorite {
  return { id: "fav_1", workspace_id: "ws_1", member_id: "member_1", entity_type: "client", entity_id: "client_1", label: "Naomi Whitfield", href: "/clients/client_1", created_at: "2026-01-01T00:00:00.000Z", pinned: false, ...overrides };
}

describe("computeSearchAnalytics", () => {
  it("returns all zeros for an empty history", () => {
    const summary = computeSearchAnalytics([], [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.totalSearches).toBe(0);
    expect(summary.averageResultCount).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.noResultRate).toBe(0);
    expect(summary.mostSearchedTerms).toEqual([]);
  });

  it("counts total searches and computes averageResultCount", () => {
    const history = [makeHistory({ resultCount: 4 }), makeHistory({ id: "hist_2", resultCount: 6 })];
    const summary = computeSearchAnalytics(history, [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.totalSearches).toBe(2);
    expect(summary.averageResultCount).toBe(5);
  });

  it("computes successRate and noResultRate as 0-1 fractions", () => {
    const history = [makeHistory({ id: "hist_1", resultCount: 0 }), makeHistory({ id: "hist_2", resultCount: 1 }), makeHistory({ id: "hist_3", resultCount: 1 }), makeHistory({ id: "hist_4", resultCount: 1 })];
    const summary = computeSearchAnalytics(history, [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.noResultRate).toBe(0.25);
    expect(summary.successRate).toBe(0.75);
  });

  it("ranks mostSearchedTerms by frequency, case-insensitively", () => {
    const history = [makeHistory({ id: "hist_1", term: "VIP" }), makeHistory({ id: "hist_2", term: "vip" }), makeHistory({ id: "hist_3", term: "invoices" })];
    const summary = computeSearchAnalytics(history, [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.mostSearchedTerms[0]).toEqual({ term: "vip", count: 2 });
  });

  it("collects noResultSearches from history entries with resultCount 0", () => {
    const history = [makeHistory({ id: "hist_1", resultCount: 0, term: "obscure" })];
    const summary = computeSearchAnalytics(history, [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.noResultSearches).toEqual([{ term: "obscure", searched_at: "2026-01-01T00:00:00.000Z" }]);
  });

  it("finds the most-visited recent item as mostOpenedResult", () => {
    const recentItems = [makeRecentItem({ id: "recent_1", visit_count: 2 }), makeRecentItem({ id: "recent_2", visit_count: 9, label: "Ana" })];
    const summary = computeSearchAnalytics([], recentItems, [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.mostOpenedResult).toEqual({ entity_type: "client", entity_id: "client_1", label: "Ana", visit_count: 9 });
  });

  it("returns null mostOpenedResult when there are no recent items", () => {
    const summary = computeSearchAnalytics([], [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.mostOpenedResult).toBeNull();
  });

  it("finds the first pinned favorite as mostPinnedResult", () => {
    const favorites = [makeFavorite({ pinned: false }), makeFavorite({ id: "fav_2", pinned: true, label: "Pinned Client" })];
    const summary = computeSearchAnalytics([], [], favorites, [], "2026-06-01T00:00:00.000Z");
    expect(summary.mostPinnedResult).toEqual({ entity_type: "client", entity_id: "client_1", label: "Pinned Client" });
  });

  it("returns null mostPinnedResult when nothing is pinned", () => {
    const favorites = [makeFavorite({ pinned: false })];
    const summary = computeSearchAnalytics([], [], favorites, [], "2026-06-01T00:00:00.000Z");
    expect(summary.mostPinnedResult).toBeNull();
  });

  it("passes command usage straight through as mostSearchedCommands", () => {
    const commandUsage = [{ commandId: "nav-dashboard", count: 3 }];
    const summary = computeSearchAnalytics([], [], [], commandUsage, "2026-06-01T00:00:00.000Z");
    expect(summary.mostSearchedCommands).toEqual(commandUsage);
  });

  it("stamps evaluatedAt from the given timestamp", () => {
    const summary = computeSearchAnalytics([], [], [], [], "2026-06-01T00:00:00.000Z");
    expect(summary.evaluatedAt).toBe("2026-06-01T00:00:00.000Z");
  });
});
