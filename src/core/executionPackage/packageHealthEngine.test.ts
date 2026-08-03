import { describe, expect, it } from "vitest";
import { computePlanningHealth, computeAllocationHealth, computeDependencyHealth, computeBundleHealth, computePackageHealthScores } from "@/core/executionPackage/packageHealthEngine";
import type { ExecutionSnapshot } from "@/types/executionPackage";

function baseSnapshot(overrides: Partial<ExecutionSnapshot> = {}): ExecutionSnapshot {
  return {
    id: "snapshot_1",
    captured_at: "2026-01-01T00:00:00.000Z",
    allocation_id: "allocation_1",
    allocation_strategy: "highest_capability",
    allocation_candidates: [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }],
    appointment_id: "appointment_1",
    scheduled_starts_at: "2026-01-01T09:00:00.000Z",
    scheduled_ends_at: "2026-01-01T12:00:00.000Z",
    calendar_id: "calendar_1",
    operational_plan_id: "plan_1",
    phases: [],
    milestones: [],
    deliverables: [],
    evidence_requirements: [],
    checklists: [],
    approvals: [],
    bundle_id: null,
    bundle_snapshot: null,
    dependency_checks: [],
    resource_pool: null,
    ...overrides,
  };
}

describe("computePlanningHealth", () => {
  it("is 100 when allocation/schedule/plan are all present", () => {
    expect(computePlanningHealth(baseSnapshot())).toBe(100);
  });

  it("drops proportionally as pillars go missing", () => {
    expect(computePlanningHealth(baseSnapshot({ appointment_id: null }))).toBe(67);
    expect(computePlanningHealth(baseSnapshot({ appointment_id: null, operational_plan_id: null }))).toBe(33);
  });
});

describe("computeAllocationHealth", () => {
  it("is 0 (not vacuous) when there's no allocation at all", () => {
    expect(computeAllocationHealth(baseSnapshot({ allocation_id: null, allocation_candidates: [] }))).toBe(0);
  });

  it("is vacuous 100 when an allocation exists with zero candidate lines", () => {
    expect(computeAllocationHealth(baseSnapshot({ allocation_candidates: [] }))).toBe(100);
  });

  it("is the selected ratio when candidates exist", () => {
    expect(
      computeAllocationHealth(
        baseSnapshot({
          allocation_candidates: [
            { resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null },
            { resource_type: "worker", resource_id: "worker_2", requirement_line_index: 1, selected: false, rejection_reason: "unavailable", is_fallback: false, fallback_tier: null },
          ],
        }),
      ),
    ).toBe(50);
  });
});

describe("computeDependencyHealth", () => {
  it("is vacuous 100 for the resource half when there are no dependency checks, blended with the step-dependency score", () => {
    expect(computeDependencyHealth(baseSnapshot(), 100)).toBe(100);
    expect(computeDependencyHealth(baseSnapshot(), 0)).toBe(50);
  });

  it("blends a partial resource-dependency satisfaction ratio in", () => {
    const snapshot = baseSnapshot({
      dependency_checks: [
        { rule: { id: "rule_1", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: null, requires_resource_type: "worker", requires_skill: null, requires_certification: "drone_operator", description: "d" }, satisfied: true, satisfiedByResourceId: "worker_1" },
        { rule: { id: "rule_2", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: null, requires_resource_type: "worker", requires_skill: null, requires_certification: "crane_operator", description: "c" }, satisfied: false, satisfiedByResourceId: null },
      ],
    });
    expect(computeDependencyHealth(snapshot, 100)).toBe(75);
  });
});

describe("computeBundleHealth", () => {
  it("is vacuous 100 when this package isn't based on a bundle", () => {
    expect(computeBundleHealth(baseSnapshot())).toBe(100);
  });
});

describe("computePackageHealthScores", () => {
  it("returns overallPackageHealth as the average of the other seven", () => {
    const health = computePackageHealthScores(baseSnapshot());
    expect(health.overallPackageHealth).toBe(100);
  });

  it("reflects a genuinely incomplete package", () => {
    const health = computePackageHealthScores(baseSnapshot({ allocation_id: null, allocation_candidates: [], appointment_id: null }));
    expect(health.overallPackageHealth).toBeLessThan(100);
    expect(health.allocationHealth).toBe(0);
  });
});
