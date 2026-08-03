import { describe, expect, it } from "vitest";
import { sortSavedSearchesByRecency, removeSavedSearchById, findSavedSearchByLabel } from "@/core/search/savedSearchesEngine";
import type { SavedSearch } from "@/types/globalSearch";

function makeSaved(overrides: Partial<SavedSearch> = {}): SavedSearch {
  return { id: "saved_1", workspace_id: "ws_1", member_id: "member_1", label: "VIP Clients", term: "vip", filters: null, created_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

describe("sortSavedSearchesByRecency", () => {
  it("sorts newest first", () => {
    const older = makeSaved({ id: "saved_1", created_at: "2026-01-01T00:00:00.000Z" });
    const newer = makeSaved({ id: "saved_2", created_at: "2026-06-01T00:00:00.000Z" });
    expect(sortSavedSearchesByRecency([older, newer]).map((s) => s.id)).toEqual(["saved_2", "saved_1"]);
  });

  it("does not mutate the input array", () => {
    const searches = [makeSaved({ id: "saved_1" }), makeSaved({ id: "saved_2", created_at: "2026-06-01T00:00:00.000Z" })];
    const original = [...searches];
    sortSavedSearchesByRecency(searches);
    expect(searches).toEqual(original);
  });
});

describe("removeSavedSearchById", () => {
  it("removes the matching saved search", () => {
    const searches = [makeSaved({ id: "saved_1" }), makeSaved({ id: "saved_2" })];
    expect(removeSavedSearchById(searches, "saved_1").map((s) => s.id)).toEqual(["saved_2"]);
  });

  it("is a no-op when the id isn't found", () => {
    const searches = [makeSaved({ id: "saved_1" })];
    expect(removeSavedSearchById(searches, "nonexistent")).toHaveLength(1);
  });
});

describe("findSavedSearchByLabel", () => {
  it("finds a saved search by exact label match, case-insensitively", () => {
    const searches = [makeSaved({ label: "VIP Clients" })];
    expect(findSavedSearchByLabel(searches, "vip clients")?.id).toBe("saved_1");
  });

  it("returns null when no label matches", () => {
    const searches = [makeSaved({ label: "VIP Clients" })];
    expect(findSavedSearchByLabel(searches, "Overdue Invoices")).toBeNull();
  });
});
