import type { OperationalAlert, OperationalSignal } from "@/types/operationsCenter";
import { dedupeKeyFor, type OperationalAlertsRepository } from "@/lib/data/mock/operationalAlertsStore";

/**
 * v2.0 Checkpoint 31, Step 6 — Alert Lifecycle Engine. The one place that
 * turns a fresh batch of `OperationalSignal`s (Step 5) into the store's
 * own `open`/`acknowledged`/`resolved`/`dismissed`/`escalated`/`expired`
 * lifecycle: every live signal is reconciled (created once, never
 * duplicated on repeat runs), and every currently-open alert whose own
 * condition is no longer present in this run's signal set is
 * auto-resolved — "resolving means the condition is gone, or an explicit
 * authorized close." Acknowledging/dismissing/escalating never touch any
 * source module's own state; they only mutate this alert's own record.
 */
export interface ReconcileAlertsResult {
  reconciled: OperationalAlert[];
  autoResolved: OperationalAlert[];
}

export async function reconcileAlerts(workspaceId: string, signals: OperationalSignal[], repository: OperationalAlertsRepository): Promise<ReconcileAlertsResult> {
  const reconciled: OperationalAlert[] = [];
  for (const signal of signals) {
    const result = await repository.upsertAlertFromSignal(workspaceId, signal);
    if (result.success) reconciled.push(result.data);
  }

  const liveDedupeKeys = new Set(signals.map(dedupeKeyFor));
  const autoResolved = await repository.autoResolveGoneAlerts(workspaceId, liveDedupeKeys);

  return { reconciled, autoResolved };
}
