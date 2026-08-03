import { describe, expect, it } from "vitest";
import { computeWorkflowPerformanceMetrics } from "@/core/workflowMonitoring/performanceEngine";
import type { AutomationDefinition, AutomationExecution } from "@/types/automation";

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "automation_1",
    name: "Automation",
    description: "",
    category: "operations",
    version: "v1",
    status: "active",
    trigger: "client.created",
    conditions: [],
    actionIds: ["create-invoice"],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    metadata: { workflowId: "wf_1", workflowVersion: "1", sourceNodeIds: ["n1"] },
    ...overrides,
  };
}

function stubExecution(overrides: Partial<AutomationExecution> = {}): AutomationExecution {
  return {
    id: "exec_1",
    workspaceId: "ws_1",
    automationId: "automation_1",
    automationName: "Automation",
    automationVersion: "1",
    trigger: "client.created",
    triggerFacts: {},
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [{ actionId: "create-invoice", status: "success", message: "done", attempts: 1 }],
    status: "success",
    durationMs: 100,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.100Z",
    startedBy: "user_1",
    ...overrides,
  };
}

describe("computeWorkflowPerformanceMetrics", () => {
  it("returns an honest all-null/empty snapshot for a workspace with zero executions", () => {
    const metrics = computeWorkflowPerformanceMetrics([], [], "2026-01-01T00:00:00.000Z");
    expect(metrics.averageExecutionDurationMs).toBeNull();
    expect(metrics.successRate).toBeNull();
    expect(metrics.averageWaitTimeMs).toBeNull();
    expect(metrics.slowestWorkflows).toEqual([]);
  });

  it("computes average duration and success rate across executions", () => {
    const executions = [stubExecution({ id: "e1", durationMs: 100, status: "success" }), stubExecution({ id: "e2", durationMs: 300, status: "failure" })];
    const metrics = computeWorkflowPerformanceMetrics(executions, [stubAutomation()], "2026-01-01T00:00:00.000Z");
    expect(metrics.averageExecutionDurationMs).toBe(200);
    expect(metrics.successRate).toBe(50);
    expect(metrics.failedExecutionCount).toBe(1);
  });

  it("ranks workflows by average duration for slowest/fastest", () => {
    const fast = stubAutomation({ id: "automation_fast", metadata: { workflowId: "wf_fast", workflowVersion: "1", sourceNodeIds: [] } });
    const slow = stubAutomation({ id: "automation_slow", metadata: { workflowId: "wf_slow", workflowVersion: "1", sourceNodeIds: [] } });
    const executions = [stubExecution({ id: "e1", automationId: "automation_fast", durationMs: 50 }), stubExecution({ id: "e2", automationId: "automation_slow", durationMs: 500 })];
    const metrics = computeWorkflowPerformanceMetrics(executions, [fast, slow], "2026-01-01T00:00:00.000Z");
    expect(metrics.slowestWorkflows[0].workflowId).toBe("wf_slow");
    expect(metrics.fastestWorkflows[0].workflowId).toBe("wf_fast");
  });

  it("counts node/action/trigger frequency from the real executed path and results", () => {
    const metrics = computeWorkflowPerformanceMetrics([stubExecution()], [stubAutomation()], "2026-01-01T00:00:00.000Z");
    expect(metrics.nodeExecutionFrequency).toEqual({ n1: 1 });
    expect(metrics.actionExecutionFrequency).toEqual({ "create-invoice": 1 });
    expect(metrics.triggerFrequency["client.created"]).toBe(1);
  });

  it("computes average wait time only from executions that reached an approval decision", () => {
    const withApproval = stubExecution({ id: "e1", startedAt: "2026-01-01T00:00:00.000Z", approvedAt: "2026-01-01T00:01:00.000Z" });
    const withoutApproval = stubExecution({ id: "e2", approvedAt: null });
    const metrics = computeWorkflowPerformanceMetrics([withApproval, withoutApproval], [stubAutomation()], "2026-01-01T00:00:00.000Z");
    expect(metrics.averageWaitTimeMs).toBe(60000);
  });
});
