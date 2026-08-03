import { describe, expect, it } from "vitest";
import { allocationFindingsToRecommendations } from "@/core/allocation/allocationFindingsEngine";
import type { AllocationFinding, AllocationRequest, Allocation } from "@/types/allocation";

const NOW = "2026-01-01T00:00:00.000Z";

function makeFinding(overrides: Partial<AllocationFinding> = {}): AllocationFinding {
  return { id: "finding_1", type: "bundle_incomplete", severity: "medium", description: "Bundle incomplete.", relatedRequestId: null, relatedAllocationId: null, relatedResourceId: null, ...overrides };
}

function makeRequest(overrides: Partial<AllocationRequest> = {}): AllocationRequest {
  return {
    id: "request_1",
    workspace_id: "ws_1",
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_resources: [],
    required_starts_at: NOW,
    required_ends_at: NOW,
    calendar_id: null,
    priority: "medium",
    deadline: null,
    location_placeholder: null,
    special_instructions: null,
    bundle_id: null,
    source: "manual",
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeAllocation(overrides: Partial<Allocation> = {}): Allocation {
  return { id: "allocation_1", workspace_id: "ws_1", request_id: "request_1", group_id: "group_1", strategy: "highest_capability", status: "draft", candidates: [], created_by: "member_1", created_at: NOW, updated_at: NOW, approved_at: null, approved_by: null, archived_at: null, ...overrides };
}

describe("allocationFindingsToRecommendations", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings = [makeFinding({ severity: "high" }), makeFinding({ severity: "medium" }), makeFinding({ severity: "low" })];
    const result = allocationFindingsToRecommendations(findings, [], [], "ws_1");
    expect(result.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("resolves the node directly from relatedRequestId", () => {
    const finding = makeFinding({ relatedRequestId: "request_1" });
    const result = allocationFindingsToRecommendations([finding], [makeRequest()], [], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("resolves the node via relatedAllocationId -> request_id when relatedRequestId is absent", () => {
    const finding = makeFinding({ relatedAllocationId: "allocation_1" });
    const result = allocationFindingsToRecommendations([finding], [makeRequest()], [makeAllocation()], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("falls back to the workspace node when nothing resolves", () => {
    const result = allocationFindingsToRecommendations([makeFinding()], [], [], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("prefixes ruleId with allocation.", () => {
    const result = allocationFindingsToRecommendations([makeFinding({ type: "resource_shortage" })], [], [], "ws_1");
    expect(result[0].ruleId).toBe("allocation.resource_shortage");
  });
});
