import { describe, expect, it } from "vitest";
import { computeScheduleStats } from "@/modules/events/scheduleStats";
import type { EventScheduleItem } from "@/types/eventScheduleItem";

function makeItem(overrides: Partial<EventScheduleItem> = {}): EventScheduleItem {
  return {
    id: "schedule_test",
    workspace_id: "ws_test",
    owner_type: "event",
    owner_id: "event_test",
    title: "Test item",
    description: null,
    start_time: null,
    end_time: null,
    location: null,
    assigned_to: null,
    category: "setup",
    status: "planned",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeScheduleStats", () => {
  it("returns zeros and not_started for an empty list", () => {
    const stats = computeScheduleStats([]);
    expect(stats).toEqual({
      total: 0,
      planned: 0,
      confirmed: 0,
      completed: 0,
      delayed: 0,
      cancelled: 0,
      first: null,
      last: null,
      completionState: "not_started",
      spanStart: null,
      spanEnd: null,
    });
  });

  it("counts planned, confirmed, and cancelled separately", () => {
    const items = [
      makeItem({ id: "a", status: "planned" }),
      makeItem({ id: "b", status: "confirmed" }),
      makeItem({ id: "c", status: "cancelled" }),
    ];
    const stats = computeScheduleStats(items);
    expect(stats.planned).toBe(1);
    expect(stats.confirmed).toBe(1);
    expect(stats.cancelled).toBe(1);
  });

  it("computes the schedule span from the earliest start_time to the latest end_time across all items", () => {
    const items = [
      makeItem({ id: "a", start_time: "17:00", end_time: "17:45" }),
      makeItem({ id: "b", start_time: "18:25", end_time: "20:30" }),
      makeItem({ id: "c", start_time: "18:00", end_time: "18:15" }),
    ];
    const stats = computeScheduleStats(items);
    expect(stats.spanStart).toBe("17:00");
    expect(stats.spanEnd).toBe("20:30");
  });

  it("returns a null span when no item has a time set", () => {
    const items = [makeItem({ id: "a", start_time: null, end_time: null })];
    expect(computeScheduleStats(items).spanStart).toBeNull();
    expect(computeScheduleStats(items).spanEnd).toBeNull();
  });

  it("identifies first and last by sort_order, not array order", () => {
    const items = [
      makeItem({ id: "b", title: "Middle", sort_order: 1 }),
      makeItem({ id: "c", title: "Last", sort_order: 2 }),
      makeItem({ id: "a", title: "First", sort_order: 0 }),
    ];
    const stats = computeScheduleStats(items);
    expect(stats.first?.id).toBe("a");
    expect(stats.last?.id).toBe("c");
  });

  it("counts delayed items", () => {
    const items = [
      makeItem({ id: "a", status: "delayed" }),
      makeItem({ id: "b", status: "planned" }),
    ];
    const stats = computeScheduleStats(items);
    expect(stats.delayed).toBe(1);
  });

  it("reports not_started when nothing is completed", () => {
    const items = [makeItem({ status: "planned" }), makeItem({ status: "confirmed" })];
    expect(computeScheduleStats(items).completionState).toBe("not_started");
  });

  it("reports in_progress when some but not all items are completed", () => {
    const items = [makeItem({ id: "a", status: "completed" }), makeItem({ id: "b", status: "planned" })];
    expect(computeScheduleStats(items).completionState).toBe("in_progress");
  });

  it("reports completed when every item is completed", () => {
    const items = [makeItem({ id: "a", status: "completed" }), makeItem({ id: "b", status: "completed" })];
    expect(computeScheduleStats(items).completionState).toBe("completed");
  });
});
