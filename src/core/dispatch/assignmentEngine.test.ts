import { describe, expect, it } from "vitest";
import { buildDispatchAssignments } from "@/core/dispatch/assignmentEngine";
import type { AllocationCandidate } from "@/types/allocation";

describe("buildDispatchAssignments", () => {
  it("carries forward only selected candidates, unchanged", () => {
    const candidates: AllocationCandidate[] = [
      { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null },
      { resource_type: "worker", resource_id: "worker_2", requirement_line_index: 0, selected: false, rejection_reason: "unavailable", is_fallback: false, fallback_tier: null },
      { resource_type: "vehicle", resource_id: "vehicle_1", requirement_line_index: 1, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null },
    ];
    expect(buildDispatchAssignments(candidates)).toEqual([
      { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0 },
      { resource_type: "vehicle", resource_id: "vehicle_1", requirement_line_index: 1 },
    ]);
  });

  it("returns an empty array when nothing was selected", () => {
    const candidates: AllocationCandidate[] = [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: false, rejection_reason: "unavailable", is_fallback: false, fallback_tier: null }];
    expect(buildDispatchAssignments(candidates)).toEqual([]);
  });

  it("covers every resource type — worker, team, vehicle, equipment, vendor", () => {
    const candidates: AllocationCandidate[] = (["worker", "team", "vehicle", "equipment", "vendor"] as const).map((resource_type, i) => ({
      resource_type,
      resource_id: `${resource_type}_1`,
      requirement_line_index: i,
      selected: true,
      rejection_reason: null,
      is_fallback: false,
      fallback_tier: null,
    }));
    const result = buildDispatchAssignments(candidates);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.resource_type)).toEqual(["worker", "team", "vehicle", "equipment", "vendor"]);
  });
});
