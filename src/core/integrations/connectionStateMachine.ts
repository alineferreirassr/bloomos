import type { ConnectionEvent, ConnectionState } from "@/core/integrations/types";

/**
 * The Connection State Machine (v2 Checkpoint 22, Step 5) — the one
 * transition table every provider's connection lifecycle uses,
 * regardless of what the provider actually is. A genuine superset of
 * Marketplace's own `ConnectorHealthStatus` (Checkpoint 18) — that type's
 * 5 values (`connected`/`disconnected`/`pending`/`error`/`rate_limited`)
 * are a *derived, on-demand health read*, not a persisted state-machine
 * transition log; this is the real thing the spec's 9 states call for,
 * built alongside it rather than replacing it (Marketplace's own
 * `checkConnectorHealth` keeps working exactly as before).
 *
 * Deliberately data, not a class — a plain lookup table plus one pure
 * function, matching every other rules-table in this codebase
 * (`core/workflows/purchaseWorkflow.ts`'s own transition table is the
 * closest precedent).
 */

const TRANSITIONS: Record<ConnectionEvent, { from: ConnectionState[]; to: ConnectionState }> = {
  connect_requested: { from: ["disconnected", "failed", "unknown"], to: "connecting" },
  connect_succeeded: { from: ["connecting", "reconnecting"], to: "connected" },
  connect_failed: { from: ["connecting", "reconnecting"], to: "failed" },
  token_expired: { from: ["connected"], to: "expired" },
  refresh_requested: { from: ["expired", "connected"], to: "refreshing" },
  refresh_succeeded: { from: ["refreshing"], to: "connected" },
  refresh_failed: { from: ["refreshing"], to: "expired" },
  disable_requested: { from: ["connected", "connecting", "expired", "failed", "refreshing", "unknown"], to: "disabled" },
  enable_requested: { from: ["disabled"], to: "disconnected" },
  reconnect_requested: { from: ["failed", "expired", "disconnected"], to: "reconnecting" },
  health_check_failed: { from: ["connected"], to: "failed" },
  health_check_unknown: { from: ["connected", "connecting", "refreshing", "reconnecting"], to: "unknown" },
};

export interface TransitionResult {
  allowed: boolean;
  nextState: ConnectionState | null;
  reason: string | null;
}

/** Pure — never mutates a connection record; the caller persists `nextState` if `allowed`. */
export function canTransition(currentState: ConnectionState, event: ConnectionEvent): TransitionResult {
  const rule = TRANSITIONS[event];
  if (!rule.from.includes(currentState)) {
    return { allowed: false, nextState: null, reason: `Event "${event}" is not valid from state "${currentState}".` };
  }
  return { allowed: true, nextState: rule.to, reason: null };
}

/** Every state event could plausibly fire from, for a UI that wants to show only the legal next actions. */
export function listValidEventsFrom(state: ConnectionState): ConnectionEvent[] {
  return (Object.keys(TRANSITIONS) as ConnectionEvent[]).filter((event) => TRANSITIONS[event].from.includes(state));
}
