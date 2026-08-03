import { describe, expect, it } from "vitest";
import { validatePackage } from "@/core/executionPackage/packageValidationEngine";
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

describe("validatePackage", () => {
  it("is valid for a fully-specified snapshot", () => {
    const result = validatePackage({ snapshot: baseSnapshot() });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when there's no allocation at all", () => {
    const result = validatePackage({ snapshot: baseSnapshot({ allocation_id: null, allocation_candidates: [] }) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "missing_allocation")).toBe(true);
  });

  it("errors when the allocation has no selected candidates", () => {
    const result = validatePackage({ snapshot: baseSnapshot({ allocation_candidates: [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: false, rejection_reason: "unavailable", is_fallback: false, fallback_tier: null }] }) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "missing_allocation")).toBe(true);
  });

  it("errors when there's no schedule", () => {
    const result = validatePackage({ snapshot: baseSnapshot({ appointment_id: null }) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "missing_schedule")).toBe(true);
  });

  it("warns on an incomplete checklist without blocking validity", () => {
    const result = validatePackage({ snapshot: baseSnapshot({ checklists: [{ id: "checklist_1", template_id: null, name: "Safety Checklist", kind: "safety", items: [{ id: "item_1", label: "Check equipment", completed: false }] }] }) });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "incomplete_checklist")).toBe(true);
  });

  it("warns on an unsatisfied dependency check (capability gap)", () => {
    const result = validatePackage({
      snapshot: baseSnapshot({
        dependency_checks: [{ rule: { id: "rule_1", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: null, requires_resource_type: "worker", requires_skill: null, requires_certification: "drone_operator", description: "Drone requires a certified operator" }, satisfied: false, satisfiedByResourceId: null }],
      }),
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "capability_gap")).toBe(true);
  });

  it("propagates a broken/circular dependency from the reused OperationalConstraintsEngine as a blocking error", () => {
    const result = validatePackage({
      snapshot: baseSnapshot({
        phases: [{ id: "phase_1", kind: "execution", name: "Execution", order: 1, steps: [{ id: "step_1", title: "Step 1", description: null, instructions: null, estimated_duration_minutes: 10, dependencies: [{ step_id: "step_1", type: "finish_to_start", dependency_class: "blocking" }], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] }],
      }),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "broken_dependencies")).toBe(true);
  });
});
