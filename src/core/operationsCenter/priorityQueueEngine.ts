import type { DispatchOrder } from "@/types/dispatch";
import type { FieldOperation } from "@/types/fieldOperations";
import type { Route } from "@/types/routeOptimization";
import type { SchedulingFinding } from "@/types/scheduling";
import type { Decision } from "@/types/executiveDecisions";
import type { OperationalAlert, OperationalIncident, OperationalSeverity, PriorityQueueItem } from "@/types/operationsCenter";

/**
 * v2.0 Checkpoint 31, Step 11 — Operational Priority Queue. A pure merge
 * of items every other engine in this checkpoint (or an existing module)
 * already produces — Alerts, Incidents, Executive Decisions, blocked
 * Field Operations, high-risk Routes, pending Dispatch acceptances, and
 * Scheduling conflicts — ranked by their own already-assigned severity.
 * This is explicitly NOT a second Executive Decision Engine: nothing here
 * re-scores or re-prioritizes a Decision's own priority, it only reads it
 * and places it in the merged list next to everything else needing
 * attention right now.
 *
 * `bottlenecks` has no dedicated detector yet in this checkpoint — no
 * module currently exposes a "this exact resource is a bottleneck"
 * signal — so it is accepted as a plain input array (empty until a
 * future engine computes real ones) rather than fabricated here.
 */
export interface PriorityQueueSourceData {
  dispatchOrders: DispatchOrder[];
  fieldOperations: FieldOperation[];
  routeResults: Route[];
  schedulingFindings: SchedulingFinding[];
  criticalExecutiveDecisions: Decision[];
  blockedObjectivesCount: number;
  alerts: OperationalAlert[];
  incidents: OperationalIncident[];
  bottlenecks: PriorityQueueItem[];
}

const SEVERITY_RANK: Record<OperationalSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
const OPEN_ALERT_STATES = new Set(["open", "acknowledged", "escalated"]);
const OPEN_INCIDENT_STATES = new Set(["open", "acknowledged"]);
const SCHEDULING_CONFLICT_TYPES = new Set(["overbooked_schedule", "recurring_conflict", "holiday_conflict"]);

export function buildPriorityQueue(data: PriorityQueueSourceData): PriorityQueueItem[] {
  const items: PriorityQueueItem[] = [];

  for (const alert of data.alerts) {
    if (alert.severity === "critical" && OPEN_ALERT_STATES.has(alert.status)) {
      items.push({ id: `alert:${alert.id}`, type: "alert", severity: alert.severity, title: alert.title, description: alert.description, sourceRef: alert.source_ref, deepLink: `/operations-center/alerts/${alert.id}` });
    }
  }

  for (const incident of data.incidents) {
    if (OPEN_INCIDENT_STATES.has(incident.status)) {
      items.push({ id: `incident:${incident.id}`, type: "incident", severity: incident.severity, title: incident.title, description: incident.description, sourceRef: null, deepLink: `/operations-center/incidents/${incident.id}` });
    }
  }

  for (const decision of data.criticalExecutiveDecisions) {
    if (decision.priority === "critical" && decision.status !== "resolved" && decision.status !== "archived") {
      items.push({ id: `executive_decision:${decision.id}`, type: "executive_decision", severity: decision.priority, title: decision.title, description: decision.description, sourceRef: null, deepLink: "/assets/executive-decisions" });
    }
  }

  if (data.blockedObjectivesCount > 0) {
    items.push({ id: "objective:blocked", type: "objective", severity: "high", title: "Blocked objectives", description: `${data.blockedObjectivesCount} objective${data.blockedObjectivesCount === 1 ? " is" : "s are"} blocked.`, sourceRef: null, deepLink: null });
  }

  for (const operation of data.fieldOperations) {
    if (operation.status !== "active") continue;
    const latestSession = operation.sessions[operation.sessions.length - 1];
    if (latestSession && (latestSession.lifecycle_state === "cancelled" || latestSession.lifecycle_state === "aborted" || latestSession.lifecycle_state === "failed")) {
      items.push({ id: `operation:${operation.id}`, type: "operation", severity: "critical", title: "Field operation blocked", description: `Field operation ${operation.id} is blocked.`, sourceRef: null, deepLink: `/field-operations/${operation.id}` });
    }
  }

  for (const route of data.routeResults) {
    if (route.health.delayRisk > 60) {
      items.push({ id: `route:${route.routePlan.id}`, type: "route", severity: route.health.delayRisk > 80 ? "high" : "medium", title: "Route at high delay risk", description: `Route plan ${route.routePlan.id} has a declared delay risk of ${route.health.delayRisk}.`, sourceRef: null, deepLink: `/route-optimization/${route.routePlan.id}` });
    }
  }

  for (const order of data.dispatchOrders) {
    for (const assignment of order.assignments) {
      if (assignment.queue_state === "pending" || assignment.queue_state === "queued" || assignment.queue_state === "assigned") {
        items.push({ id: `acceptance:${assignment.id}`, type: "acceptance", severity: "low", title: "Assignment awaiting acceptance", description: `Dispatch assignment ${assignment.id} on order ${order.id} is awaiting a response.`, sourceRef: null, deepLink: `/dispatch/${order.id}` });
      }
    }
  }

  for (const finding of data.schedulingFindings) {
    if (SCHEDULING_CONFLICT_TYPES.has(finding.type)) {
      items.push({ id: `scheduling_conflict:${finding.id}`, type: "scheduling_conflict", severity: finding.severity, title: "Scheduling conflict", description: finding.description || `Scheduling finding ${finding.id} (${finding.type}).`, sourceRef: null, deepLink: null });
    }
  }

  items.push(...data.bottlenecks);

  return items;
}

/** Most severe first; ties broken by the fixed `PRIORITY_QUEUE_ITEM_TYPES` declaration order so the merge is deterministic. */
export function sortPriorityQueue(items: PriorityQueueItem[]): PriorityQueueItem[] {
  return [...items].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
