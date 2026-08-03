import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { restoreWorkflowVersion } from "@/modules/workflow/restoreWorkflowVersion";
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

async function createPublishedWorkflow() {
  const manager = getWorkflowManager();
  const created = await manager.createWorkflow("ws_1", "user_1", {
    metadata: { name: "Test Workflow", description: "", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph: { nodes: [], edges: [], variables: [] },
  });
  if (!created.success) throw new Error("setup failed");
  await manager.recordPublishedVersion(created.data.id, {
    graph: { nodes: [], edges: [], variables: [] },
    metadata: created.data.metadata,
    executionPolicy: created.data.executionPolicy,
    compiledAutomationIds: [],
    publishedBy: "user_1",
  });
  return created.data;
}

afterEach(() => {
  vi.clearAllMocks();
  resetWorkflowStore();
});

describe("restoreWorkflowVersion", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await restoreWorkflowVersion("wf_1", 1);
    expect(result.success).toBe(false);
  });

  it("requires the elevated workspace.manage permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const workflow = await createPublishedWorkflow();
    const result = await restoreWorkflowVersion(workflow.id, 1);
    expect(result.success).toBe(false);
  });

  it("restores a real prior version onto the current draft", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createPublishedWorkflow();
    const result = await restoreWorkflowVersion(workflow.id, 1);
    expect(result.success).toBe(true);
  });

  it("fails for a version that doesn't exist", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const workflow = await createPublishedWorkflow();
    const result = await restoreWorkflowVersion(workflow.id, 99);
    expect(result.success).toBe(false);
  });
});
