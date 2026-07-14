import { describe, expect, it } from "vitest";
import { computeChecklistStats } from "@/modules/events/checklistStats";
import type { ChecklistItem } from "@/types/checklistItem";

const NOW = new Date("2026-07-14T00:00:00.000Z");

function makeItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "checklist_test",
    workspace_id: "ws_test",
    owner_type: "event",
    owner_id: "event_test",
    title: "Test item",
    description: null,
    category: "planning",
    priority: "normal",
    status: "pending",
    due_date: null,
    completed_at: null,
    assigned_type: "unknown",
    assigned_id: null,
    assigned_name: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeChecklistStats", () => {
  it("returns all zeros for an empty list", () => {
    const stats = computeChecklistStats([], NOW);
    expect(stats).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      blocked: 0,
      cancelled: 0,
      overdue: 0,
      percentComplete: 0,
      nextDueItem: null,
    });
  });

  it("counts total, completed, pending, in-progress, blocked, and cancelled separately", () => {
    const items = [
      makeItem({ id: "a", status: "completed" }),
      makeItem({ id: "b", status: "pending" }),
      makeItem({ id: "c", status: "blocked" }),
      makeItem({ id: "d", status: "in_progress" }),
      makeItem({ id: "e", status: "cancelled" }),
    ];
    const stats = computeChecklistStats(items, NOW);
    expect(stats.total).toBe(5);
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.cancelled).toBe(1);
  });

  it("counts overdue items — due in the past, not completed or cancelled", () => {
    const items = [
      makeItem({ id: "a", status: "pending", due_date: "2026-07-01" }),
      makeItem({ id: "b", status: "completed", due_date: "2026-07-01" }),
      makeItem({ id: "c", status: "cancelled", due_date: "2026-07-01" }),
      makeItem({ id: "d", status: "pending", due_date: "2026-08-01" }),
    ];
    const stats = computeChecklistStats(items, NOW);
    expect(stats.overdue).toBe(1);
  });

  it("computes percentComplete against non-cancelled items only", () => {
    const items = [
      makeItem({ id: "a", status: "completed" }),
      makeItem({ id: "b", status: "pending" }),
      makeItem({ id: "c", status: "cancelled" }),
    ];
    const stats = computeChecklistStats(items, NOW);
    // 1 completed out of 2 countable (cancelled excluded) = 50%.
    expect(stats.percentComplete).toBe(50);
  });

  it("finds the next due item — earliest due_date among non-terminal items", () => {
    const items = [
      makeItem({ id: "a", title: "Later", status: "pending", due_date: "2026-09-01" }),
      makeItem({ id: "b", title: "Soonest", status: "pending", due_date: "2026-07-20" }),
      makeItem({ id: "c", title: "Done", status: "completed", due_date: "2026-07-15" }),
    ];
    const stats = computeChecklistStats(items, NOW);
    expect(stats.nextDueItem?.id).toBe("b");
  });

  it("returns null nextDueItem when nothing has a due date", () => {
    const items = [makeItem({ id: "a", due_date: null })];
    const stats = computeChecklistStats(items, NOW);
    expect(stats.nextDueItem).toBeNull();
  });
});
