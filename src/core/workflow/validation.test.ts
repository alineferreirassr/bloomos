import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { validateWorkflow } from "@/core/workflow/validation";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/types/workflow";

function node(overrides: Partial<WorkflowNode> & Pick<WorkflowNode, "id" | "kind" | "nodeTypeId">): WorkflowNode {
  return { position: { x: 0, y: 0 }, label: overrides.id, data: {}, ...overrides };
}

function edge(overrides: Partial<WorkflowEdge> & Pick<WorkflowEdge, "id" | "sourceNodeId" | "targetNodeId">): WorkflowEdge {
  return { branch: null, ...overrides };
}

function validGraphNodes(): WorkflowNode[] {
  return [
    node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
    node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
    node({ id: "n3", kind: "action", nodeTypeId: "action.create-memory" }),
    node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
  ];
}

function validGraphEdges(): WorkflowEdge[] {
  return [
    edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
    edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
    edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
  ];
}

beforeAll(() => registerWorkflowNodes());

describe("validateWorkflow", () => {
  it("a well-formed Trigger → Action → End graph is valid, with no issues", () => {
    const graph: WorkflowGraph = { nodes: validGraphNodes(), edges: validGraphEdges(), variables: [] };
    const result = validateWorkflow(graph);
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("flags missing_trigger when no Trigger node is reachable", () => {
    const graph: WorkflowGraph = {
      nodes: [node({ id: "n1", kind: "start", nodeTypeId: "control.start" }), node({ id: "n2", kind: "end", nodeTypeId: "control.end" })],
      edges: [edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" })],
      variables: [],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "missing_trigger")).toBe(true);
  });

  it("flags missing_action when no Action node is reachable", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }), edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" })],
      variables: [],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "missing_action")).toBe(true);
  });

  it("flags orphan_node for a node with no edges at all, exempting Start", () => {
    const graph: WorkflowGraph = {
      nodes: [...validGraphNodes(), node({ id: "n5", kind: "action", nodeTypeId: "action.create-task" })],
      edges: validGraphEdges(),
      variables: [],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    const orphan = result.issues.find((issue) => issue.code === "orphan_node");
    expect(orphan?.nodeId).toBe("n5");
  });

  it("does not flag a fresh Workflow's own disconnected Start node as an orphan", () => {
    const graph: WorkflowGraph = { nodes: [node({ id: "n1", kind: "start", nodeTypeId: "control.start" })], edges: [], variables: [] };
    const result = validateWorkflow(graph);
    expect(result.issues.some((issue) => issue.code === "orphan_node")).toBe(false);
  });

  it("flags duplicate_variable for two Workflow Variables sharing a key", () => {
    const graph: WorkflowGraph = {
      nodes: validGraphNodes(),
      edges: validGraphEdges(),
      variables: [
        { key: "amount", label: "Amount", type: "number", description: null },
        { key: "amount", label: "Amount Again", type: "number", description: null },
      ],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "duplicate_variable")).toBe(true);
  });

  it("flags approval_loop for an Approval node that is part of a cycle, in addition to the generic cycle_detected issue", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "approval", nodeTypeId: "approval.always-required" }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-task" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
        edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n3" }),
      ],
      variables: [],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "approval_loop" && issue.nodeId === "n3")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "cycle_detected")).toBe(true);
  });

  it("flags invalid_node_configuration for a Condition node missing its own operator/value", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.invoice-overdue" }),
        node({ id: "n3", kind: "condition", nodeTypeId: "condition.days-overdue", data: {} }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-task" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
      ],
      variables: [],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "invalid_node_configuration" && issue.nodeId === "n3")).toBe(true);
  });

  it("flags invalid_node_configuration for an Approval node missing a valid minimum role", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "approval", nodeTypeId: "approval.manager", data: {} }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-task" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
      ],
      variables: [],
    };
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "invalid_node_configuration" && issue.nodeId === "n3")).toBe(true);
  });

  it("surfaces the shared structural issues too (e.g. unreachable_node), not just its own five checks", () => {
    const graph: WorkflowGraph = {
      nodes: [...validGraphNodes(), node({ id: "n5", kind: "action", nodeTypeId: "action.create-task" })],
      edges: [...validGraphEdges(), edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n5" })],
      variables: [],
    };
    // n4 is an "end" node — per ALLOWED_TRANSITIONS it has no valid outgoing
    // edge, so e4 is itself an unsupported_transition, and n5 becomes both
    // disconnected from a *valid* edge and unreachable.
    const result = validateWorkflow(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "unsupported_transition")).toBe(true);
  });
});
