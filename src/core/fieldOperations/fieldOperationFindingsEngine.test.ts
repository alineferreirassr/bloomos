import { describe, expect, it } from "vitest";
import { fieldOperationFindingsToRecommendations } from "@/core/fieldOperations/fieldOperationFindingsEngine";
import type { FieldOperationFinding, FieldOperation } from "@/types/fieldOperations";

function buildOperation(overrides: Partial<FieldOperation> = {}): FieldOperation {
  return {
    id: "field_operation_1",
    workspace_id: "ws_1",
    dispatch_order_id: "dispatch_order_1",
    dispatch_assignment_id: "assignment_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    priority: "medium",
    context: { nodeType: "event", nodeId: "event_1" },
    status: "active",
    sessions: [],
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function buildFinding(overrides: Partial<FieldOperationFinding> = {}): FieldOperationFinding {
  return { id: "finding_1", type: "execution_blocked", severity: "high", description: "Blocked.", relatedFieldOperationId: "field_operation_1", ...overrides };
}

describe("fieldOperationFindingsEngine", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings: FieldOperationFinding[] = [buildFinding({ id: "f1", severity: "high" }), buildFinding({ id: "f2", severity: "medium" }), buildFinding({ id: "f3", severity: "low" })];
    const recommendations = fieldOperationFindingsToRecommendations(findings, [buildOperation()], "ws_1");
    expect(recommendations.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("prefixes ruleId with field_operations.", () => {
    const recommendations = fieldOperationFindingsToRecommendations([buildFinding({ type: "operational_delay" })], [buildOperation()], "ws_1");
    expect(recommendations[0].ruleId).toBe("field_operations.operational_delay");
  });

  it("resolves the related operation's own context node when set", () => {
    const recommendations = fieldOperationFindingsToRecommendations([buildFinding()], [buildOperation({ context: { nodeType: "event", nodeId: "event_specific" } })], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "event", nodeId: "event_specific" });
  });

  it("falls back to the workspace node when the operation has no context", () => {
    const recommendations = fieldOperationFindingsToRecommendations([buildFinding()], [buildOperation({ context: null })], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("falls back to the workspace node when no related operation is found", () => {
    const recommendations = fieldOperationFindingsToRecommendations([buildFinding({ relatedFieldOperationId: "missing" })], [buildOperation()], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("falls back to the workspace node when relatedFieldOperationId is null", () => {
    const recommendations = fieldOperationFindingsToRecommendations([buildFinding({ relatedFieldOperationId: null })], [buildOperation()], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });
});
