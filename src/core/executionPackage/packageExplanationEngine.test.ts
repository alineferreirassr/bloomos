import { describe, expect, it } from "vitest";
import { explainPackage } from "@/core/executionPackage/packageExplanationEngine";
import type { PackageHealthScores, PackageValidationResult } from "@/types/executionPackage";

const PERFECT_HEALTH: PackageHealthScores = { planningHealth: 100, allocationHealth: 100, operationalHealth: 100, dependencyHealth: 100, bundleHealth: 100, evidenceCoverage: 100, checklistCoverage: 100, overallPackageHealth: 100 };

describe("explainPackage", () => {
  it("summarizes a passing package with no blocking issues", () => {
    const validation: PackageValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainPackage(validation, PERFECT_HEALTH);
    expect(explanation.summary).toBe("Overall package health 100/100.");
    expect(explanation.whyFailed).toHaveLength(0);
    expect(explanation.whyPassed.length).toBeGreaterThan(0);
  });

  it("surfaces missing_allocation/missing_schedule under missingResources", () => {
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "missing_allocation", detail: "No allocation." }, { rule: "missing_schedule", detail: "No schedule." }], warnings: [] };
    const explanation = explainPackage(validation, PERFECT_HEALTH);
    expect(explanation.missingResources).toEqual(["No allocation.", "No schedule."]);
    expect(explanation.whyFailed).toEqual(["No allocation.", "No schedule."]);
    expect(explanation.summary).toContain("2 blocking issues");
  });

  it("separates broken dependencies, missing evidence, and missing deliverables into their own buckets", () => {
    const validation: PackageValidationResult = {
      valid: false,
      errors: [
        { rule: "broken_dependencies", detail: "Cycle detected." },
        { rule: "missing_evidence", detail: "Evidence orphaned." },
        { rule: "missing_deliverables", detail: "Deliverable orphaned." },
      ],
      warnings: [{ rule: "required_approvals", detail: "1 approval pending." }],
    };
    const explanation = explainPackage(validation, PERFECT_HEALTH);
    expect(explanation.brokenDependencies).toEqual(["Cycle detected."]);
    expect(explanation.missingEvidence).toEqual(["Evidence orphaned."]);
    expect(explanation.missingDeliverables).toEqual(["Deliverable orphaned."]);
    expect(explanation.missingApprovals).toEqual(["1 approval pending."]);
  });

  it("includes a readable calculation line for every one of the 7 component scores", () => {
    const explanation = explainPackage({ valid: true, errors: [], warnings: [] }, PERFECT_HEALTH);
    expect(explanation.healthCalculations).toHaveLength(7);
  });
});
