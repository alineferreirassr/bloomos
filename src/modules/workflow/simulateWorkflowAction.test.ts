import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { simulateWorkflowAction } from "@/modules/workflow/simulateWorkflowAction";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import { resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";
import { listWorkflowSimulationRuns, resetWorkflowSimulationStore } from "@/lib/data/core/workflow/simulationStore";
import type { WorkflowGraph } from "@/types/workflow";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function validGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: "n1", kind: "start", nodeTypeId: "control.start", position: { x: 0, y: 0 }, label: "Start", data: {} },
      { id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected", position: { x: 0, y: 0 }, label: "trig", data: {} },
      { id: "n3", kind: "action", nodeTypeId: "action.create-task", position: { x: 0, y: 0 }, label: "act", data: {} },
      { id: "n4", kind: "end", nodeTypeId: "control.end", position: { x: 0, y: 0 }, label: "End", data: {} },
    ],
    edges: [
      { id: "e1", sourceNodeId: "n1", targetNodeId: "n2", branch: null },
      { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", branch: null },
      { id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: null },
    ],
    variables: [],
  };
}

async function createTestWorkflow(graph: WorkflowGraph = validGraph(), workspaceId = "ws_1") {
  const result = await getWorkflowManager().createWorkflow(workspaceId, "user_1", {
    metadata: { name: "Test Workflow", description: "", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph,
  });
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

afterEach(() => {
  vi.clearAllMocks();
  resetWorkflowStore();
  resetWorkflowSimulationStore();
});

describe("simulateWorkflowAction", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await simulateWorkflowAction("wf_1", validGraph());
    expect(result.success).toBe(false);
  });

  it("fails for a Workflow belonging to a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow(validGraph(), "ws_other");
    const result = await simulateWorkflowAction(workflow.id, validGraph());
    expect(result.success).toBe(false);
  });

  it("simulates the *passed-in* graph, not necessarily the persisted one — live, unsaved edits included", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow();

    const editedGraph: WorkflowGraph = {
      ...validGraph(),
      nodes: [
        ...validGraph().nodes,
        { id: "n5", kind: "action", nodeTypeId: "action.create-notification", position: { x: 0, y: 0 }, label: "extra", data: {} },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", targetNodeId: "n2", branch: null },
        { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", branch: null },
        { id: "e3", sourceNodeId: "n3", targetNodeId: "n5", branch: null },
        { id: "e4", sourceNodeId: "n5", targetNodeId: "n4", branch: null },
      ],
    };

    const result = await simulateWorkflowAction(workflow.id, editedGraph);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(true);
      expect(result.data.paths[0].actionCount).toBe(2);
    }
  });

  it("returns valid: false with structural issues for a broken graph, without throwing", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow();
    const result = await simulateWorkflowAction(workflow.id, { nodes: [], edges: [], variables: [] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(false);
      expect(result.data.issues.length).toBeGreaterThan(0);
    }
  });

  it("Checkpoint 15: records a real, persisted Simulation run — Workflow Analytics' own Simulation usage metric reads from this", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow();
    const result = await simulateWorkflowAction(workflow.id, validGraph());
    expect(result.success).toBe(true);
    if (result.success) {
      const [run] = listWorkflowSimulationRuns("ws_1");
      expect(run).toMatchObject({ workspace_id: "ws_1", workflow_id: workflow.id, path_count: result.data.paths.length, issue_count: result.data.issues.length });
    }
  });
});
