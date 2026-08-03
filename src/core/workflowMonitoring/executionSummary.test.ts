import { describe, expect, it } from "vitest";
import { bucketForExecutionStatus, buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import type { AutomationDefinition, AutomationExecution, AutomationExecutionStatus } from "@/types/automation";

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "automation_1",
    name: "Send Welcome Note",
    description: "",
    category: "operations",
    version: "workflow-wf_1-v1",
    status: "active",
    trigger: "client.created",
    conditions: [],
    actionIds: ["create-timeline-entry"],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    metadata: { workflowId: "wf_1", workflowVersion: "1", sourceNodeIds: ["n1", "n2", "n3"] },
    ...overrides,
  };
}

function stubExecution(overrides: Partial<AutomationExecution> = {}): AutomationExecution {
  return {
    id: "exec_1",
    workspaceId: "ws_1",
    automationId: "automation_1",
    automationName: "Send Welcome Note",
    automationVersion: "workflow-wf_1-v1",
    trigger: "client.created",
    triggerFacts: { clientId: "client_1" },
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [{ actionId: "create-timeline-entry", status: "success", message: "done", attempts: 1 }],
    status: "success",
    durationMs: 120,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.120Z",
    startedBy: "user_1",
    ...overrides,
  };
}

describe("bucketForExecutionStatus", () => {
  const cases: [AutomationExecutionStatus, string][] = [
    ["success", "successful"],
    ["failure", "failed"],
    ["partial_failure", "failed"],
    ["pending_approval", "waiting"],
    ["rejected", "cancelled"],
    ["skipped_conditions_not_met", "skipped"],
  ];

  it.each(cases)("maps %s to bucket %s", (status, bucket) => {
    expect(bucketForExecutionStatus(status)).toBe(bucket);
  });

  it("never produces the 'running' bucket — the engine is fully synchronous", () => {
    for (const [status] of cases) {
      expect(bucketForExecutionStatus(status)).not.toBe("running");
    }
  });
});

describe("buildWorkflowExecutionSummaries", () => {
  it("joins an execution to its compiled Workflow via metadata.workflowId/sourceNodeIds", () => {
    const [summary] = buildWorkflowExecutionSummaries([stubExecution()], [stubAutomation()]);
    expect(summary.workflowId).toBe("wf_1");
    expect(summary.workflowVersion).toBe("1");
    expect(summary.executionPath).toEqual(["n1", "n2", "n3"]);
  });

  it("sets currentNodeId to the last node in the path once at least one action ran", () => {
    const [summary] = buildWorkflowExecutionSummaries([stubExecution()], [stubAutomation()]);
    expect(summary.currentNodeId).toBe("n3");
  });

  it("leaves currentNodeId null when no action ever ran (denied/skipped before actions)", () => {
    const execution = stubExecution({ status: "skipped_conditions_not_met", actionResults: [] });
    const [summary] = buildWorkflowExecutionSummaries([execution], [stubAutomation()]);
    expect(summary.currentNodeId).toBeNull();
  });

  it("falls back to null workflowId for a hand-registered Automation with no Workflow metadata", () => {
    const automation = stubAutomation({ metadata: undefined });
    const [summary] = buildWorkflowExecutionSummaries([stubExecution()], [automation]);
    expect(summary.workflowId).toBeNull();
    expect(summary.executionPath).toEqual([]);
  });

  it("derives entity from the first action result carrying a resultRef", () => {
    const execution = stubExecution({ actionResults: [{ actionId: "create-timeline-entry", status: "success", message: "done", attempts: 1, resultRef: { type: "client", id: "client_1" } }] });
    const [summary] = buildWorkflowExecutionSummaries([execution], [stubAutomation()]);
    expect(summary.entity).toEqual({ type: "client", id: "client_1" });
  });

  it("preserves startedBy, and defaults to null when the execution predates that field", () => {
    const withStartedBy = buildWorkflowExecutionSummaries([stubExecution()], [stubAutomation()])[0];
    expect(withStartedBy.startedBy).toBe("user_1");

    const legacyExecution = stubExecution({ startedBy: undefined });
    const legacySummary = buildWorkflowExecutionSummaries([legacyExecution], [stubAutomation()])[0];
    expect(legacySummary.startedBy).toBeNull();
  });
});
