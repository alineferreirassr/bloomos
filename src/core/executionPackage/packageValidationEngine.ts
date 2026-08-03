import type { ExecutionSnapshot, PackageValidationIssue, PackageValidationResult } from "@/types/executionPackage";
import { validateOperationalConstraints } from "@/core/operationalPlanning/operationalConstraintsEngine";
import { findIncompleteChecklists } from "@/core/operationalPlanning/checklistEngine";

/**
 * v2.0 Checkpoint 27.3, Step 4 — Package Validation. Every field it
 * checks lives directly on the frozen `ExecutionSnapshot` — this engine
 * never re-fetches or re-derives anything, and it reuses
 * `OperationalConstraintsEngine` wholesale for Operational Plan/
 * Dependencies/Evidence Requirements/Approvals/Deliverables/Milestones,
 * never re-implementing those checks a second time.
 *
 * "Capability" is validated through the snapshot's own
 * `dependency_checks` (Allocation's resource-to-resource dependency
 * results, e.g. "Drone requires a certified operator") — an unsatisfied
 * entry is the one honest signal this pure engine has for a capability
 * gap, since a full re-evaluation against Checkpoint 26.1's live
 * `CapabilityRequirement` data would be a genuine cross-module read
 * (out of scope for a pure validator; see `docs/package-validation.md`).
 */

export interface PackageValidationInput {
  snapshot: ExecutionSnapshot;
}

export function validatePackage(input: PackageValidationInput): PackageValidationResult {
  const { snapshot } = input;
  const errors: PackageValidationIssue[] = [];
  const warnings: PackageValidationIssue[] = [];

  const planValidation = validateOperationalConstraints({
    phases: snapshot.phases,
    milestones: snapshot.milestones,
    deliverables: snapshot.deliverables,
    evidenceRequirements: snapshot.evidence_requirements,
    approvals: snapshot.approvals,
  });
  errors.push(...planValidation.errors);
  warnings.push(...planValidation.warnings);

  for (const checklist of findIncompleteChecklists(snapshot.checklists)) {
    warnings.push({ rule: "incomplete_checklist", detail: `Checklist "${checklist.name}" is not fully complete.` });
  }

  if (snapshot.allocation_id === null) {
    errors.push({ rule: "missing_allocation", detail: "This package has no allocation." });
  } else if (!snapshot.allocation_candidates.some((c) => c.selected)) {
    errors.push({ rule: "missing_allocation", detail: "This package's allocation has no selected resources." });
  }

  if (snapshot.appointment_id === null) {
    errors.push({ rule: "missing_schedule", detail: "This package has no scheduled appointment." });
  }

  for (const check of snapshot.dependency_checks.filter((c) => !c.satisfied)) {
    warnings.push({ rule: "capability_gap", detail: `Dependency rule "${check.rule.description}" is not satisfied.` });
  }

  return { valid: errors.length === 0, errors, warnings };
}
