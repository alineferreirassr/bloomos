import { nowIso } from "@/lib/data/utils";
import type { IntegrationConnection, IntegrationCredential, IntegrationHealthSnapshot } from "@/core/integrations/types";

/**
 * The Health Monitor (v2 Checkpoint 22, Step 11) — a pure, on-demand
 * health read, the same "derive from real signals, never an arbitrary
 * simulated flag" philosophy `checkConnectorHealth` (Checkpoint 18)
 * already established, built alongside it rather than replacing it (that
 * function keeps working exactly as before, for Marketplace's own
 * `ConnectorInstallation`s).
 *
 * Every field here is either read straight off the `IntegrationConnection`
 * record itself (`state`, `failure_count`, `retry_count`) or the
 * credential's own `expires_at` — never invented. `latency_ms`,
 * `quota_used`, `quota_limit`, and `rate_limited` are honestly `null`/
 * `false` this checkpoint: this platform never makes a real request to a
 * real provider, so there is no real latency to measure and no real
 * request volume to meter against a quota. The fields exist so a future
 * checkpoint that does make real calls can populate them without
 * changing this snapshot's own shape.
 */
export function computeHealthSnapshot(connection: IntegrationConnection, credential: IntegrationCredential | null): IntegrationHealthSnapshot {
  return {
    connection_id: connection.id,
    provider_id: connection.provider_id,
    state: connection.state,
    latency_ms: null,
    failure_count: connection.failure_count,
    retry_count: connection.retry_count,
    quota_used: null,
    quota_limit: null,
    rate_limited: false,
    token_expires_at: credential?.expires_at ?? null,
    last_sync_at: connection.last_sync_at,
    computed_at: nowIso(),
  };
}

/** A connection is healthy when it's actively `connected` and hasn't accumulated failures — the same two real signals a Health Monitor UI would want to badge red without inventing a third. */
export function isHealthySnapshot(snapshot: IntegrationHealthSnapshot): boolean {
  return snapshot.state === "connected" && snapshot.failure_count === 0;
}

/** States that warrant surfacing on a dashboard without the caller re-deriving the list itself. */
const ATTENTION_STATES: IntegrationHealthSnapshot["state"][] = ["failed", "expired", "unknown"];

export function needsAttention(snapshot: IntegrationHealthSnapshot): boolean {
  return ATTENTION_STATES.includes(snapshot.state) || snapshot.failure_count > 0;
}

export interface HealthSummary {
  total: number;
  healthy: number;
  needsAttention: number;
  byState: Record<string, number>;
}

export function summarizeHealth(snapshots: IntegrationHealthSnapshot[]): HealthSummary {
  const byState: Record<string, number> = {};
  for (const snapshot of snapshots) {
    byState[snapshot.state] = (byState[snapshot.state] ?? 0) + 1;
  }
  return {
    total: snapshots.length,
    healthy: snapshots.filter(isHealthySnapshot).length,
    needsAttention: snapshots.filter(needsAttention).length,
    byState,
  };
}
