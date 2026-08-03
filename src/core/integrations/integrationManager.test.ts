import { beforeEach, describe, expect, it } from "vitest";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { registerProvider, resetProviderRegistry } from "@/core/integrations/providerRegistry";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { issueApiKeyCredential, resetEncryptionProvider } from "@/core/integrations/credentialManager";
import {
  applyConnectionEvent,
  attachCredential,
  getConnection,
  getConnectionHealth,
  getConnectionHistory,
  installProvider,
  listAvailableActions,
  listConnections,
  uninstallConnection,
} from "@/core/integrations/integrationManager";
import type { ProviderDefinition } from "@/core/integrations/types";

const provider: ProviderDefinition = {
  id: "test-provider",
  name: "Test Provider",
  category: "crm",
  icon: "Star",
  version: 1,
  capabilities: ["oauth"],
  description: "test",
  requiredPermission: "workspace.manage",
  requiredApiScopes: [],
  subscribedWebhookEvents: [],
};

beforeEach(() => {
  resetConnectionStore();
  resetProviderRegistry();
  resetCredentialStore();
  resetEncryptionProvider();
  registerProvider(provider);
});

describe("installProvider", () => {
  it("creates a disconnected connection carrying the provider's own capabilities/version", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    expect(connection.state).toBe("disconnected");
    expect(connection.capabilities).toEqual(["oauth"]);
    expect(connection.version).toBe(1);
    expect(listConnections("ws_1")).toHaveLength(1);
  });

  it("throws for an unregistered provider", async () => {
    await expect(installProvider({ workspaceId: "ws_1", providerId: "missing", installedBy: "user_1" })).rejects.toThrow(/No provider is registered/);
  });
});

describe("applyConnectionEvent", () => {
  it("walks disconnected -> connecting -> connected, recording a transition each time", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    const step1 = await applyConnectionEvent(connection.id, "connect_requested", "user_1");
    expect(step1.connection.state).toBe("connecting");
    const step2 = await applyConnectionEvent(connection.id, "connect_succeeded", "user_1");
    expect(step2.connection.state).toBe("connected");
    expect(getConnectionHistory(connection.id)).toHaveLength(2);
  });

  it("rejects an event the state machine doesn't allow from the current state", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    await expect(applyConnectionEvent(connection.id, "connect_succeeded", "user_1")).rejects.toThrow(/not valid from state/);
  });

  it("tracks failure_count across connect_failed and resets it on connect_succeeded", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    await applyConnectionEvent(connection.id, "connect_requested", "user_1");
    const failed = await applyConnectionEvent(connection.id, "connect_failed", "user_1");
    expect(failed.connection.failure_count).toBe(1);
    expect(failed.connection.state).toBe("failed");

    await applyConnectionEvent(connection.id, "reconnect_requested", "user_1");
    const recovered = await applyConnectionEvent(connection.id, "connect_succeeded", "user_1");
    expect(recovered.connection.failure_count).toBe(0);
  });
});

describe("listAvailableActions", () => {
  it("returns the exact events the state machine allows from the connection's current state", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    const actions = listAvailableActions(connection.id);
    expect(actions).toContain("connect_requested");
    expect(actions).not.toContain("connect_succeeded");
    expect(actions).not.toContain("disable_requested");
  });
});

describe("attachCredential / getConnectionHealth", () => {
  it("computes a health snapshot reflecting the connection's own state and attached credential", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    const { credential } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: connection.id, scopes: [], createdBy: "user_1" });
    attachCredential(connection.id, credential.id);
    await applyConnectionEvent(connection.id, "connect_requested", "user_1");
    await applyConnectionEvent(connection.id, "connect_succeeded", "user_1");

    const health = getConnectionHealth(connection.id);
    expect(health?.state).toBe("connected");
    expect(health?.connection_id).toBe(connection.id);
  });
});

describe("uninstallConnection", () => {
  it("removes the connection and revokes its credential", async () => {
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "test-provider", installedBy: "user_1" });
    const { credential } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: connection.id, scopes: [], createdBy: "user_1" });
    attachCredential(connection.id, credential.id);

    const removed = await uninstallConnection(connection.id, "user_1");
    expect(removed).toBe(true);
    expect(getConnection(connection.id)).toBeNull();
  });
});
