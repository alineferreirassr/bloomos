import { describe, expect, it } from "vitest";
import { buildWorkflowAuditRecords } from "@/core/workflowMonitoring/auditEngine";
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
    metadata: { workflowId: "wf_1", workflowVersion: "3", sourceNodeIds: ["n1", "n2"] },
    ...overrides,
  };
}

function stubExecution(overrides: Partial<AutomationExecution> = {}): AutomationExecution {
  return {
    id: "exec_1",
    workspaceId: "ws_1",
    automationId: "automation_1",
    automationName: "Automation",
    automationVersion: "3",
    trigger: "client.created",
    triggerFacts: { clientId: "client_1" },
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [{ actionId: "create-invoice", status: "success", message: "done", attempts: 1 }],
    status: "success",
    durationMs: 250,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.250Z",
    startedBy: "user_1",
    ...overrides,
  };
}

describe("buildWorkflowAuditRecords", () => {
  it("carries the exact version executed, inputs, outputs, duration, and node path — no recomputation", () => {
    const [record] = buildWorkflowAuditRecords([stubExecution()], [stubAutomation()]);
    expect(record.versionExecuted).toBe("3");
    expect(record.inputs).toEqual({ clientId: "client_1" });
    expect(record.outputs).toEqual([{ actionId: "create-invoice", status: "success", message: "done", attempts: 1 }]);
    expect(record.durationMs).toBe(250);
    expect(record.nodePath).toEqual(["n1", "n2"]);
  });

  it("records the real actor, falling back to 'system' when no member started the execution", () => {
    const [withActor] = buildWorkflowAuditRecords([stubExecution({ startedBy: "user_1" })], [stubAutomation()]);
    expect(withActor.actor).toBe("user_1");

    const [systemActor] = buildWorkflowAuditRecords([stubExecution({ startedBy: null })], [stubAutomation()]);
    expect(systemActor.actor).toBe("system");
  });

  it("uses startedAt as the immutable audit timestamp", () => {
    const [record] = buildWorkflowAuditRecords([stubExecution({ startedAt: "2026-03-05T10:00:00.000Z" })], [stubAutomation()]);
    expect(record.timestamp).toBe("2026-03-05T10:00:00.000Z");
  });
});
