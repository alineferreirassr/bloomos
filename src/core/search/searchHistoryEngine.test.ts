import { describe, expect, it } from "vitest";
import { recordSearchHistoryEntry, sortSearchHistoryByRecency, noResultSearchHistory, MAX_SEARCH_HISTORY } from "@/core/search/searchHistoryEngine";
import type { SearchHistoryEntry } from "@/types/globalSearch";

function makeEntry(overrides: Partial<SearchHistoryEntry> = {}): SearchHistoryEntry {
  return { id: "hist_1", workspace_id: "ws_1", member_id: "member_1", term: "vip", entityTypes: null, resultCount: 5, searched_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

describe("recordSearchHistoryEntry", () => {
  it("prepends the new entry", () => {
    const result = recordSearchHistoryEntry([], makeEntry());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("hist_1");
  });

  it("de-dupes a consecutive identical term, case-insensitively", () => {
    const existing = [makeEntry({ id: "hist_old", term: "VIP" })];
    const result = recordSearchHistoryEntry(existing, makeEntry({ id: "hist_new", term: "vip" }));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("hist_new");
  });

  it("keeps a distinct term alongside the new entry", () => {
    const existing = [makeEntry({ id: "hist_old", term: "invoices" })];
    const result = recordSearchHistoryEntry(existing, makeEntry({ id: "hist_new", term: "vip" }));
    expect(result).toHaveLength(2);
  });

  it("caps the list at MAX_SEARCH_HISTORY", () => {
    const existing = Array.from({ length: MAX_SEARCH_HISTORY }, (_, i) => makeEntry({ id: `hist_${i}`, term: `term-${i}` }));
    const result = recordSearchHistoryEntry(existing, makeEntry({ id: "hist_new", term: "new-term" }));
    expect(result).toHaveLength(MAX_SEARCH_HISTORY);
    expect(result[0].id).toBe("hist_new");
  });
});

describe("sortSearchHistoryByRecency", () => {
  it("sorts newest first", () => {
    const older = makeEntry({ id: "hist_1", searched_at: "2026-01-01T00:00:00.000Z" });
    const newer = makeEntry({ id: "hist_2", searched_at: "2026-06-01T00:00:00.000Z" });
    expect(sortSearchHistoryByRecency([older, newer]).map((e) => e.id)).toEqual(["hist_2", "hist_1"]);
  });
});

describe("noResultSearchHistory", () => {
  it("returns only entries with resultCount 0", () => {
    const entries = [makeEntry({ id: "hist_1", resultCount: 0 }), makeEntry({ id: "hist_2", resultCount: 3 })];
    expect(noResultSearchHistory(entries).map((e) => e.id)).toEqual(["hist_1"]);
  });
});
