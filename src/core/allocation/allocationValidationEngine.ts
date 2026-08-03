import type { AllocationRequirementLine, AllocationCandidate, AllocationValidationResult, AllocationValidationIssue, DependencyCheckResult } from "@/types/allocation";
import type { BundleCompletenessResult } from "@/core/allocation/bundleEngine";

/**
 * v2.0 Checkpoint 27.1, Step 11 — Allocation Validation Engine. The
 * single "can this allocation actually be approved" gate — the same
 * "structural checks + every upstream engine's findings, reduced to
 * valid/errors/warnings" discipline `scheduleValidationEngine.ts`
 * established. Capability/Schedule/Availability/Reservation/Conflict
 * failures are never re-derived here — they're already encoded on each
 * `AllocationCandidate.rejection_reason` by whichever real engine
 * (Checkpoint 26.1's `EligibilityEngine`, Checkpoint 27's
 * `AvailabilityWindowEngine`/`ConflictEngine`) rejected that candidate
 * upstream; this file only checks whether enough candidates survived.
 * Capacity is the one constraint checked directly here, via
 * pre-computed `CapacityEngine.checkCapacity` results the caller passes
 * in — reused, never re-implemented.
 */

export interface CapacityCheckSummary {
  scope: string;
  withinCapacity: boolean;
}

export interface AllocationValidationInput {
  requirementLines: AllocationRequirementLine[];
  candidates: AllocationCandidate[];
  dependencyResults: DependencyCheckResult[];
  /** `null` when this request isn't tied to a `ResourceBundle`. */
  bundleCompleteness: BundleCompletenessResult | null;
  capacityChecks: CapacityCheckSummary[];
  sharedResourceConflictCount: number;
}

function checkResourceQuantity(input: AllocationValidationInput): AllocationValidationIssue[] {
  const issues: AllocationValidationIssue[] = [];
  input.requirementLines.forEach((line, lineIndex) => {
    const selectedCount = input.candidates.filter((c) => c.requirement_line_index === lineIndex && c.selected).length;
    if (selectedCount < line.quantity) {
      issues.push({ rule: "insufficient_quantity", detail: `Requirement line ${lineIndex + 1} needs ${line.quantity} but only ${selectedCount} could be allocated.` });
    }
  });
  return issues;
}

export function validateAllocation(input: AllocationValidationInput): AllocationValidationResult {
  const errors: AllocationValidationIssue[] = [...checkResourceQuantity(input)];
  const warnings: AllocationValidationIssue[] = [];

  for (const result of input.dependencyResults) {
    if (!result.satisfied) errors.push({ rule: "dependency_unsatisfied", detail: result.rule.description });
  }

  if (input.bundleCompleteness !== null && !input.bundleCompleteness.isComplete) {
    errors.push({ rule: "bundle_incomplete", detail: `Bundle is missing ${input.bundleCompleteness.missingRequiredLines.length} required resource line(s).` });
  }

  for (const check of input.capacityChecks) {
    if (!check.withinCapacity) errors.push({ rule: "capacity_exceeded", detail: `Capacity exceeded for ${check.scope}.` });
  }

  if (input.sharedResourceConflictCount > 0) {
    warnings.push({ rule: "shared_resource_conflict", detail: `${input.sharedResourceConflictCount} shared-resource time conflict(s) detected.` });
  }

  return { valid: errors.length === 0, errors, warnings };
}
