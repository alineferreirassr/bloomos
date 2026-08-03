import type { OperationalAlert, OperationalCategory, OperationalFeedItem, OperationalIncident, OperationalSeverity } from "@/types/operationsCenter";
import type { TimelineActivity } from "@/types/timelineActivity";

/**
 * v2.0 Checkpoint 31, Step 8 — Operations Feed. A pure, computed-only
 * merge of the event sources this checkpoint already has real data for —
 * every Alert lifecycle transition, every Incident lifecycle transition,
 * and the reused cross-module Timeline (Step 14's own platform, never a
 * second store) — into one chronological/priority-sortable, filterable
 * list. Nothing here is persisted; a fresh feed is rebuilt from the
 * Alert/Incident stores and the Timeline read model on every call.
 *
 * Named sources: alert-opened, alert-acknowledged, alert-resolved,
 * alert-dismissed, alert-escalated, incident-opened, incident-acknowledged,
 * incident-resolved, and reused-timeline-activity.
 */

export interface FeedSourceData {
  alerts: OperationalAlert[];
  incidents: OperationalIncident[];
  timelineActivity: TimelineActivity[];
}

export interface FeedFilter {
  category?: OperationalCategory;
  sourceNodeId?: string;
  occurredAfter?: string;
  occurredBefore?: string;
  pinnedOnly?: boolean;
}

const SEVERITY_RANK: Record<OperationalSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };

function alertFeedItems(alerts: OperationalAlert[], pinnedIds: ReadonlySet<string>): OperationalFeedItem[] {
  const items: OperationalFeedItem[] = [];
  for (const alert of alerts) {
    const base = { category: alert.category, severity: alert.severity, sourceRef: alert.source_ref, relatedAlertId: alert.id, relatedIncidentId: null, deepLink: `/operations-center/alerts/${alert.id}` };
    const id = `${alert.id}:opened`;
    items.push({ id, ...base, description: `Alert opened: ${alert.title}`, occurredAt: alert.created_at, pinned: pinnedIds.has(id) });
    if (alert.acknowledged_at) {
      const ackId = `${alert.id}:acknowledged`;
      items.push({ id: ackId, ...base, description: `Alert acknowledged: ${alert.title}`, occurredAt: alert.acknowledged_at, pinned: pinnedIds.has(ackId) });
    }
    if (alert.resolved_at) {
      const resolvedId = `${alert.id}:resolved`;
      items.push({ id: resolvedId, ...base, description: `Alert resolved: ${alert.title}`, occurredAt: alert.resolved_at, pinned: pinnedIds.has(resolvedId) });
    }
    if (alert.dismissed_at) {
      const dismissedId = `${alert.id}:dismissed`;
      items.push({ id: dismissedId, ...base, description: `Alert dismissed: ${alert.title}`, occurredAt: alert.dismissed_at, pinned: pinnedIds.has(dismissedId) });
    }
    if (alert.escalated_at) {
      const escalatedId = `${alert.id}:escalated`;
      items.push({ id: escalatedId, ...base, description: `Alert escalated: ${alert.title}`, occurredAt: alert.escalated_at, pinned: pinnedIds.has(escalatedId) });
    }
  }
  return items;
}

/** An incident has no `category` of its own — it groups alerts that may span several. The category of its own first linked alert is used as a representative label; falls back to `"timeline"` (the most neutral category) when no linked alert can be found. */
function representativeCategory(incident: OperationalIncident, alertsById: Map<string, OperationalAlert>): OperationalCategory {
  for (const alertId of incident.source_alert_ids) {
    const alert = alertsById.get(alertId);
    if (alert) return alert.category;
  }
  return "timeline";
}

function incidentFeedItems(incidents: OperationalIncident[], alerts: OperationalAlert[], pinnedIds: ReadonlySet<string>): OperationalFeedItem[] {
  const alertsById = new Map(alerts.map((a) => [a.id, a]));
  const items: OperationalFeedItem[] = [];
  for (const incident of incidents) {
    const base = { category: representativeCategory(incident, alertsById), severity: incident.severity, sourceRef: null, relatedAlertId: null, relatedIncidentId: incident.id, deepLink: `/operations-center/incidents/${incident.id}` };
    const openedId = `${incident.id}:opened`;
    items.push({ id: openedId, ...base, description: `Incident opened: ${incident.title}`, occurredAt: incident.created_at, pinned: pinnedIds.has(openedId) });
    if (incident.acknowledged_at) {
      const ackId = `${incident.id}:acknowledged`;
      items.push({ id: ackId, ...base, description: `Incident acknowledged: ${incident.title}`, occurredAt: incident.acknowledged_at, pinned: pinnedIds.has(ackId) });
    }
    if (incident.resolved_at) {
      const resolvedId = `${incident.id}:resolved`;
      items.push({ id: resolvedId, ...base, description: `Incident resolved: ${incident.title}`, occurredAt: incident.resolved_at, pinned: pinnedIds.has(resolvedId) });
    }
  }
  return items;
}

function timelineFeedItems(activity: TimelineActivity[], pinnedIds: ReadonlySet<string>): OperationalFeedItem[] {
  return activity.map((a) => ({ id: `timeline:${a.id}`, category: "timeline", severity: null, description: a.description, occurredAt: a.timestamp, sourceRef: { nodeType: a.owner_type, nodeId: a.owner_id }, relatedAlertId: null, relatedIncidentId: null, pinned: pinnedIds.has(`timeline:${a.id}`), deepLink: null }));
}

export function buildOperationalFeed(data: FeedSourceData, pinnedIds: ReadonlySet<string> = new Set()): OperationalFeedItem[] {
  return [...alertFeedItems(data.alerts, pinnedIds), ...incidentFeedItems(data.incidents, data.alerts, pinnedIds), ...timelineFeedItems(data.timelineActivity, pinnedIds)];
}

export function filterFeed(items: OperationalFeedItem[], filter: FeedFilter): OperationalFeedItem[] {
  return items.filter((item) => {
    if (filter.category && item.category !== filter.category) return false;
    if (filter.sourceNodeId && item.sourceRef?.nodeId !== filter.sourceNodeId) return false;
    if (filter.occurredAfter && item.occurredAt < filter.occurredAfter) return false;
    if (filter.occurredBefore && item.occurredAt > filter.occurredBefore) return false;
    if (filter.pinnedOnly && !item.pinned) return false;
    return true;
  });
}

/** Pinned items first, then newest-first. */
export function sortFeedChronological(items: OperationalFeedItem[]): OperationalFeedItem[] {
  return [...items].sort((a, b) => (a.pinned === b.pinned ? b.occurredAt.localeCompare(a.occurredAt) : a.pinned ? -1 : 1));
}

/** Pinned items first, then most severe first, then newest-first within the same severity. Items with no severity (e.g. reused Timeline activity) sort after every severity-bearing item. */
export function sortFeedByPriority(items: OperationalFeedItem[]): OperationalFeedItem[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const rankA = a.severity ? SEVERITY_RANK[a.severity] : SEVERITY_RANK.informational + 1;
    const rankB = b.severity ? SEVERITY_RANK[b.severity] : SEVERITY_RANK.informational + 1;
    if (rankA !== rankB) return rankA - rankB;
    return b.occurredAt.localeCompare(a.occurredAt);
  });
}
