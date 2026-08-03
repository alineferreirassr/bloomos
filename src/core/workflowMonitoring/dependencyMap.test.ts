import { describe, expect, it } from "vitest";
import { computeWorkflowDependencyMap } from "@/core/workflowMonitoring/dependencyMap";
import type { AutomationDefinition } from "@/types/automation";
import type { Workflow } from "@/types/workflow";

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
    actionIds: [],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    metadata: { workflowId: "wf_1", workflowVersion: "1", sourceNodeIds: [] },
    ...overrides,
  };
}

function stubWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf_1",
    workspaceId: "ws_1",
    status: "published",
    metadata: { name: "Workflow", description: "", category: "operations", tags: [] },
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

describe("computeWorkflowDependencyMap", () => {
  it("builds a trigger graph from every compiled Workflow's own trigger type", () => {
    const automation = stubAutomation({ trigger: "event.created" });
    const map = computeWorkflowDependencyMap([automation], [stubWorkflow()], "2026-01-01T00:00:00.000Z");
    expect(map.triggerGraph["event.created"]).toEqual(["wf_1"]);
  });

  it("finds a workflow-triggering-workflow edge when one workflow's action produces a trigger another listens for", () => {
    const source = stubAutomation({ id: "automation_source", actionIds: ["create-event"], metadata: { workflowId: "wf_source", workflowVersion: "1", sourceNodeIds: [] } });
    const target = stubAutomation({ id: "automation_target", trigger: "event.created", metadata: { workflowId: "wf_target", workflowVersion: "1", sourceNodeIds: [] } });
    const map = computeWorkflowDependencyMap([source, target], [stubWorkflow({ id: "wf_source" }), stubWorkflow({ id: "wf_target" })], "2026-01-01T00:00:00.000Z");
    expect(map.workflowsTriggeringWorkflows).toHaveLength(1);
    expect(map.workflowsTriggeringWorkflows[0]).toMatchObject({ sourceWorkflowId: "wf_source", producedTrigger: "event.created", targetWorkflowIds: ["wf_target"] });
  });

  it("detects a self-loop when a workflow's own action re-triggers the same workflow", () => {
    // wf_b listens for "event.created" AND its own compiled path runs "create-event" — a real, honest self-reference, not a fabricated one.
    const selfLooping = stubAutomation({ id: "automation_b", trigger: "event.created", actionIds: ["create-event"], metadata: { workflowId: "wf_b", workflowVersion: "1", sourceNodeIds: [] } });
    const map = computeWorkflowDependencyMap([selfLooping], [stubWorkflow({ id: "wf_b" })], "2026-01-01T00:00:00.000Z");
    expect(map.circularChains).toEqual([["wf_b"]]);
  });

  it("reports no circular chain when a workflow's produced trigger only feeds a different workflow", () => {
    const source = stubAutomation({ id: "automation_source", actionIds: ["create-event"], metadata: { workflowId: "wf_source", workflowVersion: "1", sourceNodeIds: [] } });
    const target = stubAutomation({ id: "automation_target", trigger: "event.created", actionIds: [], metadata: { workflowId: "wf_target", workflowVersion: "1", sourceNodeIds: [] } });
    const map = computeWorkflowDependencyMap([source, target], [stubWorkflow({ id: "wf_source" }), stubWorkflow({ id: "wf_target" })], "2026-01-01T00:00:00.000Z");
    expect(map.circularChains).toEqual([]);
  });

  it("never fabricates a produced-trigger edge for an action id with no known real dispatch (only 'create-event' is derivable)", () => {
    const automation = stubAutomation({ actionIds: ["create-invoice", "assign-worker"] });
    const map = computeWorkflowDependencyMap([automation], [stubWorkflow()], "2026-01-01T00:00:00.000Z");
    expect(map.workflowsTriggeringWorkflows).toEqual([]);
  });

  it("builds the action graph keyed by workflow id", () => {
    const automation = stubAutomation({ actionIds: ["create-invoice", "create-timeline-entry"] });
    const map = computeWorkflowDependencyMap([automation], [stubWorkflow()], "2026-01-01T00:00:00.000Z");
    expect(map.actionGraph.wf_1).toEqual(["create-invoice", "create-timeline-entry"]);
  });

  it("ignores hand-registered Automations with no Workflow metadata for workflow-level edges", () => {
    const handWritten = stubAutomation({ metadata: undefined });
    const map = computeWorkflowDependencyMap([handWritten], [], "2026-01-01T00:00:00.000Z");
    expect(map.actionGraph).toEqual({});
    expect(map.workflowsTriggeringWorkflows).toEqual([]);
  });
});
