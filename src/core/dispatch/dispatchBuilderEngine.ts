import type { ExecutionStatus, PackageReadinessState } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 28, Step 2 — Dispatch Builder. The single eligibility
 * gate: a Dispatch Order may only be built from an Execution Package
 * that is both `"approved"` and whose readiness state is `"ready"` —
 * "Reject packages that are not Ready" (the spec's own Step 2 line),
 * extended to Approved since the spec's building-block list opens with
 * "Approved Execution Package."
 *
 * "Approved Allocation"/"Approved Schedule"/"Approved Operational Plan"
 * (the spec's other three named building blocks) need no separate check
 * here — they were already validated the moment the Execution Package
 * itself became `"approved"` (Checkpoint 27.3's own `approveExecutionPackageAction`
 * blocks on `PackageValidationEngine` returning `valid: true`, which in
 * turn composes Allocation/Schedule/Plan presence checks). Re-checking
 * any of them independently here would mean recalculating Capability/
 * Scheduling/Allocation or rebuilding Operational Plans — forbidden by
 * the Stop Condition. "Approved Snapshot" is simply the package's own
 * current, already-frozen `ExecutionVersion.snapshot` — Dispatch reads
 * it, it never rebuilds it.
 */

export interface DispatchEligibilityInput {
  packageStatus: ExecutionStatus;
  packageReadinessState: PackageReadinessState;
}

export interface DispatchEligibilityResult {
  canDispatch: boolean;
  reason: string | null;
}

export function evaluateDispatchEligibility(input: DispatchEligibilityInput): DispatchEligibilityResult {
  if (input.packageStatus !== "approved") {
    return { canDispatch: false, reason: "This execution package has not been approved." };
  }
  if (input.packageReadinessState !== "ready") {
    return { canDispatch: false, reason: `This execution package is not ready for dispatch (current state: ${input.packageReadinessState.replace(/_/g, " ")}).` };
  }
  return { canDispatch: true, reason: null };
}
