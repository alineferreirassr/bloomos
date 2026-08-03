import type { ExecutionValidationInput, ExecutionValidationResult, ExecutionValidationIssue } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 4 — Execution Validation Engine. "Reject
 * invalid execution attempts" — 6 named checks, all blocking errors (no
 * warnings; unlike Dispatch's own validation, none of Field Operations'
 * named checks are merely informational). Every real-world fact this
 * pure validator needs (the Dispatch Assignment's own `queue_state`, the
 * Execution Package's own `status`, whether a worker-type resource is
 * assigned, whether every required resource line has an assignment,
 * whether the frozen snapshot names an Operational Plan, whether the
 * assignment is still active) is resolved by the caller and handed in —
 * this engine never fetches anything itself, and it never recalculates
 * Dispatch/Allocation/Scheduling to answer any of these checks.
 */

function issue(rule: string, detail: string): ExecutionValidationIssue {
  return { rule, detail };
}

export function validateExecution(input: ExecutionValidationInput): ExecutionValidationResult {
  const errors: ExecutionValidationIssue[] = [];

  if (!input.dispatchAccepted) {
    errors.push(issue("dispatch_not_accepted", "The Dispatch Assignment has not been accepted."));
  }
  if (!input.packageApproved) {
    errors.push(issue("package_not_approved", "The execution package has not been approved."));
  }
  if (!input.workerAssigned) {
    errors.push(issue("worker_not_assigned", "No worker is assigned to this execution."));
  }
  if (!input.requiredResourcesPresent) {
    errors.push(issue("required_resources_missing", "One or more required resources are not present."));
  }
  if (!input.operationalPlanExists) {
    errors.push(issue("operational_plan_missing", "No operational plan exists for this execution."));
  }
  if (!input.assignmentActive) {
    errors.push(issue("assignment_inactive", "The Dispatch Assignment is no longer active."));
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
