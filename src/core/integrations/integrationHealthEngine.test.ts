import { afterEach, describe, expect, it } from "vitest";
import { computeIntegrationsHealth } from "@/core/integrations/integrationHealthEngine";
import { resetMappingStore } from "@/lib/data/core/integrations/mappingStore";
import { resetErrorRecordStore, insertErrorRecord, generateErrorRecordId } from "@/lib/data/core/integrations/errorRecordStore";
import type { IntegrationConnection, IntegrationCredential } from "@/core/integrations/types";

function makeConnection(overrides: Partial<IntegrationConnection> = {}): IntegrationConnection {
  return {
    id: "conn_1",
    workspace_id: "ws_1",
    provider_id: "stripe",
    state: "connected",
    config: {},
    credential_id: "cred_1",
    capabilities: ["payment"],
    version: 1,
    installed_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    last_state_change_at: "2026-01-01T00:00:00.000Z",
    last_health_check_at: null,
    last_sync_at: "2026-01-01T00:00:00.000Z",
    failure_count: 0,
    retry_count: 0,
    ...overrides,
  };
}

afterEach(() => {
  resetMappingStore();
  resetErrorRecordStore();
});

describe("computeIntegrationsHealth", () => {
  it("reports notApplicable, never a fabricated score, when the workspace has zero connections", () => {
    const report = computeIntegrationsHealth({ connections: [], credentialsByConnectionId: new Map() });
    expect(report.overallScore).toBe(0);
    expect(report.categories.every((c) => c.notApplicableReason !== null)).toBe(true);
  });

  it("scores connection_status at 100 when every connection is connected", () => {
    const report = computeIntegrationsHealth({ connections: [makeConnection()], credentialsByConnectionId: new Map() });
    const category = report.categories.find((c) => c.category === "connection_status");
    expect(category?.score).toBe(100);
  });

  it("flags a failed connection with a real issue string", () => {
    const report = computeIntegrationsHealth({ connections: [makeConnection({ state: "failed" })], credentialsByConnectionId: new Map() });
    const category = report.categories.find((c) => c.category === "connection_status");
    expect(category?.issues.length).toBeGreaterThan(0);
    expect(category?.score).toBeLessThan(100);
  });

  it("flags a token expiring within 7 days under authentication", () => {
    const credential: IntegrationCredential = {
      id: "cred_1",
      workspace_id: "ws_1",
      connection_id: "conn_1",
      kind: "oauth_token",
      key_hash: null,
      key_prefix: null,
      access_token_ref: "ref_1",
      refresh_token_ref: null,
      scopes: [],
      expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      rotated_at: null,
      revoked_at: null,
      created_by: "member_1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const report = computeIntegrationsHealth({ connections: [makeConnection()], credentialsByConnectionId: new Map([["conn_1", credential]]) });
    expect(report.expiringSoonCount).toBe(1);
  });

  it("flags a connection that hasn't synced in over 30 days as stale", () => {
    const staleConnection = makeConnection({ last_sync_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() });
    const report = computeIntegrationsHealth({ connections: [staleConnection], credentialsByConnectionId: new Map() });
    expect(report.staleConnectionCount).toBe(1);
  });

  it("lowers the error_rate score when recent errors exist for a connection", () => {
    insertErrorRecord({ id: generateErrorRecordId(), connection_id: "conn_1", provider_id: "stripe", category: "network", message: "timeout", occurred_at: new Date().toISOString(), retryable: true });
    const report = computeIntegrationsHealth({ connections: [makeConnection()], credentialsByConnectionId: new Map() });
    const category = report.categories.find((c) => c.category === "error_rate");
    expect(category?.score).toBeLessThan(100);
  });

  it("marks webhook_health notApplicable when no connected provider declares webhook support", () => {
    const report = computeIntegrationsHealth({ connections: [makeConnection({ capabilities: ["payment"] })], credentialsByConnectionId: new Map() });
    const category = report.categories.find((c) => c.category === "webhook_health");
    expect(category?.notApplicableReason).not.toBeNull();
  });
});
