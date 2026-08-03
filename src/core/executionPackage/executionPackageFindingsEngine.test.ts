import { describe, expect, it } from "vitest";
import { executionPackageFindingsToRecommendations } from "@/core/executionPackage/executionPackageFindingsEngine";
import type { ExecutionPackage, PackageFinding } from "@/types/executionPackage";

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

describe("executionPackageFindingsToRecommendations", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings: PackageFinding[] = [
      { id: "f1", type: "package_invalid", severity: "high", description: "d1", relatedPackageId: "package_1" },
      { id: "f2", type: "package_incomplete", severity: "medium", description: "d2", relatedPackageId: "package_1" },
      { id: "f3", type: "package_ready", severity: "low", description: "d3", relatedPackageId: "package_1" },
    ];
    const recs = executionPackageFindingsToRecommendations(findings, [makePackage()], "ws_1");
    expect(recs.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
    expect(recs.every((r) => r.ruleId.startsWith("execution_package."))).toBe(true);
  });

  it("resolves the node to the related package's own context when set", () => {
    const findings: PackageFinding[] = [{ id: "f1", type: "package_ready", severity: "low", description: "d1", relatedPackageId: "package_1" }];
    const recs = executionPackageFindingsToRecommendations(findings, [makePackage()], "ws_1");
    expect(recs[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("falls back to the workspace node when there's no related package or its context is null", () => {
    const findings: PackageFinding[] = [{ id: "f1", type: "package_ready", severity: "low", description: "d1", relatedPackageId: null }];
    const recs = executionPackageFindingsToRecommendations(findings, [], "ws_1");
    expect(recs[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });
});
