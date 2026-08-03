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

import { getWorkflowDashboardData } from "@/modules/workflow/getWorkflowDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import { resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";
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

function emptyGraph(): WorkflowGraph {
  return { nodes: [], edges: [], variables: [] };
}

async function createWorkflowWithStatus(status: "draft" | "published", graph: WorkflowGraph = emptyGraph()) {
  const manager = getWorkflowManager();
  const created = await manager.createWorkflow("ws_1", "user_1", {
    metadata: { name: `${status} workflow`, description: "", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph,
  });
  if (!created.success) throw new Error("setup failed");
  if (status === "published") {
    await manager.recordPublishedVersion(created.data.id, {
      graph,
      metadata: created.data.metadata,
      executionPolicy: created.data.executionPolicy,
      compiledAutomationIds: ["a1", "a2"],
      publishedBy: "user_1",
    });
  }
  return created.data;
}

afterEach(() => {
  vi.clearAllMocks();
  resetWorkflowStore();
});

describe("getWorkflowDashboardData", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getWorkflowDashboardData();
    expect(result.success).toBe(false);
  });

  it("computes total/published/draft counts", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await createWorkflowWithStatus("draft");
    await createWorkflowWithStatus("published");

    const result = await getWorkflowDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalWorkflows).toBe(2);
      expect(result.data.draftCount).toBe(1);
      expect(result.data.publishedCount).toBe(1);
    }
  });

  it("flags a draft Workflow with a structurally invalid graph under workflowsWithValidationErrors", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await createWorkflowWithStatus("draft", emptyGraph());

    const result = await getWorkflowDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.workflowsWithValidationErrors.length).toBeGreaterThan(0);
    }
  });

  it("reports automationUsage only for published Workflows, from their own latest version", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await createWorkflowWithStatus("draft");
    const published = await createWorkflowWithStatus("published");

    const result = await getWorkflowDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.automationUsage).toHaveLength(1);
      expect(result.data.automationUsage[0]).toMatchObject({ workflowId: published.id, automationCount: 2 });
    }
  });

  it("scopes strictly to this session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getWorkflowManager().createWorkflow("ws_other", "user_1", {
      metadata: { name: "Other workspace", description: "", category: "operations", tags: [] },
      executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
      graph: emptyGraph(),
    });

    const result = await getWorkflowDashboardData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalWorkflows).toBe(0);
  });
});
