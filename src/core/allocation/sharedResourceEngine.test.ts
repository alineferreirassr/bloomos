import { describe, expect, it } from "vitest";
import { findSharedResourceConflicts, isResourceShared, type ResourceUsageWindow } from "@/core/allocation/sharedResourceEngine";

function makeUsage(overrides: Partial<ResourceUsageWindow> = {}): ResourceUsageWindow {
  return { resource_type: "equipment", resource_id: "equipment_1", allocation_id: "allocation_1", starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", ...overrides };
}

describe("findSharedResourceConflicts", () => {
  it("finds an overlapping usage of the same resource in a different allocation", () => {
    const candidate = makeUsage();
    const others = [makeUsage({ allocation_id: "allocation_2", starts_at: "2026-08-03T10:30:00.000Z", ends_at: "2026-08-03T11:30:00.000Z" })];
    expect(findSharedResourceConflicts(candidate, others)).toHaveLength(1);
  });

  it("ignores a non-overlapping usage of the same resource", () => {
    const candidate = makeUsage();
    const others = [makeUsage({ allocation_id: "allocation_2", starts_at: "2026-08-03T12:00:00.000Z", ends_at: "2026-08-03T13:00:00.000Z" })];
    expect(findSharedResourceConflicts(candidate, others)).toHaveLength(0);
  });

  it("ignores a different resource entirely", () => {
    const candidate = makeUsage();
    const others = [makeUsage({ resource_id: "equipment_2", allocation_id: "allocation_2" })];
    expect(findSharedResourceConflicts(candidate, others)).toHaveLength(0);
  });

  it("excludes usage within the same allocation (not a conflict with itself)", () => {
    const candidate = makeUsage();
    const others = [makeUsage({ allocation_id: "allocation_1" })];
    expect(findSharedResourceConflicts(candidate, others)).toHaveLength(0);
  });
});

describe("isResourceShared", () => {
  it("is true when the resource appears in more than one distinct allocation", () => {
    const usages = [makeUsage({ allocation_id: "allocation_1" }), makeUsage({ allocation_id: "allocation_2" })];
    expect(isResourceShared("equipment", "equipment_1", usages)).toBe(true);
  });

  it("is false when the resource appears in only one allocation, even with multiple usage rows", () => {
    const usages = [makeUsage({ allocation_id: "allocation_1" }), makeUsage({ allocation_id: "allocation_1" })];
    expect(isResourceShared("equipment", "equipment_1", usages)).toBe(false);
  });

  it("is false for a resource with no usage at all", () => {
    expect(isResourceShared("equipment", "equipment_missing", [])).toBe(false);
  });
});
