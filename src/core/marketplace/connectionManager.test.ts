import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConnectorAlreadyInstalledError,
  ConnectorConfigValidationError,
  UnknownConnectorError,
  checkConnectorHealth,
  disableConnector,
  enableConnector,
  installConnector,
  reconnectConnector,
  refreshConnectorHealth,
  uninstallConnector,
} from "@/core/marketplace/connectionManager";
import { registerConnector, resetConnectorRegistry } from "@/core/marketplace/connectorRegistry";
import { getApiKeyById, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { recordApiRequestLog, resetApiUsageStore } from "@/lib/data/core/api/apiUsageStore";
import { getConnectorInstallationById, resetConnectorInstallationStore } from "@/lib/data/core/marketplace/connectorInstallationStore";
import type { ConnectorDefinition } from "@/types/connector";

const WORKSPACE_ID = "ws_1";
const MEMBER_ID = "member_1";

const TEST_CONNECTOR: ConnectorDefinition = {
  id: "test-connector",
  name: "Test Connector",
  category: "communication",
  icon: "Hash",
  version: 1,
  status: "available",
  description: "A test connector.",
  requiredPermission: "workspace.manage",
  configSchema: [{ key: "webhookUrl", label: "Webhook URL", type: "url", required: true }],
  requiredApiScopes: ["crm.read", "finance.read"],
  subscribedWebhookEvents: [],
};

beforeEach(() => {
  resetConnectorRegistry();
  registerConnector(TEST_CONNECTOR);
});

afterEach(() => {
  resetConnectorInstallationStore();
  resetApiKeyStore();
  resetApiUsageStore();
  resetConnectorRegistry();
});

describe("installConnector", () => {
  it("provisions a real API Key scoped to exactly the connector's requiredApiScopes", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    expect(installation.api_key_id).not.toBeNull();
    const apiKey = getApiKeyById(installation.api_key_id!);
    expect(apiKey?.scopes).toEqual(["crm.read", "finance.read"]);
    expect(apiKey?.workspace_id).toBe(WORKSPACE_ID);
  });

  it("resolves health to connected immediately (no real OAuth handshake)", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    expect(installation.health_status).toBe("connected");
    expect(installation.enabled).toBe(true);
  });

  it("throws UnknownConnectorError for an unregistered connector id", async () => {
    await expect(installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "does-not-exist", config: {} })).rejects.toBeInstanceOf(UnknownConnectorError);
  });

  it("throws ConnectorConfigValidationError when a required config field is missing", async () => {
    await expect(installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: {} })).rejects.toBeInstanceOf(ConnectorConfigValidationError);
  });

  it("throws ConnectorAlreadyInstalledError when an existing installation is passed", async () => {
    const existing = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    await expect(
      installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" }, existingInstallation: existing }),
    ).rejects.toBeInstanceOf(ConnectorAlreadyInstalledError);
  });
});

describe("enable / disable / reconnect / uninstall", () => {
  it("disableConnector sets enabled=false and health=disconnected", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    const disabled = disableConnector(installation.id);
    expect(disabled?.enabled).toBe(false);
    expect(disabled?.health_status).toBe("disconnected");
  });

  it("enableConnector re-enables and re-derives health", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    disableConnector(installation.id);
    const enabled = enableConnector(installation.id);
    expect(enabled?.enabled).toBe(true);
    expect(enabled?.health_status).toBe("connected");
  });

  it("reconnectConnector increments reconnect_count and resolves to connected", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    const reconnected = reconnectConnector(installation.id);
    expect(reconnected?.reconnect_count).toBe(1);
    expect(reconnected?.health_status).toBe("connected");
    expect(reconnected?.last_sync_at).not.toBeNull();
  });

  it("uninstallConnector revokes the connector's own API Key and removes the installation", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    const apiKeyId = installation.api_key_id!;
    expect(uninstallConnector(installation.id)).toBe(true);
    expect(getConnectorInstallationById(installation.id)).toBeNull();
    expect(getApiKeyById(apiKeyId)?.revoked_at).not.toBeNull();
  });

  it("uninstallConnector returns false for an unknown installation", () => {
    expect(uninstallConnector("nope")).toBe(false);
  });
});

describe("checkConnectorHealth", () => {
  it("returns disconnected when the installation is disabled", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    const disabled = disableConnector(installation.id)!;
    expect(checkConnectorHealth(disabled)).toBe("disconnected");
  });

  it("returns error when the underlying API Key has been revoked out from under it", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    const apiKeyId = installation.api_key_id!;
    const { revokeApiKey } = await import("@/lib/data/core/api/apiKeyStore");
    revokeApiKey(apiKeyId);
    expect(checkConnectorHealth(installation)).toBe("error");
  });

  it("returns rate_limited when the API Key's recent request volume exceeds the threshold", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    for (let i = 0; i < 51; i += 1) {
      recordApiRequestLog({ workspace_id: WORKSPACE_ID, api_key_id: installation.api_key_id, method: "GET", path: "/api/v1/clients", status_code: 200, duration_ms: 10 });
    }
    expect(checkConnectorHealth(installation)).toBe("rate_limited");
  });

  it("returns connected for a healthy, enabled, unrevoked, low-traffic installation", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    expect(checkConnectorHealth(installation)).toBe("connected");
  });
});

describe("refreshConnectorHealth", () => {
  it("persists a re-derived health status", async () => {
    const installation = await installConnector({ workspaceId: WORKSPACE_ID, installedBy: MEMBER_ID, connectorId: "test-connector", config: { webhookUrl: "https://example.com" } });
    const { revokeApiKey } = await import("@/lib/data/core/api/apiKeyStore");
    revokeApiKey(installation.api_key_id!);
    const refreshed = refreshConnectorHealth(installation.id);
    expect(refreshed?.health_status).toBe("error");
    expect(getConnectorInstallationById(installation.id)?.health_status).toBe("error");
  });

  it("returns null for an unknown installation", () => {
    expect(refreshConnectorHealth("nope")).toBeNull();
  });
});
