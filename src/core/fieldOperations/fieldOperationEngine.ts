import type { FieldOperationStatus } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 14 — Field Operation Engine. The minimal
 * build-time eligibility gate — mirrors `dispatchBuilderEngine.ts`'s own
 * shape exactly: a small, cheap check run once before a `FieldOperation`
 * is ever created, distinct from `ExecutionValidationEngine`'s fuller
 * 6-check gate (Step 4) that re-runs on every Start/Resume attempt
 * thereafter. Dispatch (28) already decided whether an assignment is
 * accepted; this engine never recalculates that decision, only reads it.
 */

export interface FieldOperationEligibilityInput {
  /** The source Dispatch Assignment's own `queue_state` — must be `"accepted"` before any physical work can begin being tracked. */
  assignmentQueueState: string;
  packageStatus: string;
}

export interface FieldOperationEligibilityResult {
  canBuild: boolean;
  reason: string | null;
}

export function evaluateFieldOperationEligibility(input: FieldOperationEligibilityInput): FieldOperationEligibilityResult {
  if (input.assignmentQueueState !== "accepted") {
    return { canBuild: false, reason: "The Dispatch Assignment has not been accepted yet." };
  }
  if (input.packageStatus !== "approved") {
    return { canBuild: false, reason: "The source execution package has not been approved." };
  }
  return { canBuild: true, reason: null };
}

/** Every non-`"archived"` `FieldOperationStatus` still counts as reachable for new session activity — only `"archived"` itself is a dead end. */
export function isFieldOperationArchived(status: FieldOperationStatus): boolean {
  return status === "archived";
}
