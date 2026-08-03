import { afterEach, describe, expect, it } from "vitest";
import { listWorkflowNodesForWorkspace } from "@/core/workflow/nodeDiscovery";
import { registerWorkflowNode, resetWorkflowNodeRegistry } from "@/core/workflow/nodeRegistry";
import { getCoreFeatureFlagsService } from "@/core/featureFlags";
import { resetFeatureFlagsStore } from "@/lib/data/core/featureFlags/mockRepository";
import type { WorkflowNodeDefinition } from "@/types/workflow";

function stubNode(overrides: Partial<WorkflowNodeDefinition> = {}): WorkflowNodeDefinition {
  return {
    id: "stub.node",
    kind: "action",
    category: "action",
    name: "Stub Node",
    description: "A minimal node type for discovery tests.",
    icon: "Play",
    color: "neutral",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    compileTarget: "stub-target",
    ...overrides,
  };
}

afterEach(() => {
  resetWorkflowNodeRegistry();
  resetFeatureFlagsStore();
});

describe("listWorkflowNodesForWorkspace", () => {
  it("excludes a node type the member lacks a required permission for", async () => {
    registerWorkflowNode(stubNode({ id: "gated", requiredPermissions: ["events.update"] }));
    const results = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results).toEqual([]);
  });

  it("includes a node type once every required permission is present", async () => {
    registerWorkflowNode(stubNode({ id: "gated", requiredPermissions: ["events.update"] }));
    const results = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: ["events.update"], role: "owner" });
    expect(results.map((node) => node.id)).toEqual(["gated"]);
  });

  it("excludes a node type when role is below minimumRole, or unset entirely", async () => {
    registerWorkflowNode(stubNode({ id: "role-gated", minimumRole: "manager" }));
    const belowMinimum = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: "staff" });
    const noRole = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: null });
    expect(belowMinimum).toEqual([]);
    expect(noRole).toEqual([]);
  });

  it("includes a node type once role meets minimumRole", async () => {
    registerWorkflowNode(stubNode({ id: "role-gated", minimumRole: "manager" }));
    const results = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results.map((node) => node.id)).toEqual(["role-gated"]);
  });

  it("excludes a node type whose feature flag is disabled for this Workspace, includes it once enabled", async () => {
    registerWorkflowNode(stubNode({ id: "flagged", featureFlag: "new-node" }));
    const before = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(before).toEqual([]);

    await getCoreFeatureFlagsService().setFeatureFlag("ws_1", "new-node", true);
    const after = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(after.map((node) => node.id)).toEqual(["flagged"]);
  });

  it("sorts results alphabetically by name for a stable Node Library order", async () => {
    registerWorkflowNode(stubNode({ id: "z", name: "Zed Node" }));
    registerWorkflowNode(stubNode({ id: "a", name: "Alpha Node" }));
    const results = await listWorkflowNodesForWorkspace({ workspaceId: "ws_1", permissions: [], role: "owner" });
    expect(results.map((node) => node.name)).toEqual(["Alpha Node", "Zed Node"]);
  });
});
