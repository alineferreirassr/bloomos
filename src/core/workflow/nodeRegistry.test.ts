import { afterEach, describe, expect, it } from "vitest";
import { registerWorkflowNode, unregisterWorkflowNode, getWorkflowNode, listWorkflowNodes, listWorkflowNodesByCategory, resetWorkflowNodeRegistry } from "@/core/workflow/nodeRegistry";
import type { WorkflowNodeDefinition } from "@/types/workflow";

function stubNode(overrides: Partial<WorkflowNodeDefinition> = {}): WorkflowNodeDefinition {
  return {
    id: "stub.node",
    kind: "action",
    category: "action",
    name: "Stub Node",
    description: "A minimal node type for registry tests.",
    icon: "Play",
    color: "neutral",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    compileTarget: "stub-target",
    ...overrides,
  };
}

describe("Node Registry", () => {
  afterEach(() => resetWorkflowNodeRegistry());

  it("registers and retrieves a node type by id", () => {
    registerWorkflowNode(stubNode());
    expect(getWorkflowNode("stub.node")?.name).toBe("Stub Node");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getWorkflowNode("missing")).toBeUndefined();
  });

  it("replaces an existing entry when registered again under the same id", () => {
    registerWorkflowNode(stubNode({ name: "First" }));
    registerWorkflowNode(stubNode({ name: "Second" }));
    expect(listWorkflowNodes()).toHaveLength(1);
    expect(getWorkflowNode("stub.node")?.name).toBe("Second");
  });

  it("removes a node type on unregister", () => {
    registerWorkflowNode(stubNode());
    unregisterWorkflowNode("stub.node");
    expect(getWorkflowNode("stub.node")).toBeUndefined();
  });

  it("unregistering an unknown id is a no-op", () => {
    expect(() => unregisterWorkflowNode("ghost")).not.toThrow();
  });

  it("lists every registered node type", () => {
    registerWorkflowNode(stubNode({ id: "a" }));
    registerWorkflowNode(stubNode({ id: "b" }));
    expect(listWorkflowNodes().map((node) => node.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category", () => {
    registerWorkflowNode(stubNode({ id: "a", category: "action" }));
    registerWorkflowNode(stubNode({ id: "b", category: "trigger" }));
    registerWorkflowNode(stubNode({ id: "c", category: "action" }));
    expect(listWorkflowNodesByCategory("action").map((node) => node.id).sort()).toEqual(["a", "c"]);
    expect(listWorkflowNodesByCategory("approval")).toEqual([]);
  });

  it("resets to empty", () => {
    registerWorkflowNode(stubNode());
    resetWorkflowNodeRegistry();
    expect(listWorkflowNodes()).toEqual([]);
  });

  it("Step 17 Developer Experience: a new node type needs only a WorkflowNodeDefinition object and one registerWorkflowNode() call", () => {
    registerWorkflowNode(stubNode({ id: "brand-new.node", name: "Brand New Node" }));
    expect(getWorkflowNode("brand-new.node")?.name).toBe("Brand New Node");
  });
});
