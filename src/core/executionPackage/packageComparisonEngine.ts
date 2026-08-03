import type { ExecutionVersion, ExecutionVersionComparisonResult, PackageHealthScores, PackageRiskLevel } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 27.3, Step 10 — Package Comparison Engine. Compares
 * two already-scored immutable versions of the same package — pure,
 * deterministic; every risk level and change is a disclosed threshold or
 * plain set-diff over already-computed data, never a judgment call.
 */

const RISK_HEALTH_THRESHOLDS = { low: 80, medium: 50 };

/** Any blocking validation error makes a version `"high"` risk outright, regardless of its health score — an unexecutable package is never "medium" risk. The same precedent `operationalComparisonEngine.resolveRiskLevel` established. */
export function resolvePackageRiskLevel(health: PackageHealthScores, validationErrorCount: number): PackageRiskLevel {
  if (validationErrorCount > 0) return "high";
  if (health.overallPackageHealth >= RISK_HEALTH_THRESHOLDS.low) return "low";
  if (health.overallPackageHealth >= RISK_HEALTH_THRESHOLDS.medium) return "medium";
  return "high";
}

function diffStringArrays(before: string[], after: string[], addedLabel: string, removedLabel: string): string[] {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added = after.filter((x) => !beforeSet.has(x));
  const removed = before.filter((x) => !afterSet.has(x));
  const changes: string[] = [];
  if (added.length > 0) changes.push(`${addedLabel}: ${added.join(", ")}`);
  if (removed.length > 0) changes.push(`${removedLabel}: ${removed.join(", ")}`);
  return changes;
}

export function compareExecutionVersions(versionA: ExecutionVersion, versionB: ExecutionVersion, healthA: PackageHealthScores, healthB: PackageHealthScores, validationErrorCountA: number, validationErrorCountB: number): ExecutionVersionComparisonResult {
  const snapA = versionA.snapshot;
  const snapB = versionB.snapshot;

  const changes: string[] = [];
  if (snapA.allocation_id !== snapB.allocation_id) changes.push(`Allocation changed from ${snapA.allocation_id ?? "none"} to ${snapB.allocation_id ?? "none"}.`);
  if (snapA.appointment_id !== snapB.appointment_id) changes.push(`Schedule changed from ${snapA.appointment_id ?? "none"} to ${snapB.appointment_id ?? "none"}.`);
  if (snapA.operational_plan_id !== snapB.operational_plan_id) changes.push(`Operational plan changed from ${snapA.operational_plan_id ?? "none"} to ${snapB.operational_plan_id ?? "none"}.`);
  if (snapA.bundle_id !== snapB.bundle_id) changes.push(`Bundle changed from ${snapA.bundle_id ?? "none"} to ${snapB.bundle_id ?? "none"}.`);

  const resourceIdsA = snapA.allocation_candidates.filter((c) => c.selected).map((c) => c.resource_id);
  const resourceIdsB = snapB.allocation_candidates.filter((c) => c.selected).map((c) => c.resource_id);
  const resourceChanges = diffStringArrays(resourceIdsA, resourceIdsB, "Added resources", "Removed resources");

  const satisfiedRuleIdsA = snapA.dependency_checks.filter((d) => d.satisfied).map((d) => d.rule.id);
  const satisfiedRuleIdsB = snapB.dependency_checks.filter((d) => d.satisfied).map((d) => d.rule.id);
  const dependencyChanges = diffStringArrays(satisfiedRuleIdsA, satisfiedRuleIdsB, "Newly satisfied dependencies", "No longer satisfied dependencies");

  const instructionTextsA = versionA.instructions.sections.map((s) => s.text);
  const instructionTextsB = versionB.instructions.sections.map((s) => s.text);
  const instructionChanges = diffStringArrays(instructionTextsA, instructionTextsB, "Added instructions", "Removed instructions");

  return {
    versionANumber: versionA.version_number,
    versionBNumber: versionB.version_number,
    changes,
    dependencyChanges,
    instructionChanges,
    resourceChanges,
    healthA,
    healthB,
    riskA: resolvePackageRiskLevel(healthA, validationErrorCountA),
    riskB: resolvePackageRiskLevel(healthB, validationErrorCountB),
  };
}
