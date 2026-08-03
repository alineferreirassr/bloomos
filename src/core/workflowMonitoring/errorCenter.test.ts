import { describe, expect, it } from "vitest";
import { collectWorkflowErrors } from "@/core/workflowMonitoring/errorCenter";
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
    maxRetries: 2,
    ...overrides,
  };
}

function stubExecution(overrides: Partial<AutomationExecution> = {}): AutomationExecution {
  return {
    id: "exec_1",
    workspaceId: "ws_1",
    automationId: "automation_1",
    automationName: "Automation",
    automationVersion: "v1",
    trigger: "client.created",
    triggerFacts: {},
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [{ actionId: "create-invoice", status: "failure", message: "Invoice total must be positive.", attempts: 3 }],
    status: "failure",
    durationMs: 50,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.050Z",
    startedBy: "user_1",
    ...overrides,
  };
}

describe("collectWorkflowErrors", () => {
  it("produces one error record per failed action, with the action's own message as the stack", () => {
    const [error] = collectWorkflowErrors([stubExecution()], [stubAutomation()]);
    expect(error.actionId).toBe("create-invoice");
    expect(error.stack).toBe("Invoice total must be positive.");
    expect(error.retryCount).toBe(2);
  });

  it("skips executions that succeeded or were only skipped by conditions", () => {
    const success = stubExecution({ id: "e_success", status: "success", actionResults: [{ actionId: "create-invoice", status: "success", message: "done", attempts: 1 }] });
    const skipped = stubExecution({ id: "e_skipped", status: "skipped_conditions_not_met", actionResults: [] });
    expect(collectWorkflowErrors([success, skipped], [stubAutomation()])).toEqual([]);
  });

  it("skips individual action results that didn't fail, even within a partial_failure execution", () => {
    const execution = stubExecution({
      status: "partial_failure",
      actionResults: [
        { actionId: "create-invoice", status: "failure", message: "boom", attempts: 1 },
        { actionId: "create-timeline-entry", status: "success", message: "ok", attempts: 1 },
      ],
    });
    const errors = collectWorkflowErrors([execution], [stubAutomation()]);
    expect(errors).toHaveLength(1);
    expect(errors[0].actionId).toBe("create-invoice");
  });

  it("sorts errors newest first", () => {
    const older = stubExecution({ id: "e_older", startedAt: "2026-01-01T00:00:00.000Z" });
    const newer = stubExecution({ id: "e_newer", startedAt: "2026-01-02T00:00:00.000Z" });
    const errors = collectWorkflowErrors([older, newer], [stubAutomation()]);
    expect(errors[0].executionId).toBe("e_newer");
  });
});
