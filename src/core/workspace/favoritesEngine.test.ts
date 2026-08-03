import { describe, expect, it } from "vitest";
import { findFavorite, groupFavoritesByEntityType, isFavorited, removeFavoriteById, sortFavoritesByRecency } from "@/core/workspace/favoritesEngine";
import type { WorkspaceFavorite } from "@/types/smartWorkspace";

function favorite(overrides: Partial<WorkspaceFavorite> = {}): WorkspaceFavorite {
  return {
    id: "wsfav_1",
    workspace_id: "ws_1",
    member_id: "member_1",
    entity_type: "lead",
    entity_id: "lead_1",
    label: "Jane Doe",
    href: "/leads/lead_1",
    created_at: "2026-01-01T00:00:00Z",
    pinned: false,
    ...overrides,
  };
}

describe("favoritesEngine", () => {
  it("isFavorited / findFavorite match on (entityType, entityId)", () => {
    const favorites = [favorite()];
    expect(isFavorited(favorites, "lead", "lead_1")).toBe(true);
    expect(isFavorited(favorites, "client", "lead_1")).toBe(false);
    expect(findFavorite(favorites, "lead", "lead_1")?.id).toBe("wsfav_1");
  });

  it("removeFavoriteById removes only the matching id", () => {
    const favorites = [favorite({ id: "a" }), favorite({ id: "b", entity_id: "lead_2" })];
    expect(removeFavoriteById(favorites, "a")).toEqual([favorite({ id: "b", entity_id: "lead_2" })]);
  });

  it("sortFavoritesByRecency orders newest first", () => {
    const older = favorite({ id: "old", created_at: "2026-01-01T00:00:00Z" });
    const newer = favorite({ id: "new", created_at: "2026-02-01T00:00:00Z" });
    expect(sortFavoritesByRecency([older, newer]).map((f) => f.id)).toEqual(["new", "old"]);
  });

  it("groupFavoritesByEntityType groups by entity_type", () => {
    const groups = groupFavoritesByEntityType([favorite({ entity_type: "lead" }), favorite({ entity_type: "client", id: "b" })]);
    expect(Object.keys(groups).sort()).toEqual(["client", "lead"]);
  });
});
