import type { OperationalAlert, OperationalSignal, AlertStatus } from "@/types/operationsCenter";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 31 — Operational Alert persistence. The only genuinely
 * new, stateful record this checkpoint stores — every other aggregated
 * figure is computed fresh on read. `upsertAlertFromSignal` is the single
 * function every Alert Engine run goes through: a `Signal` whose
 * `dedupe_key` matches an already-`open` alert reconciles with it (never
 * a duplicate); otherwise a fresh `open` alert is created.
 */
let alerts: OperationalAlert[] = [];

export function resetOperationalAlertsStore(): void {
  alerts = [];
}

const OPEN_STATES: ReadonlySet<AlertStatus> = new Set(["open", "acknowledged", "escalated"]);

/**
 * Keyed on `sourceRecordId` first (the exact record's own plain id) and
 * falls back to `sourceRef` only when no record id was given — this is
 * what keeps two different records tripping the same rule (e.g. two
 * different declined assignments) from collapsing into a single alert,
 * since most Operations Center source domains have no `KnowledgeNodeRef`
 * of their own yet and would otherwise all resolve to the same "none".
 */
export function dedupeKeyFor(signal: OperationalSignal): string {
  const recordKey = signal.sourceRecordId ?? `${signal.sourceRef?.nodeType ?? "none"}:${signal.sourceRef?.nodeId ?? "none"}`;
  return `${signal.ruleId}:${recordKey}`;
}

async function listAlertsForWorkspace(workspaceId: string, includeResolved = false): Promise<OperationalAlert[]> {
  return alerts.filter((a) => a.workspace_id === workspaceId && (includeResolved || OPEN_STATES.has(a.status)));
}

async function getAlertById(id: string): Promise<OperationalAlert | null> {
  return alerts.find((a) => a.id === id) ?? null;
}

/** Reconciles a freshly-detected `Signal` against the store: an already-open alert with the same `dedupe_key` is returned unchanged (never duplicated); otherwise a fresh alert is created in `"open"` status. */
async function upsertAlertFromSignal(workspaceId: string, signal: OperationalSignal): Promise<DataResult<OperationalAlert>> {
  const dedupeKey = dedupeKeyFor(signal);
  const existing = alerts.find((a) => a.workspace_id === workspaceId && a.dedupe_key === dedupeKey && OPEN_STATES.has(a.status));
  if (existing) return ok(existing);

  const timestamp = nowIso();
  const created: OperationalAlert = {
    id: generateId("operational_alert"),
    workspace_id: workspaceId,
    rule_id: signal.ruleId,
    category: signal.category,
    severity: signal.severity,
    title: signal.title,
    description: signal.description,
    source_ref: signal.sourceRef,
    source_record_id: signal.sourceRecordId,
    status: "open",
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_by: null,
    resolved_at: null,
    resolution_reason: null,
    dismissed_at: null,
    escalated_at: null,
    expires_at: null,
    dedupe_key: dedupeKey,
    created_at: timestamp,
    updated_at: timestamp,
  };
  alerts = [...alerts, created];
  return ok(created);
}

/** "Resolving an alert means the source condition is no longer present..." — every currently-open alert whose `dedupe_key` is absent from this evaluation's own live signal set is auto-resolved, never left open on stale data. */
async function autoResolveGoneAlerts(workspaceId: string, liveDedupeKeys: ReadonlySet<string>): Promise<OperationalAlert[]> {
  const timestamp = nowIso();
  const resolved: OperationalAlert[] = [];
  alerts = alerts.map((a) => {
    if (a.workspace_id !== workspaceId || !OPEN_STATES.has(a.status) || liveDedupeKeys.has(a.dedupe_key)) return a;
    const updated: OperationalAlert = { ...a, status: "resolved", resolved_by: null, resolved_at: timestamp, resolution_reason: "The underlying condition is no longer present.", updated_at: timestamp };
    resolved.push(updated);
    return updated;
  });
  return resolved;
}

async function acknowledgeAlert(id: string, workspaceId: string, memberId: string): Promise<DataResult<OperationalAlert>> {
  const existing = alerts.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This alert could not be found.");
  const timestamp = nowIso();
  const updated: OperationalAlert = { ...existing, status: "acknowledged", acknowledged_by: memberId, acknowledged_at: timestamp, updated_at: timestamp };
  alerts = alerts.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

async function resolveAlert(id: string, workspaceId: string, memberId: string, reason: string): Promise<DataResult<OperationalAlert>> {
  const existing = alerts.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This alert could not be found.");
  const timestamp = nowIso();
  const updated: OperationalAlert = { ...existing, status: "resolved", resolved_by: memberId, resolved_at: timestamp, resolution_reason: reason, updated_at: timestamp };
  alerts = alerts.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

async function dismissAlert(id: string, workspaceId: string, memberId: string, reason: string): Promise<DataResult<OperationalAlert>> {
  const existing = alerts.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This alert could not be found.");
  const timestamp = nowIso();
  const updated: OperationalAlert = { ...existing, status: "dismissed", resolved_by: memberId, dismissed_at: timestamp, resolution_reason: reason, updated_at: timestamp };
  alerts = alerts.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

async function escalateAlert(id: string, workspaceId: string, memberId: string): Promise<DataResult<OperationalAlert>> {
  const existing = alerts.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This alert could not be found.");
  const timestamp = nowIso();
  const updated: OperationalAlert = { ...existing, status: "escalated", escalated_at: timestamp, acknowledged_by: memberId, updated_at: timestamp };
  alerts = alerts.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

export interface OperationalAlertsRepository {
  listAlertsForWorkspace: typeof listAlertsForWorkspace;
  getAlertById: typeof getAlertById;
  upsertAlertFromSignal: typeof upsertAlertFromSignal;
  autoResolveGoneAlerts: typeof autoResolveGoneAlerts;
  acknowledgeAlert: typeof acknowledgeAlert;
  resolveAlert: typeof resolveAlert;
  dismissAlert: typeof dismissAlert;
  escalateAlert: typeof escalateAlert;
}

export const mockOperationalAlertsRepository: OperationalAlertsRepository = {
  listAlertsForWorkspace,
  getAlertById,
  upsertAlertFromSignal,
  autoResolveGoneAlerts,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  escalateAlert,
};
