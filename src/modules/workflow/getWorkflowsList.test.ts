import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getWorkflowsList } from "@/modules/workflow/getWorkflowsList";
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

afterEach(() => {
  vi.clearAllMocks();
  resetWorkflowStore();
});

describe("getWorkflowsList", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getWorkflowsList();
    expect(result.success).toBe(false);
  });

  it("scopes strictly to this session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getWorkflowManager().createWorkflow("ws_1", "user_1", {
      metadata: { name: "In workspace", description: "", category: "operations", tags: [] },
      executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
      graph: { nodes: [], edges: [], variables: [] },
    });
    await getWorkflowManager().createWorkflow("ws_other", "user_1", {
      metadata: { name: "Other workspace", description: "", category: "operations", tags: [] },
      executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
      graph: { nodes: [], edges: [], variables: [] },
    });

    const result = await getWorkflowsList();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].metadata.name).toBe("In workspace");
    }
  });
});
