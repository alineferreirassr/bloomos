import type { DispatchOrder, DispatchValidationIssue, DispatchValidationResult } from "@/types/dispatch";
import type { ExecutionSnapshot, ExecutionStatus, PackageReadinessState } from "@/types/executionPackage";
import type { ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 28, Step 4 — Dispatch Validation Engine. "Reject
 * invalid dispatches" over 7 named checks. Every real-world fact this
 * pure engine needs (live Worker/Team/Equipment/Vehicle/Vendor status,
 * whether the live Appointment is still active, the Execution Package's
 * own status and already-computed readiness state) is resolved by the
 * caller (`dispatchActions.ts`) and handed in — this engine never
 * fetches anything itself, and it never recalculates Capability/
 * Scheduling/Allocation to answer any of these checks.
 */

/** `"asset"`/`"custom"` have no live status registry (same disclosed gap `RESOURCE_TYPES_WITH_NO_NODE` established for Allocation) — they're silently skipped, never fabricated. */
const ELIGIBLE_STATUS_BY_RESOURCE_TYPE: Partial<Record<ResourceType, string>> = {
  worker: "active",
  team: "active",
  equipment: "available",
  vehicle: "available",
  vendor: "active",
};

export interface DispatchValidationInput {
  order: DispatchOrder;
  snapshot: ExecutionSnapshot;
  packageStatus: ExecutionStatus;
  packageReadinessState: PackageReadinessState;
  /** Keyed `"${resource_type}:${resource_id}"` — resolved by the caller from the real Worker/Team/Equipment/Vehicle/Vendor registries. */
  resourceStatusByKey: Record<string, string>;
  /** Whether the live Appointment (if any) this package's snapshot was scheduled against is still active — resolved by the caller, `true` when the snapshot has no schedule at all (nothing to invalidate). */
  scheduleActive: boolean;
}

export function validateDispatch(input: DispatchValidationInput): DispatchValidationResult {
  const errors: DispatchValidationIssue[] = [];
  const warnings: DispatchValidationIssue[] = [];

  if (input.packageStatus !== "approved") {
    errors.push({ rule: "package_not_approved", detail: "The execution package has not been approved." });
  }

  if (input.packageReadinessState !== "ready") {
    errors.push({ rule: "package_not_ready", detail: `The execution package is not ready for dispatch (state: ${input.packageReadinessState.replace(/_/g, " ")}).` });
  }

  if (input.order.assignments.length === 0) {
    errors.push({ rule: "no_assignments", detail: "This dispatch order has no assignments." });
  }

  for (const check of input.snapshot.dependency_checks.filter((c) => !c.satisfied)) {
    errors.push({ rule: "dependencies_incomplete", detail: `Dependency rule "${check.rule.description}" is not satisfied.` });
  }

  for (const assignment of input.order.assignments) {
    const key = `${assignment.resource_type}:${assignment.resource_id}`;
    const status = input.resourceStatusByKey[key];
    const eligibleStatus = ELIGIBLE_STATUS_BY_RESOURCE_TYPE[assignment.resource_type];
    if (eligibleStatus === undefined) continue;
    if (status === undefined) {
      warnings.push({ rule: "resource_status_unknown", detail: `No live status found for ${assignment.resource_type} "${assignment.resource_id}".` });
      continue;
    }
    if (status !== eligibleStatus) {
      const rule = assignment.resource_type === "worker" ? "worker_inactive" : "resource_unavailable";
      errors.push({ rule, detail: `${assignment.resource_type} "${assignment.resource_id}" is not ${eligibleStatus} (current status: ${status}).` });
    }
  }

  if (input.snapshot.appointment_id !== null && !input.scheduleActive) {
    errors.push({ rule: "schedule_inactive", detail: "The scheduled appointment is no longer active." });
  }

  return { valid: errors.length === 0, errors, warnings };
}
