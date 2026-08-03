import type { Milestone, Deliverable, OperationalValidationResult, OperationalHealthScores, CriticalPathResult, OperationalExplanation } from "@/types/operationalPlanning";
import { findIncompleteMilestones } from "@/core/operationalPlanning/milestoneEngine";
import { findIncompleteDeliverables } from "@/core/operationalPlanning/deliverableEngine";

/**
 * v2.0 Checkpoint 27.2, Step 14 — Operational Explanation Engine. Turns
 * an already-validated, already-scored plan into readable prose — the
 * same discipline `capabilityExplanationEngine.ts`/
 * `allocationExplanationEngine.ts` established: never expose only a
 * bare health number, always the reasoning behind it.
 */

export function explainOperationalPlan(validation: OperationalValidationResult, health: OperationalHealthScores, criticalPath: CriticalPathResult, milestones: Milestone[], deliverables: Deliverable[]): OperationalExplanation {
  const dependencyFailures = validation.errors.filter((e) => e.rule === "broken_dependencies").map((e) => e.detail);
  const missingRequirements = validation.errors.filter((e) => e.rule !== "broken_dependencies").map((e) => e.detail);
  const approvalBlockers = validation.warnings.filter((w) => w.rule === "required_approvals").map((w) => w.detail);
  const evidenceGaps = validation.errors.filter((e) => e.rule === "missing_evidence").map((e) => e.detail);
  const incompleteMilestones = findIncompleteMilestones(milestones).map((m) => `"${m.title}" is ${m.status.replace(/_/g, " ")}.`);
  const incompleteDeliverables = findIncompleteDeliverables(deliverables).map((d) => `"${d.title}" is ${d.status}.`);
  const criticalPathSummary = `${criticalPath.criticalStepIds.length} step(s) on the critical path, estimated ${criticalPath.estimatedCompletionMinutes} minute(s) to complete.`;

  const issueNote = validation.valid ? "" : ` (${validation.errors.length} blocking issue${validation.errors.length === 1 ? "" : "s"})`;
  const summary = `Overall operational health ${health.overallOperationalHealth}/100${issueNote}.`;

  return { summary, missingRequirements, dependencyFailures, approvalBlockers, evidenceGaps, incompleteMilestones, incompleteDeliverables, criticalPathSummary };
}
