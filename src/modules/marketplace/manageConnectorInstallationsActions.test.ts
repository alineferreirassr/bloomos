import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  disableConnectorAction,
  enableConnectorAction,
  installConnectorAction,
  reconnectConnectorAction,
  uninstallConnectorAction,
} from "@/modules/marketplace/manageConnectorInstallationsActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerConnector, resetConnectorRegistry } from "@/core/marketplace/connectorRegistry";
import { resetConnectorInstallationStore } from "@/lib/data/core/marketplace/connectorInstallationStore";
import { resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import type { ConnectorDefinition } from "@/types/connector";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const TEST_CONNECTOR: ConnectorDefinition = {
  id: "test-connector",
  name: "Test Connector",
  category: "communication",
  icon: "Hash",
  version: 1,
  status: "available",
  description: "A test connector.",
  requiredPermission: "workspace.manage",
  configSchema: [],
  requiredApiScopes: ["crm.read"],
  subscribedWebhookEvents: [],
};

const COMING_SOON_CONNECTOR: ConnectorDefinition = { ...TEST_CONNECTOR, id: "coming-soon-connector", status: "coming_soon" };

beforeEach(() => {
  resetConnectorRegistry();
  registerConnector(TEST_CONNECTOR);
  registerConnector(COMING_SOON_CONNECTOR);
});

afterEach(() => {
  vi.clearAllMocks();
  resetConnectorInstallationStore();
  resetApiKeyStore();
  resetConnectorRegistry();
});

describe("installConnectorAction", () => {
  it("requires workspace.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await installConnectorAction("test-connector", {});
    expect(result.success).toBe(false);
  });

  it("rejects an unknown connector", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await installConnectorAction("does-not-exist", {});
    expect(result.success).toBe(false);
  });

  it("rejects installing a coming_soon connector", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await installConnectorAction("coming-soon-connector", {});
    expect(result.success).toBe(false);
  });

  it("installs a connector scoped to the session's own workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await installConnectorAction("test-connector", {});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.workspace_id).toBe("ws_1");
  });

  it("rejects installing the same connector twice", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await installConnectorAction("test-connector", {});
    const result = await installConnectorAction("test-connector", {});
    expect(result.success).toBe(false);
  });
});

describe("enable / disable / reconnect / uninstall actions", () => {
  it("reject an installation belonging to a different workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const installed = await installConnectorAction("test-connector", {});
    if (!installed.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, workspace: { id: "ws_other", name: "Other" } });
    expect((await disableConnectorAction(installed.data.id)).success).toBe(false);
    expect((await enableConnectorAction(installed.data.id)).success).toBe(false);
    expect((await reconnectConnectorAction(installed.data.id)).success).toBe(false);
    expect((await uninstallConnectorAction(installed.data.id)).success).toBe(false);
  });

  it("disable then enable round-trips enabled state", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const installed = await installConnectorAction("test-connector", {});
    if (!installed.success) throw new Error("setup failed");

    const disabled = await disableConnectorAction(installed.data.id);
    expect(disabled.success).toBe(true);
    if (disabled.success) expect(disabled.data.enabled).toBe(false);

    const enabled = await enableConnectorAction(installed.data.id);
    expect(enabled.success).toBe(true);
    if (enabled.success) expect(enabled.data.enabled).toBe(true);
  });

  it("reconnect bumps reconnect_count", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const installed = await installConnectorAction("test-connector", {});
    if (!installed.success) throw new Error("setup failed");

    const reconnected = await reconnectConnectorAction(installed.data.id);
    expect(reconnected.success).toBe(true);
    if (reconnected.success) expect(reconnected.data.reconnect_count).toBe(1);
  });

  it("uninstall removes the installation", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const installed = await installConnectorAction("test-connector", {});
    if (!installed.success) throw new Error("setup failed");

    const uninstalled = await uninstallConnectorAction(installed.data.id);
    expect(uninstalled.success).toBe(true);

    const secondAttempt = await uninstallConnectorAction(installed.data.id);
    expect(secondAttempt.success).toBe(false);
  });
});
