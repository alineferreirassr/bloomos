import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createConnectorInstallation,
  deleteConnectorInstallation,
  getConnectorInstallationByConnectorId,
  getConnectorInstallationById,
  listConnectorInstallationsForWorkspace,
  resetConnectorInstallationStore,
  updateConnectorInstallation,
} from "@/lib/data/core/marketplace/connectorInstallationStore";

afterEach(() => {
  resetConnectorInstallationStore();
});

function install(workspaceId = "ws_1", connectorId = "slack") {
  return createConnectorInstallation({
    workspaceId,
    connectorId,
    config: { webhookUrl: "https://hooks.example.com/x" },
    apiKeyId: "api-key_1",
    installedBy: "member_1",
    healthStatus: "connected",
  });
}

describe("connectorInstallationStore", () => {
  it("creates an installation with defaults", () => {
    const installation = install();
    expect(installation.enabled).toBe(true);
    expect(installation.health_status).toBe("connected");
    expect(installation.reconnect_count).toBe(0);
    expect(installation.last_sync_at).toBeNull();
  });

  it("lists installations scoped to a workspace", () => {
    install("ws_1", "slack");
    install("ws_2", "discord");
    install("ws_1", "notion");
    const list = listConnectorInstallationsForWorkspace("ws_1");
    expect(list.map((installation) => installation.connector_id).sort()).toEqual(["notion", "slack"]);
  });

  it("lists newest first", () => {
    vi.useFakeTimers();
    try {
      install("ws_1", "slack");
      vi.setSystemTime(new Date(Date.now() + 1000));
      const second = install("ws_1", "notion");
      const list = listConnectorInstallationsForWorkspace("ws_1");
      expect(list[0].id).toBe(second.id);
    } finally {
      vi.useRealTimers();
    }
  });

  it("getConnectorInstallationById finds by id", () => {
    const installation = install();
    expect(getConnectorInstallationById(installation.id)?.connector_id).toBe("slack");
  });

  it("getConnectorInstallationById returns null for an unknown id", () => {
    expect(getConnectorInstallationById("nope")).toBeNull();
  });

  it("getConnectorInstallationByConnectorId finds an existing installation for a workspace+connector pair", () => {
    install("ws_1", "slack");
    expect(getConnectorInstallationByConnectorId("ws_1", "slack")?.connector_id).toBe("slack");
    expect(getConnectorInstallationByConnectorId("ws_1", "discord")).toBeNull();
  });

  it("updateConnectorInstallation patches fields and bumps updated_at", async () => {
    const installation = install();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const updated = updateConnectorInstallation(installation.id, { enabled: false, health_status: "disconnected" });
    expect(updated?.enabled).toBe(false);
    expect(updated?.health_status).toBe("disconnected");
    expect(updated?.updated_at).not.toBe(installation.updated_at);
  });

  it("updateConnectorInstallation returns null for an unknown id", () => {
    expect(updateConnectorInstallation("nope", { enabled: false })).toBeNull();
  });

  it("deleteConnectorInstallation removes the record and reports success", () => {
    const installation = install();
    expect(deleteConnectorInstallation(installation.id)).toBe(true);
    expect(getConnectorInstallationById(installation.id)).toBeNull();
    expect(deleteConnectorInstallation(installation.id)).toBe(false);
  });
});
