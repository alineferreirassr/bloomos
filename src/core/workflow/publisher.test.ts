import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { publishWorkflow, archiveWorkflowAndDisableAutomations, unarchiveWorkflowAndEnableAutomations } from "@/core/workflow/publisher";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { getWorkflowManager } from "@/core/workflow/manager";
import { resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";
import { getAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import type { WorkflowEdge, WorkflowExecutionPolicy, WorkflowGraph, WorkflowMetadata, WorkflowNode } from "@/types/workflow";

function node(overrides: Partial<WorkflowNode> & Pick<WorkflowNode, "id" | "kind" | "nodeTypeId">): WorkflowNode {
  return { position: { x: 0, y: 0 }, label: overrides.id, data: {}, ...overrides };
}

function edge(overrides: Partial<WorkflowEdge> & Pick<WorkflowEdge, "id" | "sourceNodeId" | "targetNodeId">): WorkflowEdge {
  return { branch: null, ...overrides };
}

function metadata(overrides: Partial<WorkflowMetadata> = {}): WorkflowMetadata {
  return { name: "Test Workflow", description: "A workflow for publisher tests.", category: "operations", tags: [], ...overrides };
}

function executionPolicy(overrides: Partial<WorkflowExecutionPolicy> = {}): WorkflowExecutionPolicy {
  return { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null, ...overrides };
}

function validGraph(actionNodeTypeId = "action.create-task"): WorkflowGraph {
  return {
    nodes: [
      node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
      node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
      node({ id: "n3", kind: "action", nodeTypeId: actionNodeTypeId }),
      node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
    ],
    edges: [
      edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
      edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
      edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
    ],
    variables: [],
  };
}

async function createWorkflow(graph: WorkflowGraph = validGraph()) {
  const result = await getWorkflowManager().createWorkflow("ws_1", "user_1", { metadata: metadata(), executionPolicy: executionPolicy(), graph });
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

beforeAll(() => registerWorkflowNodes());

afterEach(() => {
  resetWorkflowStore();
  resetAutomationRegistry();
});

describe("publishWorkflow", () => {
  it("fails for an unknown Workflow", async () => {
    const result = await publishWorkflow("missing", "user_1");
    expect(result.success).toBe(false);
  });

  it("blocks publishing a Workflow with validation errors, registering nothing", async () => {
    const workflow = await createWorkflow({ nodes: [node({ id: "n1", kind: "start", nodeTypeId: "control.start" })], edges: [], variables: [] });
    const result = await publishWorkflow(workflow.id, "user_1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues?.length).toBeGreaterThan(0);
  });

  it("compiles, registers real Automations, and records version 1", async () => {
    const workflow = await createWorkflow();
    const result = await publishWorkflow(workflow.id, "user_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.version.version).toBe(1);
      expect(result.version.compiledAutomationIds).toHaveLength(1);
      const registered = getAutomation(result.version.compiledAutomationIds[0]);
      expect(registered).toBeDefined();
      expect(registered?.trigger).toBe("proposal.rejected");
    }

    const updatedWorkflow = await getWorkflowManager().getWorkflowById(workflow.id);
    expect(updatedWorkflow?.status).toBe("published");
    expect(updatedWorkflow?.currentVersion).toBe(1);
  });

  it("re-publishing after removing a path unregisters that path's own stale Automation", async () => {
    const branchingGraph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.invoice-overdue" }),
        node({ id: "n3", kind: "condition", nodeTypeId: "condition.days-overdue", data: { operator: "gte", value: 7 } }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
        node({ id: "n5", kind: "action", nodeTypeId: "action.create-task" }),
        node({ id: "n6", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
        edge({ id: "e4", sourceNodeId: "n3", targetNodeId: "n5", branch: "false" }),
        edge({ id: "e5", sourceNodeId: "n4", targetNodeId: "n6" }),
        edge({ id: "e6", sourceNodeId: "n5", targetNodeId: "n6" }),
      ],
      variables: [],
    };
    const workflow = await createWorkflow(branchingGraph);
    const first = await publishWorkflow(workflow.id, "user_1");
    if (!first.success) throw new Error("setup failed");
    expect(first.version.compiledAutomationIds).toHaveLength(2);
    const [, pathOneId] = first.version.compiledAutomationIds;

    // Collapse to a single, unconditional path — the Condition node and its
    // "false" branch action are both removed.
    const collapsedGraph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.invoice-overdue" }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
        node({ id: "n6", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n4" }),
        edge({ id: "e5", sourceNodeId: "n4", targetNodeId: "n6" }),
      ],
      variables: [],
    };
    await getWorkflowManager().updateWorkflowDraft(workflow.id, { graph: collapsedGraph });
    const second = await publishWorkflow(workflow.id, "user_1");
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.version.version).toBe(2);
      expect(second.version.compiledAutomationIds).toHaveLength(1);
    }

    // Both paths compiled from version 1 are gone — including the surviving
    // one's own OLD id (`...path-0`), since it's now a single-path Trigger
    // and recompiles under the same `path-0` suffix as a *new* registration;
    // what matters is the second path's own id (`...path-1`, the removed
    // "false" branch) is no longer registered at all.
    expect(getAutomation(pathOneId)).toBeUndefined();
  });

  it("fails to publish an archived Workflow", async () => {
    const workflow = await createWorkflow();
    await getWorkflowManager().archiveWorkflow(workflow.id);
    const result = await publishWorkflow(workflow.id, "user_1");
    expect(result.success).toBe(false);
  });
});

describe("archiveWorkflowAndDisableAutomations / unarchiveWorkflowAndEnableAutomations", () => {
  it("disables the last-published version's own Automations on archive, without unregistering them", async () => {
    const workflow = await createWorkflow();
    const published = await publishWorkflow(workflow.id, "user_1");
    if (!published.success) throw new Error("setup failed");
    const automationId = published.version.compiledAutomationIds[0];

    await archiveWorkflowAndDisableAutomations(workflow.id);
    expect(getAutomation(automationId)?.status).toBe("disabled");
  });

  it("re-enables Automations on unarchive", async () => {
    const workflow = await createWorkflow();
    const published = await publishWorkflow(workflow.id, "user_1");
    if (!published.success) throw new Error("setup failed");
    const automationId = published.version.compiledAutomationIds[0];

    await archiveWorkflowAndDisableAutomations(workflow.id);
    await unarchiveWorkflowAndEnableAutomations(workflow.id);
    expect(getAutomation(automationId)?.status).toBe("active");
  });

  it("archiving a Workflow that was never published is a no-op for the Automation Registry", async () => {
    const workflow = await createWorkflow();
    const result = await archiveWorkflowAndDisableAutomations(workflow.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("archived");
  });
});
