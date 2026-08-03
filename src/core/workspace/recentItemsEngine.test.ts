import { describe, expect, it } from "vitest";
import { MAX_RECENT_ITEMS, recordRecentItem, sortRecentItemsByRecency } from "@/core/workspace/recentItemsEngine";
import type { WorkspaceRecentItem } from "@/types/smartWorkspace";

function item(overrides: Partial<WorkspaceRecentItem> = {}): WorkspaceRecentItem {
  return {
    id: "wsrecent_1",
    workspace_id: "ws_1",
    member_id: "member_1",
    entity_type: "lead",
    entity_id: "lead_1",
    label: "Jane Doe",
    href: "/leads/lead_1",
    viewed_at: "2026-01-01T00:00:00Z",
    visit_count: 1,
    ...overrides,
  };
}

describe("recentItemsEngine", () => {
  it("unshifts a new entry to the front", () => {
    const existing = [item({ id: "a", entity_id: "lead_1" })];
    const next = recordRecentItem(existing, item({ id: "b", entity_id: "lead_2" }));
    expect(next.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("de-dupes the same entity, replacing rather than duplicating", () => {
    const existing = [item({ id: "a", entity_id: "lead_1", viewed_at: "2026-01-01T00:00:00Z" })];
    const next = recordRecentItem(existing, item({ id: "a-fresh", entity_id: "lead_1", viewed_at: "2026-02-01T00:00:00Z" }));
    expect(next).toHaveLength(1);
    expect(next[0]!.id).toBe("a-fresh");
  });

  it("caps the list at MAX_RECENT_ITEMS", () => {
    let list: WorkspaceRecentItem[] = [];
    for (let i = 0; i < MAX_RECENT_ITEMS + 5; i += 1) {
      list = recordRecentItem(list, item({ id: `r${i}`, entity_id: `lead_${i}` }));
    }
    expect(list).toHaveLength(MAX_RECENT_ITEMS);
  });

  it("sortRecentItemsByRecency orders newest first", () => {
    const older = item({ id: "old", viewed_at: "2026-01-01T00:00:00Z" });
    const newer = item({ id: "new", viewed_at: "2026-02-01T00:00:00Z" });
    expect(sortRecentItemsByRecency([older, newer]).map((i) => i.id)).toEqual(["new", "old"]);
  });
});
