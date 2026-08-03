import { describe, expect, it } from "vitest";
import { computeWorkflowLiveMonitor } from "@/core/workflowMonitoring/liveMonitor";
import type { AutomationExecution } from "@/types/automation";
import type { Workflow } from "@/types/workflow";

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
    actionResults: [],
    status: "success",
    durationMs: 100,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.100Z",
    startedBy: "user_1",
    ...overrides,
  };
}

function stubWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf_1",
    workspaceId: "ws_1",
    status: "published",
    metadata: { name: "Welcome Flow", description: "", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph: { nodes: [], edges: [], variables: [] },
    currentVersion: 1,
    createdBy: "user_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

describe("computeWorkflowLiveMonitor", () => {
  it("groups executions into the correct bucket, with running always empty", () => {
    const executions = [
      stubExecution({ id: "e1", status: "success" }),
      stubExecution({ id: "e2", status: "failure" }),
      stubExecution({ id: "e3", status: "pending_approval" }),
      stubExecution({ id: "e4", status: "rejected" }),
    ];
    const snapshot = computeWorkflowLiveMonitor(executions, [], [], "2026-01-01T00:00:00.000Z");
    expect(snapshot.buckets.successful).toHaveLength(1);
    expect(snapshot.buckets.failed).toHaveLength(1);
    expect(snapshot.buckets.waiting).toHaveLength(1);
    expect(snapshot.buckets.cancelled).toHaveLength(1);
    expect(snapshot.buckets.running).toHaveLength(0);
  });

  it("lists only Workflows with a configured schedule as 'scheduled', never a live execution", () => {
    const scheduled = stubWorkflow({ id: "wf_scheduled", executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: { frequency: "daily", time: "09:00", dayOfWeek: null, dayOfMonth: null } } });
    const unscheduled = stubWorkflow({ id: "wf_unscheduled" });
    const snapshot = computeWorkflowLiveMonitor([], [], [scheduled, unscheduled], "2026-01-01T00:00:00.000Z");
    expect(snapshot.scheduled).toHaveLength(1);
    expect(snapshot.scheduled[0].workflowId).toBe("wf_scheduled");
    expect(snapshot.scheduled[0].frequency).toBe("daily");
  });

  it("returns every bucket as an empty array for a workspace with no executions yet", () => {
    const snapshot = computeWorkflowLiveMonitor([], [], [], "2026-01-01T00:00:00.000Z");
    for (const bucket of Object.values(snapshot.buckets)) expect(bucket).toEqual([]);
  });
});
