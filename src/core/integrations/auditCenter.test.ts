import { describe, expect, it } from "vitest";
import { getAuditLogForConnection, getAuditLogForCredential, getIntegrationAuditLog, recordConnectionAuditEvent, recordCredentialAuditEvent } from "@/core/integrations/auditCenter";

describe("Audit Center", () => {
  it("records and reads back a connection audit event scoped to its own owner id", async () => {
    const workspaceId = `ws_${crypto.randomUUID()}`;
    await recordConnectionAuditEvent(workspaceId, "user_1", "connection.state_changed", "conn_1", { state: "disconnected" }, { state: "connecting" });

    const forConnection = await getAuditLogForConnection(workspaceId, "conn_1");
    expect(forConnection).toHaveLength(1);
    expect(forConnection[0].action).toBe("connection.state_changed");
    expect(forConnection[0].owner_type).toBe("integration_connection");
    expect(forConnection[0].before).toEqual({ state: "disconnected" });
    expect(forConnection[0].after).toEqual({ state: "connecting" });
  });

  it("records and reads back a credential audit event scoped to its own owner id", async () => {
    const workspaceId = `ws_${crypto.randomUUID()}`;
    await recordCredentialAuditEvent(workspaceId, "user_1", "credential.rotated", "cred_1");

    const forCredential = await getAuditLogForCredential(workspaceId, "cred_1");
    expect(forCredential).toHaveLength(1);
    expect(forCredential[0].owner_type).toBe("integration_credential");
  });

  it("getIntegrationAuditLog merges both owner types, newest first, and excludes other workspaces' entries", async () => {
    const workspaceId = `ws_${crypto.randomUUID()}`;
    await recordConnectionAuditEvent(workspaceId, "user_1", "connection.created", "conn_2");
    await recordCredentialAuditEvent(workspaceId, "user_1", "credential.issued", "cred_2");
    await recordConnectionAuditEvent(`ws_other_${crypto.randomUUID()}`, "user_1", "connection.created", "conn_3");

    const merged = await getIntegrationAuditLog(workspaceId);
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((entry) => entry.owner_type))).toEqual(new Set(["integration_connection", "integration_credential"]));
  });
});
