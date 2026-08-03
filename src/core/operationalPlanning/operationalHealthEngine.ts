import type { ExecutionPhase, Milestone, Deliverable, EvidenceRequirement, PlanChecklist, ApprovalRequirement, OperationalHealthScores } from "@/types/operationalPlanning";
import { flattenSteps, detectDependencyCycle, findBrokenDependencies } from "@/core/operationalPlanning/executionStepEngine";
import { milestoneProgress } from "@/core/operationalPlanning/milestoneEngine";
import { deliverableCoverage } from "@/core/operationalPlanning/deliverableEngine";
import { checklistCompletionRatio } from "@/core/operationalPlanning/checklistEngine";
import { approvalCompletionRatio } from "@/core/operationalPlanning/approvalEngine";

/**
 * v2.0 Checkpoint 27.2, Step 13 — Operational Health Engine. Eight
 * disclosed, deterministic formulas over already-computed data — same
 * "not applicable resolves to a vacuous pass" discipline
 * `capabilityScoreEngine.ts`/`allocationScoreEngine.ts` established.
 * `dependencyHealthScore` is the one deliberate exception: a genuine
 * cycle is `0`, not a vacuous pass, since a circular plan cannot be
 * executed at all — the same "surface the one finding this score exists
 * to catch" precedent `AllocationScoreEngine.computeCapabilityFitScore`
 * set for a zero-candidate allocation.
 */

export interface OperationalHealthInput {
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidenceRequirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Ratio of steps carrying both an assigned resource type and a required capability — how filled-out the plan actually is, not just how many steps exist. */
export function computePlanCompletenessScore(input: Pick<OperationalHealthInput, "phases">): number {
  const steps = flattenSteps(input.phases);
  if (steps.length === 0) return 100;
  const fullySpecified = steps.filter((s) => s.assigned_resource_type !== null && s.required_capability_requirement_id !== null).length;
  return clampScore((100 * fullySpecified) / steps.length);
}

export function computeDependencyHealthScore(input: Pick<OperationalHealthInput, "phases">): number {
  if (detectDependencyCycle(input.phases).hasCycle) return 0;
  const steps = flattenSteps(input.phases);
  const totalDependencies = steps.reduce((sum, s) => sum + s.dependencies.length, 0);
  if (totalDependencies === 0) return 100;
  const broken = findBrokenDependencies(input.phases).length;
  return clampScore(100 * (1 - broken / totalDependencies));
}

/** "Coverage" here means: does every milestone have at least one declared evidence requirement — never whether evidence was actually captured (this checkpoint is declarative-only). */
export function computeEvidenceCoverageScore(input: Pick<OperationalHealthInput, "milestones">): number {
  if (input.milestones.length === 0) return 100;
  const covered = input.milestones.filter((m) => m.evidence_requirement_ids.length > 0).length;
  return clampScore((100 * covered) / input.milestones.length);
}

export function computeChecklistCoverageScore(input: Pick<OperationalHealthInput, "checklists">): number {
  if (input.checklists.length === 0) return 100;
  const average = input.checklists.reduce((sum, c) => sum + checklistCompletionRatio(c), 0) / input.checklists.length;
  return clampScore(100 * average);
}

export function computeApprovalCoverageScore(input: Pick<OperationalHealthInput, "approvals">): number {
  return clampScore(100 * approvalCompletionRatio(input.approvals));
}

export function computeDeliverableCoverageScore(input: Pick<OperationalHealthInput, "deliverables">): number {
  return clampScore(100 * deliverableCoverage(input.deliverables).ratio);
}

export function computeMilestoneCoverageScore(input: Pick<OperationalHealthInput, "milestones">): number {
  return clampScore(100 * milestoneProgress(input.milestones).ratio);
}

/** Unweighted average of the other seven — the same simple, disclosed composite `calendarHealthScore`/`overallAllocationScore` established. */
export function computeOverallOperationalHealth(scores: Omit<OperationalHealthScores, "overallOperationalHealth">): number {
  const values = Object.values(scores);
  return clampScore(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeOperationalHealthScores(input: OperationalHealthInput): OperationalHealthScores {
  const planCompletenessScore = computePlanCompletenessScore(input);
  const dependencyHealthScore = computeDependencyHealthScore(input);
  const evidenceCoverageScore = computeEvidenceCoverageScore(input);
  const checklistCoverageScore = computeChecklistCoverageScore(input);
  const approvalCoverageScore = computeApprovalCoverageScore(input);
  const deliverableCoverageScore = computeDeliverableCoverageScore(input);
  const milestoneCoverageScore = computeMilestoneCoverageScore(input);
  const overallOperationalHealth = computeOverallOperationalHealth({ planCompletenessScore, dependencyHealthScore, evidenceCoverageScore, checklistCoverageScore, approvalCoverageScore, deliverableCoverageScore, milestoneCoverageScore });
  return { planCompletenessScore, dependencyHealthScore, evidenceCoverageScore, checklistCoverageScore, approvalCoverageScore, deliverableCoverageScore, milestoneCoverageScore, overallOperationalHealth };
}
