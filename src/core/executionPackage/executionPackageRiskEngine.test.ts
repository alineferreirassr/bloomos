import { describe, expect, it } from "vitest";
import { detectExecutionPackageRisks } from "@/core/executionPackage/executionPackageRiskEngine";
import type { ExecutionPackage, PackageHealthScores, PackageValidationResult, PackageReadinessResult } from "@/types/executionPackage";

const PERFECT_HEALTH: PackageHealthScores = { planningHealth: 100, allocationHealth: 100, operationalHealth: 100, dependencyHealth: 100, bundleHealth: 100, evidenceCoverage: 100, checklistCoverage: 100, overallPackageHealth: 100 };
const VALID: PackageValidationResult = { valid: true, errors: [], warnings: [] };

function makePackage(overrides: Partial<ExecutionPackage> = {}): ExecutionPackage {
  return {
    id: "package_1",
    workspace_id: "ws_1",
    metadata: { title: "Amoré Wedding — Execution Package", notes: null, tags: [] },
    context: { context_type: "event", context: { nodeType: "event", nodeId: "event_1" }, customer: null, location_placeholder: null, priority: "medium" },
    source: "manual",
    status: "draft",
    current_version_id: "version_1",
    versions: [],
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    approved_at: null,
    approved_by: null,
    archived_at: null,
    ...overrides,
  };
}

describe("detectExecutionPackageRisks", () => {
  it("finds package_ready when readiness state is ready", () => {
    const pkg = makePackage();
    const readiness: PackageReadinessResult = { state: "ready", reasons: [] };
    const findings = detectExecutionPackageRisks({
      packages: [pkg],
      validationResultsByPackageId: new Map([[pkg.id, VALID]]),
      healthByPackageId: new Map([[pkg.id, PERFECT_HEALTH]]),
      readinessByPackageId: new Map([[pkg.id, readiness]]),
      driftedPackageIds: new Set(),
    });
    expect(findings.some((f) => f.type === "package_ready" && f.severity === "low")).toBe(true);
  });

  it("finds package_invalid and a missing_requirement finding for a specific missing rule", () => {
    const pkg = makePackage();
    const validation: PackageValidationResult = { valid: false, errors: [{ rule: "missing_allocation", detail: "No allocation." }], warnings: [] };
    const findings = detectExecutionPackageRisks({
      packages: [pkg],
      validationResultsByPackageId: new Map([[pkg.id, validation]]),
      healthByPackageId: new Map([[pkg.id, PERFECT_HEALTH]]),
      readinessByPackageId: new Map(),
      driftedPackageIds: new Set(),
    });
    expect(findings.some((f) => f.type === "package_invalid" && f.severity === "high")).toBe(true);
    expect(findings.some((f) => f.type === "missing_requirement" && f.description === "No allocation.")).toBe(true);
  });

  it("finds version_drift for a drifted package", () => {
    const pkg = makePackage();
    const findings = detectExecutionPackageRisks({
      packages: [pkg],
      validationResultsByPackageId: new Map([[pkg.id, VALID]]),
      healthByPackageId: new Map([[pkg.id, PERFECT_HEALTH]]),
      readinessByPackageId: new Map(),
      driftedPackageIds: new Set([pkg.id]),
    });
    expect(findings.some((f) => f.type === "version_drift")).toBe(true);
  });

  it("finds operational_risk and planning_risk when health is low", () => {
    const pkg = makePackage();
    const poorHealth: PackageHealthScores = { ...PERFECT_HEALTH, operationalHealth: 40, planningHealth: 30 };
    const findings = detectExecutionPackageRisks({
      packages: [pkg],
      validationResultsByPackageId: new Map([[pkg.id, VALID]]),
      healthByPackageId: new Map([[pkg.id, poorHealth]]),
      readinessByPackageId: new Map(),
      driftedPackageIds: new Set(),
    });
    expect(findings.some((f) => f.type === "operational_risk" && f.severity === "medium")).toBe(true);
    expect(findings.some((f) => f.type === "planning_risk" && f.severity === "high")).toBe(true);
  });

  it("finds nothing for a healthy, valid, non-drifted, non-ready-evaluated package", () => {
    const pkg = makePackage();
    const findings = detectExecutionPackageRisks({
      packages: [pkg],
      validationResultsByPackageId: new Map([[pkg.id, VALID]]),
      healthByPackageId: new Map([[pkg.id, PERFECT_HEALTH]]),
      readinessByPackageId: new Map(),
      driftedPackageIds: new Set(),
    });
    expect(findings).toHaveLength(0);
  });
});
