import { describe, expect, it } from "vitest";
import { toReactFlowNode, toReactFlowEdge, toReactFlowGraph, fromReactFlowNode, fromReactFlowEdge, WORKFLOW_NODE_RENDER_TYPE, WORKFLOW_EDGE_RENDER_TYPE } from "@/modules/workflow/canvas/graphAdapters";
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/types/workflow";

function stubNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return { id: "n1", kind: "action", nodeTypeId: "action.create-task", position: { x: 10, y: 20 }, label: "Create Task", data: { foo: "bar" }, ...overrides };
}

function stubEdge(overrides: Partial<WorkflowEdge> = {}): WorkflowEdge {
  return { id: "e1", sourceNodeId: "n1", targetNodeId: "n2", branch: null, ...overrides };
}

describe("toReactFlowNode / fromReactFlowNode", () => {
  it("round-trips a WorkflowNode through the React Flow shape unchanged", () => {
    const node = stubNode();
    const rfNode = toReactFlowNode(node, false);
    expect(rfNode.type).toBe(WORKFLOW_NODE_RENDER_TYPE);
    expect(rfNode.position).toEqual(node.position);
    expect(fromReactFlowNode(rfNode)).toEqual(node);
  });

  it("carries the selected flag through to the React Flow node", () => {
    expect(toReactFlowNode(stubNode(), true).selected).toBe(true);
    expect(toReactFlowNode(stubNode(), false).selected).toBe(false);
  });
});

describe("toReactFlowEdge / fromReactFlowEdge", () => {
  it("round-trips a plain (non-branching) WorkflowEdge unchanged", () => {
    const edge = stubEdge();
    const rfEdge = toReactFlowEdge(edge, false);
    expect(rfEdge.type).toBe(WORKFLOW_EDGE_RENDER_TYPE);
    expect(rfEdge.source).toBe(edge.sourceNodeId);
    expect(rfEdge.target).toBe(edge.targetNodeId);
    expect(fromReactFlowEdge(rfEdge)).toEqual(edge);
  });

  it("round-trips a branching edge, carrying branch through sourceHandle", () => {
    const edge = stubEdge({ branch: "true" });
    const rfEdge = toReactFlowEdge(edge, false);
    expect(rfEdge.sourceHandle).toBe("true");
    expect(fromReactFlowEdge(rfEdge)).toEqual(edge);
  });

  it("labels a branching edge with its own uppercased branch name", () => {
    expect(toReactFlowEdge(stubEdge({ branch: "false" }), false).label).toBe("FALSE");
    expect(toReactFlowEdge(stubEdge({ branch: null }), false).label).toBeUndefined();
  });
});

describe("toReactFlowGraph", () => {
  it("converts every node and edge, marking only the selected ids", () => {
    const graph: WorkflowGraph = { nodes: [stubNode({ id: "n1" }), stubNode({ id: "n2" })], edges: [stubEdge({ id: "e1" })], variables: [] };
    const result = toReactFlowGraph(graph, new Set(["n1"]), new Set(["e1"]));
    expect(result.nodes.find((node) => node.id === "n1")?.selected).toBe(true);
    expect(result.nodes.find((node) => node.id === "n2")?.selected).toBe(false);
    expect(result.edges[0].selected).toBe(true);
  });
});
