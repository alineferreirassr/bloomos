import { describe, expect, it } from "vitest";
import { computeHealthSnapshot, isHealthySnapshot, needsAttention, summarizeHealth } from "@/core/integrations/healthMonitor";
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
    installed_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    last_state_change_at: "2026-01-01T00:00:00.000Z",
    last_health_check_at: null,
    last_sync_at: null,
    failure_count: 0,
    retry_count: 0,
    ...overrides,
  };
}

describe("computeHealthSnapshot", () => {
  it("reads state/failure/retry straight off the connection and the token expiry off the credential", () => {
    const credential = { expires_at: "2026-06-01T00:00:00.000Z" } as IntegrationCredential;
    const snapshot = computeHealthSnapshot(makeConnection({ failure_count: 2, retry_count: 1 }), credential);
    expect(snapshot.state).toBe("connected");
    expect(snapshot.failure_count).toBe(2);
    expect(snapshot.retry_count).toBe(1);
    expect(snapshot.token_expires_at).toBe("2026-06-01T00:00:00.000Z");
    expect(snapshot.rate_limited).toBe(false);
    expect(snapshot.latency_ms).toBeNull();
  });

  it("is null token_expires_at with no credential", () => {
    const snapshot = computeHealthSnapshot(makeConnection(), null);
    expect(snapshot.token_expires_at).toBeNull();
  });
});

describe("isHealthySnapshot / needsAttention", () => {
  it("a connected connection with zero failures is healthy and needs no attention", () => {
    const snapshot = computeHealthSnapshot(makeConnection(), null);
    expect(isHealthySnapshot(snapshot)).toBe(true);
    expect(needsAttention(snapshot)).toBe(false);
  });

  it("a failed connection needs attention and isn't healthy", () => {
    const snapshot = computeHealthSnapshot(makeConnection({ state: "failed", failure_count: 3 }), null);
    expect(isHealthySnapshot(snapshot)).toBe(false);
    expect(needsAttention(snapshot)).toBe(true);
  });
});

describe("summarizeHealth", () => {
  it("aggregates counts by state", () => {
    const snapshots = [
      computeHealthSnapshot(makeConnection({ id: "c1", state: "connected" }), null),
      computeHealthSnapshot(makeConnection({ id: "c2", state: "failed", failure_count: 1 }), null),
      computeHealthSnapshot(makeConnection({ id: "c3", state: "connected" }), null),
    ];
    const summary = summarizeHealth(snapshots);
    expect(summary.total).toBe(3);
    expect(summary.healthy).toBe(2);
    expect(summary.needsAttention).toBe(1);
    expect(summary.byState).toEqual({ connected: 2, failed: 1 });
  });
});
