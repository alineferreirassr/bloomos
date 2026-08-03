import type { ExecutionPhase, Milestone, Deliverable, EvidenceRequirement, ApprovalRequirement, OperationalValidationResult, OperationalValidationIssue } from "@/types/operationalPlanning";
import { flattenSteps, findBrokenDependencies, detectDependencyCycle } from "@/core/operationalPlanning/executionStepEngine";
import { validatePhaseOrder } from "@/core/operationalPlanning/phaseEngine";
import { findOrphanedMilestones } from "@/core/operationalPlanning/milestoneEngine";
import { findOrphanedDeliverables } from "@/core/operationalPlanning/deliverableEngine";
import { findOrphanedEvidenceRequirements } from "@/core/operationalPlanning/evidenceEngine";
import { pendingApprovals } from "@/core/operationalPlanning/approvalEngine";

/**
 * v2.0 Checkpoint 27.2, Step 11 — Operational Constraints. The single
 * "is this plan structurally sound" gate — composes every engine this
 * checkpoint already built (`PhaseEngine`, `ExecutionStepEngine`,
 * `MilestoneEngine`, `DeliverableEngine`, `EvidenceEngine`,
 * `ApprovalEngine`), never re-derives their logic. Maps directly onto
 * the spec's own nine named checks — the first six are structural
 * (computed purely from the plan's own arrays); "Missing Resources"/
 * "Missing Capability" are per-step informational warnings; "Missing
 * Schedule" isn't checked here at all — it needs Checkpoint 27's real
 * Scheduling data (is there a real Appointment linked to this plan's
 * context?), which this pure engine has no access to, so
 * `operationalPlanningActions.ts` appends that one check itself.
 */

export interface OperationalConstraintsInput {
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidenceRequirements: EvidenceRequirement[];
  approvals: ApprovalRequirement[];
}

export function validateOperationalConstraints(input: OperationalConstraintsInput): OperationalValidationResult {
  const errors: OperationalValidationIssue[] = [];
  const warnings: OperationalValidationIssue[] = [];

  const cycle = detectDependencyCycle(input.phases);
  if (cycle.hasCycle) errors.push({ rule: "broken_dependencies", detail: `A circular dependency exists among steps: ${cycle.cycleStepIds.join(" → ")}.` });

  for (const broken of findBrokenDependencies(input.phases)) {
    errors.push({ rule: "broken_dependencies", detail: `Step "${broken.stepId}" depends on a step that doesn't exist in this plan.` });
  }

  const phaseIds = new Set(input.phases.map((p) => p.id));
  for (const milestone of findOrphanedMilestones(input.milestones, phaseIds)) {
    errors.push({ rule: "missing_milestones", detail: `Milestone "${milestone.title}" targets a phase that doesn't exist in this plan.` });
  }

  const stepIds = new Set(flattenSteps(input.phases).map((s) => s.id));
  for (const deliverable of findOrphanedDeliverables(input.deliverables, stepIds)) {
    errors.push({ rule: "missing_deliverables", detail: `Deliverable "${deliverable.title}" is produced by a step that doesn't exist in this plan.` });
  }

  for (const evidence of findOrphanedEvidenceRequirements(input.evidenceRequirements, input.phases, input.milestones)) {
    errors.push({ rule: "missing_evidence", detail: `Evidence requirement "${evidence.description}" isn't attached to a real step or milestone.` });
  }

  for (const issue of validatePhaseOrder(input.phases)) {
    warnings.push({ rule: "invalid_phase_order", detail: issue.detail });
  }

  const pending = pendingApprovals(input.approvals);
  if (pending.length > 0) warnings.push({ rule: "required_approvals", detail: `${pending.length} approval requirement(s) are still pending.` });

  const stepsMissingResource = flattenSteps(input.phases).filter((s) => s.assigned_resource_type === null);
  if (stepsMissingResource.length > 0) warnings.push({ rule: "missing_resources", detail: `${stepsMissingResource.length} step(s) have no assigned resource type.` });

  const stepsMissingCapability = flattenSteps(input.phases).filter((s) => s.required_capability_requirement_id === null);
  if (stepsMissingCapability.length > 0) warnings.push({ rule: "missing_capability", detail: `${stepsMissingCapability.length} step(s) have no required capability specified.` });

  return { valid: errors.length === 0, errors, warnings };
}
