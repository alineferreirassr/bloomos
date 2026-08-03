import type { PackageValidationResult, PackageHealthScores, PackageExplanation } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 27.3, Step 6 — Package Explanation Engine. Turns an
 * already-validated, already-scored package into readable prose — the
 * same discipline `operationalExplanationEngine.ts`/
 * `allocationExplanationEngine.ts`/`capabilityExplanationEngine.ts`
 * established: never expose a bare health number without the reasoning
 * behind it.
 */
export function explainPackage(validation: PackageValidationResult, health: PackageHealthScores): PackageExplanation {
  const missingResources = validation.errors.filter((e) => e.rule === "missing_allocation" || e.rule === "missing_schedule").map((e) => e.detail);
  const missingEvidence = validation.errors.filter((e) => e.rule === "missing_evidence").map((e) => e.detail);
  const missingApprovals = validation.warnings.filter((w) => w.rule === "required_approvals").map((w) => w.detail);
  const brokenDependencies = validation.errors.filter((e) => e.rule === "broken_dependencies").map((e) => e.detail);
  const missingDeliverables = validation.errors.filter((e) => e.rule === "missing_deliverables").map((e) => e.detail);

  const whyFailed = validation.valid ? [] : validation.errors.map((e) => e.detail);
  const whyPassed = validation.valid ? ["Every required plan, allocation, and schedule element is present and internally consistent."] : [];

  const healthCalculations = [
    `Planning health ${health.planningHealth}/100 — how many of allocation, schedule, and operational plan are present.`,
    `Allocation health ${health.allocationHealth}/100 — share of the allocation's resource lines that have a selected candidate.`,
    `Operational health ${health.operationalHealth}/100 — the underlying operational plan's own completeness.`,
    `Dependency health ${health.dependencyHealth}/100 — step dependency and resource dependency satisfaction, blended.`,
    `Bundle health ${health.bundleHealth}/100 — required resource bundle lines fulfilled.`,
    `Evidence coverage ${health.evidenceCoverage}/100 — milestones with at least one declared evidence requirement.`,
    `Checklist coverage ${health.checklistCoverage}/100 — attached checklist item completion.`,
  ];

  const issueNote = validation.valid ? "" : ` (${validation.errors.length} blocking issue${validation.errors.length === 1 ? "" : "s"})`;
  const summary = `Overall package health ${health.overallPackageHealth}/100${issueNote}.`;

  return { summary, whyPassed, whyFailed, missingResources, missingEvidence, missingApprovals, brokenDependencies, missingDeliverables, healthCalculations };
}
