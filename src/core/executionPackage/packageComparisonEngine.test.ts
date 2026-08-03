import { describe, expect, it } from "vitest";
import { resolvePackageRiskLevel, compareExecutionVersions } from "@/core/executionPackage/packageComparisonEngine";
import type { ExecutionVersion, PackageHealthScores } from "@/types/executionPackage";

const PERFECT_HEALTH: PackageHealthScores = { planningHealth: 100, allocationHealth: 100, operationalHealth: 100, dependencyHealth: 100, bundleHealth: 100, evidenceCoverage: 100, checklistCoverage: 100, overallPackageHealth: 100 };
const POOR_HEALTH: PackageHealthScores = { ...PERFECT_HEALTH, overallPackageHealth: 40 };

function baseVersion(overrides: Partial<ExecutionVersion> = {}): ExecutionVersion {
  return {
    id: "version_1",
    package_id: "package_1",
    workspace_id: "ws_1",
    version_number: 1,
    snapshot: { id: "snapshot_1", captured_at: "2026-01-01T00:00:00.000Z", allocation_id: "allocation_1", allocation_strategy: "highest_capability", allocation_candidates: [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }], appointment_id: "appointment_1", scheduled_starts_at: null, scheduled_ends_at: null, calendar_id: null, operational_plan_id: "plan_1", phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], bundle_id: null, bundle_snapshot: null, dependency_checks: [], resource_pool: null },
    instructions: { sections: [{ section: "preparation", text: "Load van." }], safety_notes: [], customer_notes: [], equipment_notes: [], vehicle_notes: [], special_instructions: [] },
    attachments: [],
    notes: null,
    reason: null,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolvePackageRiskLevel", () => {
  it("is high regardless of health when there's a blocking validation error", () => {
    expect(resolvePackageRiskLevel(PERFECT_HEALTH, 1)).toBe("high");
  });

  it("is low/medium/high by health threshold when there are no blocking errors", () => {
    expect(resolvePackageRiskLevel(PERFECT_HEALTH, 0)).toBe("low");
    expect(resolvePackageRiskLevel(POOR_HEALTH, 0)).toBe("high");
  });
});

describe("compareExecutionVersions", () => {
  it("reports no changes when versions are identical", () => {
    const v1 = baseVersion();
    const v2 = baseVersion({ version_number: 2, id: "version_2" });
    const result = compareExecutionVersions(v1, v2, PERFECT_HEALTH, PERFECT_HEALTH, 0, 0);
    expect(result.changes).toHaveLength(0);
    expect(result.resourceChanges).toHaveLength(0);
  });

  it("detects an allocation change", () => {
    const v1 = baseVersion();
    const v2 = baseVersion({ version_number: 2, id: "version_2", snapshot: { ...v1.snapshot, allocation_id: "allocation_2" } });
    const result = compareExecutionVersions(v1, v2, PERFECT_HEALTH, PERFECT_HEALTH, 0, 0);
    expect(result.changes.some((c) => c.includes("Allocation changed"))).toBe(true);
  });

  it("detects added/removed selected resources", () => {
    const v1 = baseVersion();
    const v2 = baseVersion({
      version_number: 2,
      id: "version_2",
      snapshot: { ...v1.snapshot, allocation_candidates: [{ resource_type: "worker", resource_id: "worker_2", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }] },
    });
    const result = compareExecutionVersions(v1, v2, PERFECT_HEALTH, PERFECT_HEALTH, 0, 0);
    expect(result.resourceChanges.some((c) => c.includes("Added resources: worker_2"))).toBe(true);
    expect(result.resourceChanges.some((c) => c.includes("Removed resources: worker_1"))).toBe(true);
  });

  it("detects instruction text changes", () => {
    const v1 = baseVersion();
    const v2 = baseVersion({ version_number: 2, id: "version_2", instructions: { ...v1.instructions, sections: [{ section: "preparation", text: "Load van and check tires." }] } });
    const result = compareExecutionVersions(v1, v2, PERFECT_HEALTH, PERFECT_HEALTH, 0, 0);
    expect(result.instructionChanges.length).toBeGreaterThan(0);
  });

  it("returns riskA/riskB and healthA/healthB from the caller's inputs", () => {
    const v1 = baseVersion();
    const v2 = baseVersion({ version_number: 2, id: "version_2" });
    const result = compareExecutionVersions(v1, v2, PERFECT_HEALTH, POOR_HEALTH, 0, 1);
    expect(result.riskA).toBe("low");
    expect(result.riskB).toBe("high");
    expect(result.versionANumber).toBe(1);
    expect(result.versionBNumber).toBe(2);
  });
});
