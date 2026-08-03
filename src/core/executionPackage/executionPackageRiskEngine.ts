import type { ExecutionPackage, PackageValidationResult, PackageHealthScores, PackageReadinessResult, PackageFinding, PackageFindingSeverity } from "@/types/executionPackage";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 27.3, Step 13 — Executive Integration's risk
 * detection half. Seven named, deterministic detectors over
 * already-computed data — no AI, no randomness, no new evaluation
 * logic; every detector reads a validation/health/readiness result the
 * caller already computed via `PackageValidationEngine`/
 * `PackageHealthEngine`/`ReadinessEngine`, rather than re-implementing
 * any of their logic. `driftedPackageIds` is the one input this pure
 * engine cannot derive itself — knowing whether a package's frozen
 * snapshot has fallen behind its live source (Allocation/Operational
 * Plan) requires comparing against real, current records, which
 * `executionPackageActions.ts` resolves via `SnapshotEngine.hasSnapshotDrifted`
 * and passes in.
 */

const OPERATIONAL_RISK_THRESHOLD = 60;
const PLANNING_RISK_THRESHOLD = 60;
const MISSING_REQUIREMENT_RULES = ["missing_allocation", "missing_schedule", "missing_evidence", "missing_deliverables", "missing_milestones"];

function finding(type: PackageFinding["type"], severity: PackageFindingSeverity, description: string, relatedPackageId: string): PackageFinding {
  return { id: generateId("package_finding"), type, severity, description, relatedPackageId };
}

export interface DetectExecutionPackageRisksInput {
  packages: ExecutionPackage[];
  validationResultsByPackageId: Map<string, PackageValidationResult>;
  healthByPackageId: Map<string, PackageHealthScores>;
  readinessByPackageId: Map<string, PackageReadinessResult>;
  /** Packages whose current version's snapshot has drifted from its live source — resolved by the caller via `hasSnapshotDrifted`. */
  driftedPackageIds: Set<string>;
}

export function detectExecutionPackageRisks(input: DetectExecutionPackageRisksInput): PackageFinding[] {
  const findings: PackageFinding[] = [];

  for (const pkg of input.packages) {
    const title = pkg.metadata.title;
    const validation = input.validationResultsByPackageId.get(pkg.id);
    const health = input.healthByPackageId.get(pkg.id);
    const readiness = input.readinessByPackageId.get(pkg.id);

    // 1. Package Ready
    if (readiness?.state === "ready") {
      findings.push(finding("package_ready", "low", `"${title}" is ready for execution.`, pkg.id));
    }

    // 2. Package Incomplete
    if (readiness?.state === "incomplete") {
      findings.push(finding("package_incomplete", "medium", `"${title}" is incomplete and not yet ready for execution.`, pkg.id));
    }

    // 3. Package Invalid + 4. Missing Requirement
    if (validation !== undefined && !validation.valid) {
      findings.push(finding("package_invalid", "high", `"${title}" has blocking validation issues and cannot be approved as-is.`, pkg.id));
      for (const rule of MISSING_REQUIREMENT_RULES) {
        for (const issue of validation.errors.filter((e) => e.rule === rule)) {
          findings.push(finding("missing_requirement", "medium", issue.detail, pkg.id));
        }
      }
    }

    // 5. Version Drift
    if (input.driftedPackageIds.has(pkg.id)) {
      findings.push(finding("version_drift", "medium", `"${title}"'s current version may be stale — its source plan or allocation changed since this snapshot was captured.`, pkg.id));
    }

    // 6. Operational Risk
    if (health !== undefined && health.operationalHealth < OPERATIONAL_RISK_THRESHOLD) {
      findings.push(finding("operational_risk", "medium", `"${title}" has low operational health (${health.operationalHealth}/100).`, pkg.id));
    }

    // 7. Planning Risk
    if (health !== undefined && health.planningHealth < PLANNING_RISK_THRESHOLD) {
      findings.push(finding("planning_risk", "high", `"${title}" is missing a fundamental planning pillar (allocation, schedule, or operational plan).`, pkg.id));
    }
  }

  return findings;
}
