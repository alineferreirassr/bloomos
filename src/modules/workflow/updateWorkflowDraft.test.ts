import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { updateWorkflowDraft } from "@/modules/workflow/updateWorkflowDraft";
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

describe("updateWorkflowDraft (v2 Checkpoint 45 security fix)", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await updateWorkflowDraft("wf_1", { metadata: { name: "Renamed", description: "", category: "operations", tags: [] } });
    expect(result.success).toBe(false);
  });

  it("requires the elevated workspace.manage permission, matching every sibling mutation in this module", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const workflow = await createTestWorkflow();
    const result = await updateWorkflowDraft(workflow.id, { metadata: { name: "Renamed", description: "", category: "operations", tags: [] } });
    expect(result.success).toBe(false);
  });

  it("fails for a Workflow belonging to a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow("ws_other");
    const result = await updateWorkflowDraft(workflow.id, { metadata: { name: "Renamed", description: "", category: "operations", tags: [] } });
    expect(result.success).toBe(false);
  });

  it("updates the draft for a member with workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createTestWorkflow();
    const result = await updateWorkflowDraft(workflow.id, { metadata: { name: "Renamed", description: "", category: "operations", tags: [] } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.metadata.name).toBe("Renamed");
  });
});
