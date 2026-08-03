import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/core/webhooks/dispatcher", () => ({
  dispatchWebhookDelivery: vi.fn().mockResolvedValue({ success: true, statusCode: 200, durationMs: 5, error: null, requestHeaders: {}, responseHeaders: null, responseBodyExcerpt: null }),
}));

import { listWebhookDeliveriesAction, replayWebhookDeliveryAction } from "@/modules/webhooks/manageWebhookDeliveriesActions";
import { createWebhookEndpointAction, testWebhookEndpointDeliveryAction } from "@/modules/webhooks/manageWebhookEndpointsActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { dispatchWebhookDelivery } from "@/core/webhooks/dispatcher";
import { resetWebhookEndpointStore } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { resetWebhookDeliveryStore, listWebhookDeliveriesForWorkspace } from "@/lib/data/core/webhooks/webhookDeliveryStore";

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

async function seedOneDelivery() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  const created = await createWebhookEndpointAction({ url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
  if (!created.success) throw new Error("setup failed");
  await testWebhookEndpointDeliveryAction(created.data.endpoint.id);
  const [delivery] = listWebhookDeliveriesForWorkspace("ws_1");
  return delivery;
}

describe("listWebhookDeliveriesAction", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await listWebhookDeliveriesAction();
    expect(result.success).toBe(false);
  });

  it("lists the session's own workspace deliveries", async () => {
    await seedOneDelivery();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await listWebhookDeliveriesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("replayWebhookDeliveryAction", () => {
  it("requires workspace.manage", async () => {
    const delivery = await seedOneDelivery();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await replayWebhookDeliveryAction(delivery.id);
    expect(result.success).toBe(false);
  });

  it("refuses a delivery belonging to a different workspace", async () => {
    const delivery = await seedOneDelivery();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, workspace: { id: "ws_other", name: "Other" } });
    const result = await replayWebhookDeliveryAction(delivery.id);
    expect(result.success).toBe(false);
  });

  it("creates a new delivery record linked back to the original, resending the exact original request_body", async () => {
    const original = await seedOneDelivery();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(dispatchWebhookDelivery).mockClear();

    const result = await replayWebhookDeliveryAction(original.id);
    expect(result.success).toBe(true);

    const deliveries = listWebhookDeliveriesForWorkspace("ws_1");
    const replay = deliveries.find((d) => d.replayed_from_delivery_id === original.id);
    expect(replay).toBeTruthy();
    expect(replay?.request_body).toBe(original.request_body);
    expect(replay?.id).not.toBe(original.id);

    // the original record is never mutated by a replay
    const stillOriginal = deliveries.find((d) => d.id === original.id);
    expect(stillOriginal?.replayed_from_delivery_id).toBeNull();
  });
});
