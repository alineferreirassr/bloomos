import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getDeveloperConsoleData } from "@/modules/api/getDeveloperConsoleData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { resetApiUsageStore } from "@/lib/data/core/api/apiUsageStore";

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
  resetApiKeyStore();
  resetApiUsageStore();
});

describe("getDeveloperConsoleData", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getDeveloperConsoleData();
    expect(result.success).toBe(false);
  });

  it("requires workspace.manage even for an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await getDeveloperConsoleData();
    expect(result.success).toBe(false);
  });

  it("seeds the demo key and returns it alongside a zeroed usage summary on first load", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getDeveloperConsoleData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiKeys.some((k) => k.name === "Demo Integration")).toBe(true);
      expect(result.data.usage.totalRequests).toBe(0);
    }
  });
});
