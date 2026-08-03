import { describe, expect, it } from "vitest";
import { computePackageReadiness } from "@/core/executionPackage/readinessEngine";
import type { PackageHealthScores, PackageValidationResult } from "@/types/executionPackage";

const PERFECT_HEALTH: PackageHealthScores = { planningHealth: 100, allocationHealth: 100, operationalHealth: 100, dependencyHealth: 100, bundleHealth: 100, evidenceCoverage: 100, checklistCoverage: 100, overallPackageHealth: 100 };
const VALID: PackageValidationResult = { valid: true, errors: [], warnings: [] };

describe("computePackageReadiness", () => {
  it("is ready when valid, no warnings, and health is at/above threshold", () => {
    expect(computePackageReadiness({ validation: VALID, health: PERFECT_HEALTH })).toEqual({ state: "ready", reasons: [] });
  });

  it("is waiting_resources when there's no allocation, outranking every other state", () => {
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "missing_allocation", detail: "No allocation." }, { rule: "missing_schedule", detail: "No schedule." }], warnings: [{ rule: "required_approvals", detail: "1 pending." }] };
    const result = computePackageReadiness({ validation, health: PERFECT_HEALTH });
    expect(result.state).toBe("waiting_resources");
  });

  it("is waiting_schedule when only the schedule is missing", () => {
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "missing_schedule", detail: "No schedule." }], warnings: [] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("waiting_schedule");
  });

  it("is waiting_dependencies for a broken/circular dependency", () => {
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "broken_dependencies", detail: "Cycle detected." }], warnings: [] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("waiting_dependencies");
  });

  it("is waiting_dependencies for an unsatisfied capability gap warning alone", () => {
    const validation: PackageValidationResult = { valid: true, errors: [], warnings: [{ rule: "capability_gap", detail: "Drone requires a certified operator." }] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("waiting_dependencies");
  });

  it("is waiting_evidence when evidence is missing", () => {
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "missing_evidence", detail: "Evidence orphaned." }], warnings: [] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("waiting_evidence");
  });

  it("is waiting_approval when only an approval is pending", () => {
    const validation: PackageValidationResult = { valid: true, errors: [], warnings: [{ rule: "required_approvals", detail: "1 approval pending." }] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("waiting_approval");
  });

  it("is blocked for a structural error not covered by a more specific state", () => {
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "missing_deliverables", detail: "Deliverable orphaned." }], warnings: [] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("blocked");
  });

  it("is incomplete when valid but a non-approval warning exists", () => {
    const validation: PackageValidationResult = { valid: true, errors: [], warnings: [{ rule: "incomplete_checklist", detail: "Checklist incomplete." }] };
    expect(computePackageReadiness({ validation, health: PERFECT_HEALTH }).state).toBe("incomplete");
  });

  it("is incomplete when valid with no warnings but health is below the threshold", () => {
    const result = computePackageReadiness({ validation: VALID, health: { ...PERFECT_HEALTH, overallPackageHealth: 60 } });
    expect(result.state).toBe("incomplete");
  });
});
