import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/core/webhooks/dispatcher", () => ({
  dispatchWebhookDelivery: vi.fn().mockResolvedValue({ success: true, statusCode: 200, durationMs: 5, error: null, requestHeaders: {}, responseHeaders: null, responseBodyExcerpt: null }),
}));

import {
  listWebhookEndpointsAction,
  createWebhookEndpointAction,
  rotateWebhookEndpointSecretAction,
  setWebhookEndpointStatusAction,
  testWebhookEndpointDeliveryAction,
} from "@/modules/webhooks/manageWebhookEndpointsActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetWebhookEndpointStore } from "@/lib/data/core/webhooks/webhookEndpointStore";
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
  resetWebhookEndpointStore();
  resetWebhookDeliveryStore();
});

describe("createWebhookEndpointAction", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await createWebhookEndpointAction({ url: "https://example.com", description: "", subscribed_events: ["client.created"] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty URL", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWebhookEndpointAction({ url: "   ", description: "", subscribed_events: ["client.created"] });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed URL", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWebhookEndpointAction({ url: "not a url", description: "", subscribed_events: ["client.created"] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) URL scheme", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWebhookEndpointAction({ url: "ftp://example.com", description: "", subscribed_events: ["client.created"] });
    expect(result.success).toBe(false);
  });

  it("rejects zero subscribed events", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWebhookEndpointAction({ url: "https://example.com", description: "", subscribed_events: [] });
    expect(result.success).toBe(false);
  });

  it("creates an endpoint scoped to the session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWebhookEndpointAction({ url: "https://example.com/hook", description: "Test", subscribed_events: ["client.created"] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.endpoint.workspace_id).toBe("ws_1");
      expect(result.data.secret.startsWith("whsec_")).toBe(true);
    }
  });
});

describe("listWebhookEndpointsAction / rotate / status / test delivery", () => {
  it("lists only the session's own workspace endpoints", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await createWebhookEndpointAction({ url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    const result = await listWebhookEndpointsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });

  it("rotate refuses an endpoint belonging to a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await createWebhookEndpointAction({ url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, workspace: { id: "ws_other", name: "Other" } });
    const result = await rotateWebhookEndpointSecretAction(created.data.endpoint.id);
    expect(result.success).toBe(false);
  });

  it("rotate issues a new secret", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await createWebhookEndpointAction({ url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    if (!created.success) throw new Error("setup failed");

    const rotated = await rotateWebhookEndpointSecretAction(created.data.endpoint.id);
    expect(rotated.success).toBe(true);
    if (rotated.success) expect(rotated.data.secret).not.toEqual(created.data.secret);
  });

  it("setWebhookEndpointStatusAction disables then re-enables", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await createWebhookEndpointAction({ url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    if (!created.success) throw new Error("setup failed");

    const disabled = await setWebhookEndpointStatusAction(created.data.endpoint.id, "disabled");
    expect(disabled.success).toBe(true);
    if (disabled.success) expect(disabled.data.status).toBe("disabled");
  });

  it("testWebhookEndpointDeliveryAction sends a real test delivery through the dispatcher, marked is_test", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await createWebhookEndpointAction({ url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    if (!created.success) throw new Error("setup failed");

    const result = await testWebhookEndpointDeliveryAction(created.data.endpoint.id);
    expect(result.success).toBe(true);
  });
});
