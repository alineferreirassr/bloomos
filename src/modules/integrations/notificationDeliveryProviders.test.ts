import { afterEach, describe, expect, it, vi } from "vitest";
import { registerIntegrationNotificationProviders, resetIntegrationNotificationProvidersRegistration } from "@/modules/integrations/notificationDeliveryProviders";
import { getNotificationProvider, isChannelConfigured } from "@/core/notifications/registry";
import { installProvider, applyConnectionEvent } from "@/core/integrations/integrationManager";
import { issueOAuthCredential } from "@/core/integrations/credentialManager";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";

vi.mock("@/lib/data", () => ({
  getWorkspaceMemberById: vi.fn(),
  getClientAccountById: vi.fn(),
}));

const { getWorkspaceMemberById, getClientAccountById } = await import("@/lib/data");

afterEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetIntegrationNotificationProvidersRegistration();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("registerIntegrationNotificationProviders", () => {
  it("registers a real email provider, so isChannelConfigured('email') reports true", () => {
    registerIntegrationNotificationProviders();
    expect(isChannelConfigured("email")).toBe(true);
  });

  it("still reports sms as unconfigured — TeamMember has no phone field to deliver to", () => {
    registerIntegrationNotificationProviders();
    expect(isChannelConfigured("sms")).toBe(false);
  });

  it("fails honestly when the recipient's workspace has no connected Gmail account", async () => {
    registerIntegrationNotificationProviders();
    vi.mocked(getWorkspaceMemberById).mockResolvedValue({ id: "m1", workspace_id: "ws_1", user_id: "u1", role: "member", status: "active", full_name: "Jordan", email: "jordan@example.com", avatar_url: null, created_at: "", updated_at: "" } as never);

    const provider = getNotificationProvider("email");
    const result = await provider?.send({ recipientMemberId: "m1", title: "Hello", body: "Body" });
    expect(result?.success).toBe(false);
  });

  it("sends a real email through the workspace's connected Gmail account", async () => {
    registerBuiltinProviders();
    registerIntegrationNotificationProviders();
    vi.mocked(getWorkspaceMemberById).mockResolvedValue({ id: "m1", workspace_id: "ws_1", user_id: "u1", role: "member", status: "active", full_name: "Jordan", email: "jordan@example.com", avatar_url: null, created_at: "", updated_at: "" } as never);

    const connection = await installProvider({ workspaceId: "ws_1", providerId: "gmail", installedBy: "m1" });
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: connection.id, scopes: [], createdBy: "m1", accessToken: "tok_123" });
    const { attachCredential } = await import("@/core/integrations/integrationManager");
    attachCredential(connection.id, credential.id);
    await applyConnectionEvent(connection.id, "connect_requested", "m1");
    await applyConnectionEvent(connection.id, "connect_succeeded", "m1");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 })),
    );

    const provider = getNotificationProvider("email");
    const result = await provider?.send({ recipientMemberId: "m1", title: "Hello", body: "Body" });
    expect(result?.success).toBe(true);
  });

  it("resolves a Client Account recipient instead of a TeamMember when recipientClientAccountId is set", async () => {
    registerBuiltinProviders();
    registerIntegrationNotificationProviders();
    vi.mocked(getClientAccountById).mockResolvedValue({ id: "ca_1", workspace_id: "ws_1", client_id: "client_1", auth_user_id: "u1", email: "alex@example.com", status: "active", invited_by: "m1", created_at: "", updated_at: "" } as never);

    const connection = await installProvider({ workspaceId: "ws_1", providerId: "gmail", installedBy: "m1" });
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: connection.id, scopes: [], createdBy: "m1", accessToken: "tok_123" });
    const { attachCredential } = await import("@/core/integrations/integrationManager");
    attachCredential(connection.id, credential.id);
    await applyConnectionEvent(connection.id, "connect_requested", "m1");
    await applyConnectionEvent(connection.id, "connect_succeeded", "m1");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 })),
    );

    const provider = getNotificationProvider("email");
    const result = await provider?.send({ recipientClientAccountId: "ca_1", title: "Hello", body: "Body" });
    expect(result?.success).toBe(true);
    expect(getWorkspaceMemberById).not.toHaveBeenCalled();
  });

  it("fails honestly when neither recipient field is set", async () => {
    registerIntegrationNotificationProviders();
    const provider = getNotificationProvider("email");
    const result = await provider?.send({ title: "Hello", body: "Body" });
    expect(result?.success).toBe(false);
  });
});
