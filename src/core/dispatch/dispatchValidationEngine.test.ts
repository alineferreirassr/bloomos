import { describe, expect, it } from "vitest";
import { validateDispatch, type DispatchValidationInput } from "@/core/dispatch/dispatchValidationEngine";
import type { DispatchOrder } from "@/types/dispatch";
import type { ExecutionSnapshot } from "@/types/executionPackage";

function baseOrder(overrides: Partial<DispatchOrder> = {}): DispatchOrder {
  return {
    id: "dispatch_order_1",
    workspace_id: "ws_1",
    execution_package_id: "execution_package_1",
    execution_version_id: "execution_version_1",
    batch_id: null,
    status: "draft",
    priority: "medium",
    source: "execution_package_derived",
    assignments: [{ id: "dispatch_assignment_1", order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "queued", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [] }],
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    cancelled_at: null,
    archived_at: null,
    ...overrides,
  };
}

function baseSnapshot(overrides: Partial<ExecutionSnapshot> = {}): ExecutionSnapshot {
  return {
    id: "snapshot_1",
    captured_at: "2026-01-01T00:00:00.000Z",
    allocation_id: "allocation_1",
    allocation_strategy: "highest_capability",
    allocation_candidates: [],
    appointment_id: "appointment_1",
    scheduled_starts_at: null,
    scheduled_ends_at: null,
    calendar_id: null,
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

function baseInput(overrides: Partial<DispatchValidationInput> = {}): DispatchValidationInput {
  return {
    order: baseOrder(),
    snapshot: baseSnapshot(),
    packageStatus: "approved",
    packageReadinessState: "ready",
    resourceStatusByKey: { "worker:worker_1": "active" },
    scheduleActive: true,
    ...overrides,
  };
}

describe("validateDispatch", () => {
  it("is valid for a fully-eligible dispatch", () => {
    const result = validateDispatch(baseInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("errors when the package isn't approved", () => {
    const result = validateDispatch(baseInput({ packageStatus: "draft" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "package_not_approved")).toBe(true);
  });

  it("errors when the package isn't ready", () => {
    const result = validateDispatch(baseInput({ packageReadinessState: "incomplete" }));
    expect(result.errors.some((e) => e.rule === "package_not_ready")).toBe(true);
  });

  it("errors when there are no assignments", () => {
    const result = validateDispatch(baseInput({ order: baseOrder({ assignments: [] }) }));
    expect(result.errors.some((e) => e.rule === "no_assignments")).toBe(true);
  });

  it("errors for each unsatisfied dependency check", () => {
    const snapshot = baseSnapshot({ dependency_checks: [{ rule: { id: "rule_1", workspace_id: "ws_1", subject_resource_type: "equipment", subject_identifier: null, requires_resource_type: "worker", requires_skill: null, requires_certification: "drone_operator", description: "Drone requires a certified operator" }, satisfied: false, satisfiedByResourceId: null }] });
    const result = validateDispatch(baseInput({ snapshot }));
    expect(result.errors.some((e) => e.rule === "dependencies_incomplete")).toBe(true);
  });

  it("errors when an assigned worker isn't active", () => {
    const result = validateDispatch(baseInput({ resourceStatusByKey: { "worker:worker_1": "on_leave" } }));
    expect(result.errors.some((e) => e.rule === "worker_inactive")).toBe(true);
  });

  it("errors when an assigned equipment/vehicle isn't available", () => {
    const order = baseOrder({ assignments: [{ id: "dispatch_assignment_1", order_id: "dispatch_order_1", resource_type: "equipment", resource_id: "equipment_1", requirement_line_index: 0, queue_state: "queued", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [] }] });
    const result = validateDispatch(baseInput({ order, resourceStatusByKey: { "equipment:equipment_1": "maintenance" } }));
    expect(result.errors.some((e) => e.rule === "resource_unavailable")).toBe(true);
  });

  it("warns (not errors) when a resource's live status is unknown", () => {
    const result = validateDispatch(baseInput({ resourceStatusByKey: {} }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "resource_status_unknown")).toBe(true);
  });

  it("errors when the schedule is no longer active and a schedule exists", () => {
    const result = validateDispatch(baseInput({ scheduleActive: false }));
    expect(result.errors.some((e) => e.rule === "schedule_inactive")).toBe(true);
  });

  it("doesn't require an active schedule when the snapshot has none", () => {
    const snapshot = baseSnapshot({ appointment_id: null });
    const result = validateDispatch(baseInput({ snapshot, scheduleActive: false }));
    expect(result.errors.some((e) => e.rule === "schedule_inactive")).toBe(false);
  });
});
