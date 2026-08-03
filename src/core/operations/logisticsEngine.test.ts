import { describe, expect, it } from "vitest";
import { buildLogisticsPlan } from "@/core/operations/logisticsEngine";
import type { EventScheduleItem } from "@/types/eventScheduleItem";

function makeItem(overrides: Partial<EventScheduleItem> = {}): EventScheduleItem {
  return {
    id: "sched_1",
    workspace_id: "ws_1",
    owner_type: "event",
    owner_id: "event_1",
    title: "Arrival",
    description: null,
    start_time: "09:00",
    end_time: "10:00",
    location: null,
    assigned_to: null,
    category: "arrival",
    status: "planned",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildLogisticsPlan", () => {
  it("groups schedule items into the 6 logistics phases in time order", () => {
    const schedule = [
      makeItem({ id: "s1", category: "departure", title: "Departure", start_time: "22:00", end_time: "22:30" }),
      makeItem({ id: "s2", category: "arrival", title: "Arrival", start_time: "09:00", end_time: "10:00" }),
      makeItem({ id: "s3", category: "setup", title: "Setup", start_time: "10:00", end_time: "12:00" }),
    ];
    const plan = buildLogisticsPlan(schedule);
    expect(plan.phases.map((p) => p.phase)).toEqual(["arrival", "setup", "departure"]);
  });

  it("omits categories with no logistics-phase mapping (e.g. 'other')", () => {
    const schedule = [makeItem({ category: "other", title: "Misc" })];
    const plan = buildLogisticsPlan(schedule);
    expect(plan.phases).toHaveLength(0);
  });

  it("computes a real travel buffer in minutes between consecutive items", () => {
    const schedule = [
      makeItem({ id: "s1", title: "Arrival", start_time: "09:00", end_time: "09:30" }),
      makeItem({ id: "s2", title: "Setup", start_time: "10:00", end_time: "12:00" }),
    ];
    const plan = buildLogisticsPlan(schedule);
    expect(plan.travelBuffers).toHaveLength(1);
    expect(plan.travelBuffers[0].minutes).toBe(30);
  });

  it("returns null buffer minutes when either side has no time", () => {
    const schedule = [makeItem({ id: "s1", start_time: null, end_time: null }), makeItem({ id: "s2", start_time: "10:00" })];
    const plan = buildLogisticsPlan(schedule);
    expect(plan.travelBuffers[0].minutes).toBeNull();
  });

  it("derives loading/unloading notes from the arrival and departure items", () => {
    const schedule = [makeItem({ category: "arrival", title: "Truck Arrival", start_time: "08:00" }), makeItem({ category: "departure", title: "Load-out", start_time: "23:00" })];
    const plan = buildLogisticsPlan(schedule);
    expect(plan.loadingNote).toContain("08:00");
    expect(plan.unloadingNote).toContain("23:00");
  });

  it("honestly reports no arrival/departure item found rather than fabricating a time", () => {
    const plan = buildLogisticsPlan([]);
    expect(plan.loadingNote).toContain("No arrival");
    expect(plan.unloadingNote).toContain("No departure");
  });
});
