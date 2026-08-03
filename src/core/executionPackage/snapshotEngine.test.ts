import { describe, expect, it } from "vitest";
import { buildExecutionSnapshot, hasSnapshotDrifted, type SnapshotInput } from "@/core/executionPackage/snapshotEngine";

function baseInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return { allocation: null, appointment: null, plan: null, bundle: null, dependencyChecks: [], resourcePool: null, ...overrides };
}

describe("buildExecutionSnapshot", () => {
  it("freezes id/captured_at from the caller, never minting its own", () => {
    const snapshot = buildExecutionSnapshot("snapshot_1", "2026-01-01T00:00:00.000Z", baseInput());
    expect(snapshot.id).toBe("snapshot_1");
    expect(snapshot.captured_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("copies allocation fields by value when an allocation is provided", () => {
    const allocation = { id: "allocation_1", strategy: "highest_capability" as const, candidates: [{ resource_type: "worker" as const, resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }] };
    const snapshot = buildExecutionSnapshot("snapshot_1", "2026-01-01T00:00:00.000Z", baseInput({ allocation }));
    expect(snapshot.allocation_id).toBe("allocation_1");
    expect(snapshot.allocation_strategy).toBe("highest_capability");
    expect(snapshot.allocation_candidates).toEqual(allocation.candidates);
  });

  it("resolves every field to null/empty when nothing is provided — never fabricated", () => {
    const snapshot = buildExecutionSnapshot("snapshot_1", "2026-01-01T00:00:00.000Z", baseInput());
    expect(snapshot.allocation_id).toBeNull();
    expect(snapshot.appointment_id).toBeNull();
    expect(snapshot.operational_plan_id).toBeNull();
    expect(snapshot.bundle_id).toBeNull();
    expect(snapshot.phases).toEqual([]);
    expect(snapshot.resource_pool).toBeNull();
  });

  it("copies operational plan structure fields by value when a plan is provided", () => {
    const plan = { id: "plan_1", phases: [{ id: "phase_1", kind: "setup" as const, name: "Setup", order: 1, steps: [] }], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [] };
    const snapshot = buildExecutionSnapshot("snapshot_1", "2026-01-01T00:00:00.000Z", baseInput({ plan }));
    expect(snapshot.operational_plan_id).toBe("plan_1");
    expect(snapshot.phases).toEqual(plan.phases);
  });
});

describe("hasSnapshotDrifted", () => {
  it("is false when the live source has no updated_at (no longer exists)", () => {
    expect(hasSnapshotDrifted("2026-01-01T00:00:00.000Z", null)).toBe(false);
  });

  it("is false when the live source hasn't changed since capture", () => {
    expect(hasSnapshotDrifted("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("is true when the live source changed after capture", () => {
    expect(hasSnapshotDrifted("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(true);
  });
});
