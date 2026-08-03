import type { OperationalAlert, OperationalSeverity } from "@/types/operationsCenter";
import type { CreateIncidentInput } from "@/lib/data/mock/operationalIncidentsStore";

/**
 * v2.0 Checkpoint 31, Step 7 — Incident Engine. Groups already-existing
 * `OperationalAlert`s into an `OperationalIncident` when several critical
 * alerts are open at once and coordinated attention (not a single
 * acknowledgment) is what the moment calls for — never a second
 * incident-management platform, just a grouping layer over alerts this
 * checkpoint already owns.
 *
 * `related_dispatch_order_ids`/`related_worker_ids`/`related_vehicle_ids`/
 * `related_equipment_ids` are populated only when an alert's own
 * `source_record_id` genuinely names that exact entity — today that is
 * true for `field_operations` alerts (record id = Field Operation id) and
 * `route_optimization` alerts (record id = Route Plan id); `dispatch`
 * alerts carry an *assignment* id (not the order id), and `workforce`
 * alerts are aggregate-level with no single record id at all, so those
 * fields stay empty for those categories rather than guess wrong.
 */

const MIN_CRITICAL_ALERTS_FOR_INCIDENT = 2;

/** Groups currently-open, critical-severity alerts into a single incident-worthy cluster once there are enough of them happening at once to need coordinated attention — every other alert is left to stand on its own. */
export function groupCriticalAlerts(alerts: OperationalAlert[]): OperationalAlert[][] {
  const critical = alerts.filter((a) => a.severity === "critical" && (a.status === "open" || a.status === "acknowledged" || a.status === "escalated"));
  if (critical.length < MIN_CRITICAL_ALERTS_FOR_INCIDENT) return [];
  return [critical];
}

function highestSeverity(alerts: OperationalAlert[]): OperationalSeverity {
  const order: OperationalSeverity[] = ["critical", "high", "medium", "low", "informational"];
  for (const level of order) {
    if (alerts.some((a) => a.severity === level)) return level;
  }
  return "informational";
}

export function buildIncidentFromAlerts(alerts: OperationalAlert[]): CreateIncidentInput {
  const categories = new Set(alerts.map((a) => a.category));
  return {
    title: alerts.length === 1 ? alerts[0].title : `${alerts.length} critical alerts across ${categories.size} area${categories.size === 1 ? "" : "s"} require attention`,
    description: alerts.map((a) => `- ${a.title}: ${a.description}`).join("\n"),
    severity: highestSeverity(alerts),
    source_alert_ids: alerts.map((a) => a.id),
    related_dispatch_order_ids: [],
    related_field_operation_ids: alerts.filter((a) => a.category === "field_operations" && a.source_record_id).map((a) => a.source_record_id as string),
    related_route_plan_ids: alerts.filter((a) => a.category === "route_optimization" && a.source_record_id).map((a) => a.source_record_id as string),
    related_worker_ids: [],
    related_vehicle_ids: [],
    related_equipment_ids: [],
    owner_member_id: null,
  };
}
