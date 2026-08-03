import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { cloneWorkflow } from "@/modules/workflow/cloneWorkflow";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import { resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

async function createTestWorkflow(workspaceId = "ws_1") {
  const result = await getWorkflowManager().createWorkflow(workspaceId, "user_1", {
    metadata: { name: "Test Workflow", description: "", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph: { nodes: [], edges: [], variables: [] },
  });
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

afterEach(() => {
  vi.clearAllMocks();
  resetWorkflowStore();
});

describe("cloneWorkflow", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await cloneWorkflow("wf_1");
    expect(result.success).toBe(false);
  });

  it("requires the elevated workspace.manage permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const workflow = await createTestWorkflow();
    const result = await cloneWorkflow(workflow.id);
    expect(result.success).toBe(false);
  });

  it("fails for a Workflow belonging to a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow("ws_other");
    const result = await cloneWorkflow(workflow.id);
    expect(result.success).toBe(false);
  });

  it("clones a Workflow the member owns into a new draft", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow();
    const result = await cloneWorkflow(workflow.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).not.toBe(workflow.id);
      expect(result.data.status).toBe("draft");
    }
  });
});
