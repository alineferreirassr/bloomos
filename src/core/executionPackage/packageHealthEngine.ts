import type { ExecutionSnapshot, PackageHealthScores } from "@/types/executionPackage";
import { computeOperationalHealthScores } from "@/core/operationalPlanning/operationalHealthEngine";
import { evaluateBundleCompleteness, computeBundleCompletenessScore } from "@/core/allocation/bundleEngine";

/**
 * v2.0 Checkpoint 27.3, Step 5 — Package Health Engine. Eight disclosed,
 * deterministic formulas over the frozen `ExecutionSnapshot` — same
 * "not applicable resolves to a vacuous pass" discipline every score
 * engine in this codebase follows, with two deliberate exceptions
 * (`allocationHealth` with no allocation at all, `dependencyHealth` with
 * a genuine step cycle) that resolve to `0`, since a package literally
 * cannot execute in either state.
 *
 * `operationalHealth`/`evidenceCoverage`/`checklistCoverage`/(half of)
 * `dependencyHealth` reuse `computeOperationalHealthScores` wholesale —
 * never a second, duplicate scoring formula for the same underlying
 * plan data. `bundleHealth` reuses `BundleEngine.evaluateBundleCompleteness`/
 * `computeBundleCompletenessScore` wholesale for the same reason.
 */

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** "Is this operation planned end-to-end" — a simple presence check across the three planning pillars a package draws from (Allocation, Schedule, Operational Plan), distinct from `operationalHealth`'s own internal-completeness question. */
export function computePlanningHealth(snapshot: Pick<ExecutionSnapshot, "allocation_id" | "appointment_id" | "operational_plan_id">): number {
  const present = [snapshot.allocation_id, snapshot.appointment_id, snapshot.operational_plan_id].filter((v) => v !== null).length;
  return clampScore((100 * present) / 3);
}

/** `0` — not vacuous — when there's no allocation at all, the same "surface the one finding this score exists to catch" precedent `AllocationScoreEngine.computeCapabilityFitScore` set for a zero-candidate allocation. Vacuous 100 only when an allocation exists but legitimately has zero candidate lines. */
export function computeAllocationHealth(snapshot: Pick<ExecutionSnapshot, "allocation_id" | "allocation_candidates">): number {
  if (snapshot.allocation_id === null) return 0;
  if (snapshot.allocation_candidates.length === 0) return 100;
  const selected = snapshot.allocation_candidates.filter((c) => c.selected).length;
  return clampScore((100 * selected) / snapshot.allocation_candidates.length);
}

/** Blends the Operational Plan's own step-dependency health with the Allocation's resource-dependency satisfaction — the two distinct dependency concepts `PackageValidationEngine` also keeps separate (`broken_dependencies` vs. `capability_gap`). Vacuous 100 for the resource-dependency half when there are no dependency checks at all. */
export function computeDependencyHealth(snapshot: Pick<ExecutionSnapshot, "phases" | "dependency_checks">, stepDependencyHealthScore: number): number {
  const resourceDependencyScore = snapshot.dependency_checks.length === 0 ? 100 : clampScore((100 * snapshot.dependency_checks.filter((c) => c.satisfied).length) / snapshot.dependency_checks.length);
  return clampScore((stepDependencyHealthScore + resourceDependencyScore) / 2);
}

export function computeBundleHealth(snapshot: Pick<ExecutionSnapshot, "bundle_snapshot" | "allocation_candidates">): number {
  if (snapshot.bundle_snapshot === null) return 100;
  return computeBundleCompletenessScore(evaluateBundleCompleteness(snapshot.bundle_snapshot, snapshot.allocation_candidates));
}

function computeOverallPackageHealth(scores: Omit<PackageHealthScores, "overallPackageHealth">): number {
  const values = Object.values(scores);
  return clampScore(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computePackageHealthScores(snapshot: ExecutionSnapshot): PackageHealthScores {
  const operationalHealthScores = computeOperationalHealthScores({
    phases: snapshot.phases,
    milestones: snapshot.milestones,
    deliverables: snapshot.deliverables,
    evidenceRequirements: snapshot.evidence_requirements,
    checklists: snapshot.checklists,
    approvals: snapshot.approvals,
  });

  const planningHealth = computePlanningHealth(snapshot);
  const allocationHealth = computeAllocationHealth(snapshot);
  const operationalHealth = operationalHealthScores.overallOperationalHealth;
  const dependencyHealth = computeDependencyHealth(snapshot, operationalHealthScores.dependencyHealthScore);
  const bundleHealth = computeBundleHealth(snapshot);
  const evidenceCoverage = operationalHealthScores.evidenceCoverageScore;
  const checklistCoverage = operationalHealthScores.checklistCoverageScore;

  const overallPackageHealth = computeOverallPackageHealth({ planningHealth, allocationHealth, operationalHealth, dependencyHealth, bundleHealth, evidenceCoverage, checklistCoverage });

  return { planningHealth, allocationHealth, operationalHealth, dependencyHealth, bundleHealth, evidenceCoverage, checklistCoverage, overallPackageHealth };
}
