import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { simulateWorkflow } from "@/core/workflow/simulator";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/types/workflow";

function node(overrides: Partial<WorkflowNode> & Pick<WorkflowNode, "id" | "kind" | "nodeTypeId">): WorkflowNode {
  return { position: { x: 0, y: 0 }, label: overrides.id, data: {}, ...overrides };
}

function edge(overrides: Partial<WorkflowEdge> & Pick<WorkflowEdge, "id" | "sourceNodeId" | "targetNodeId">): WorkflowEdge {
  return { branch: null, ...overrides };
}

beforeAll(() => registerWorkflowNodes());

describe("simulateWorkflow", () => {
  it("returns invalid with the structural issues for a broken graph, and simulates nothing", async () => {
    const graph: WorkflowGraph = { nodes: [], edges: [], variables: [] };
    const result = await simulateWorkflow({ graph, workspaceId: "ws_1" });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.paths).toEqual([]);
    expect(result.memoryPreview).toBeNull();
  });

  it("simulates a linear Trigger -> Action -> End graph as one path with one step per node", async () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-accepted" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-notification" }),
        node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
      ],
      variables: [],
    };

    const result = await simulateWorkflow({ graph, workspaceId: "ws_1" });
    expect(result.valid).toBe(true);
    expect(result.paths).toHaveLength(1);
    // Paths start at the Trigger, not Start — mirrors the real Compiler's own `CompiledPath.pathNodeIds`, which never includes the Start node either (an Automation has no "start" step, only a trigger).
    expect(result.paths[0].steps.map((step) => step.kind)).toEqual(["trigger", "action", "end"]);
    expect(result.paths[0].actionCount).toBe(1);
    expect(result.nodeCount).toBe(4);
    expect(result.triggerCount).toBe(1);
  });

  it("simulates both branches of a Condition node as two separate paths, each carrying its own branch label", async () => {
    const graph: WorkflowGraph = {
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

    const result = await simulateWorkflow({ graph, workspaceId: "ws_1" });
    expect(result.valid).toBe(true);
    expect(result.paths).toHaveLength(2);
    const branches = result.paths.map((path) => path.steps.find((step) => step.nodeId === "n4" || step.nodeId === "n5")?.branch);
    expect(branches.sort()).toEqual(["false", "true"]);
    const conditionStep = result.paths[0].steps.find((step) => step.nodeId === "n3");
    expect(conditionStep?.preview).toContain("daysOverdue");
  });

  it("never produces a path for a Trigger unreachable from Start", async () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-accepted" }),
        node({ id: "n3", kind: "end", nodeTypeId: "control.end" }),
        // n4 is a second, disconnected Trigger — not reachable from n1.
        node({ id: "n4", kind: "trigger", nodeTypeId: "trigger.invoice-paid" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
      ],
      variables: [],
    };

    const result = await simulateWorkflow({ graph, workspaceId: "ws_1" });
    // A second Start-unreachable node makes the graph itself invalid (unreachable_node) — simulation must refuse just like the Compiler does.
    expect(result.valid).toBe(false);
  });

  it("surfaces a read-only Memory preview only when a path touches a Memory-related node", async () => {
    const withoutMemory: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-accepted" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-notification" }),
        node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
      ],
      variables: [],
    };
    const withoutResult = await simulateWorkflow({ graph: withoutMemory, workspaceId: "ws_1" });
    expect(withoutResult.memoryPreview).toBeNull();

    const withMemory: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-accepted" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-memory" }),
        node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
      ],
      variables: [],
    };
    const withResult = await simulateWorkflow({ graph: withMemory, workspaceId: "ws_1" });
    expect(withResult.memoryPreview).not.toBeNull();
    expect(withResult.memoryPreview).toEqual({ approvedCount: expect.any(Number), pendingCount: expect.any(Number) });
  });
});
