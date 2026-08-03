import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getWorkflowTemplates } from "@/modules/workflow/getWorkflowTemplates";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

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
});

describe("getWorkflowTemplates", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getWorkflowTemplates();
    expect(result.success).toBe(false);
  });

  it("returns all 3 built-in Templates for an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getWorkflowTemplates();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.map((template) => template.id).sort()).toEqual([
        "template.invoice-paid-finance",
        "template.new-client-welcome",
        "template.proposal-accepted-contract",
      ]);
    }
  });
});
