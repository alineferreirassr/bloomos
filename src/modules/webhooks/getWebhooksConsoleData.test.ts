import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getWebhooksConsoleData } from "@/modules/webhooks/getWebhooksConsoleData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetWebhookEndpointStore } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { resetWebhookDeliveryStore } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { WEBHOOK_EVENT_TYPES } from "@/types/webhookEvent";

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
  resetWebhookEndpointStore();
  resetWebhookDeliveryStore();
});

describe("getWebhooksConsoleData", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getWebhooksConsoleData();
    expect(result.success).toBe(false);
  });

  it("requires workspace.manage even for an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await getWebhooksConsoleData();
    expect(result.success).toBe(false);
  });

  it("returns empty endpoints/deliveries with a zeroed summary and the full 17-event catalog on first load", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getWebhooksConsoleData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endpoints).toEqual([]);
      expect(result.data.deliveries).toEqual([]);
      expect(result.data.summary.totalDeliveries).toBe(0);
      expect(result.data.catalog).toHaveLength(WEBHOOK_EVENT_TYPES.length);
    }
  });
});
