import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getMarketplaceData } from "@/modules/marketplace/getMarketplaceData";
import { installConnectorAction } from "@/modules/marketplace/manageConnectorInstallationsActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetConnectorInstallationStore } from "@/lib/data/core/marketplace/connectorInstallationStore";
import { resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { resetApiUsageStore } from "@/lib/data/core/api/apiUsageStore";
import { resetWebhookDeliveryStore } from "@/lib/data/core/webhooks/webhookDeliveryStore";

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
  resetConnectorInstallationStore();
  resetApiKeyStore();
  resetApiUsageStore();
  resetWebhookDeliveryStore();
});

describe("getMarketplaceData", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await getMarketplaceData();
    expect(result.success).toBe(false);
  });

  it("returns the full built-in catalog and an empty install/observability state before any install", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getMarketplaceData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.catalog).toHaveLength(12);
    expect(result.data.installations).toHaveLength(0);
    expect(result.data.observability.installationCount).toBe(0);
    expect(result.data.observability.byHealth.connected).toBe(0);
  });

  it("reflects a real installation, with health re-derived fresh on every load", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const installed = await installConnectorAction("slack", { webhookUrl: "https://hooks.example.com/x" });
    if (!installed.success) throw new Error("setup failed");

    const result = await getMarketplaceData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.installations).toHaveLength(1);
    expect(result.data.installations[0].connector_id).toBe("slack");
    expect(result.data.observability.installationCount).toBe(1);
    expect(result.data.observability.byHealth.connected).toBe(1);
    expect(result.data.observability.failureCount).toBe(0);
  });

  it("composes real Checkpoint 16/17 usage summaries rather than reinventing them", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getMarketplaceData();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.observability.apiUsage).toHaveProperty("totalRequests");
    expect(result.data.observability.webhookUsage).toHaveProperty("totalDeliveries");
  });
});
