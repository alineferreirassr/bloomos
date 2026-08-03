import { describe, expect, it } from "vitest";
import { buildOperationalFeed, filterFeed, sortFeedChronological, sortFeedByPriority, type FeedSourceData } from "@/core/operationsCenter/operationsFeedEngine";
import type { OperationalAlert, OperationalIncident } from "@/types/operationsCenter";
import type { TimelineActivity } from "@/types/timelineActivity";

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
  return {
    id: "operational_alert_1",
    workspace_id: "ws_1",
    rule_id: "field_operations.operation_blocked",
    category: "field_operations",
    severity: "critical",
    title: "Field operation blocked",
    description: "",
    source_ref: null,
    source_record_id: "field_operation_1",
    status: "open",
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_by: null,
    resolved_at: null,
    resolution_reason: null,
    dismissed_at: null,
    escalated_at: null,
    expires_at: null,
    dedupe_key: "k1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeIncident(overrides: Partial<OperationalIncident> = {}): OperationalIncident {
  return { id: "operational_incident_1", workspace_id: "ws_1", title: "Incident", description: "", severity: "critical", status: "open", source_alert_ids: [], related_dispatch_order_ids: [], related_field_operation_ids: [], related_route_plan_ids: [], related_worker_ids: [], related_vehicle_ids: [], related_equipment_ids: [], owner_member_id: null, resolution_notes: null, created_at: "2026-01-01T00:00:00.000Z", acknowledged_at: null, resolved_at: null, updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makeTimelineActivity(overrides: Partial<TimelineActivity> = {}): TimelineActivity {
  return { id: "activity_1", workspace_id: "ws_1", owner_type: "event", owner_id: "event_1", type: "dispatch_created", description: "Something happened", actor: "member_1", timestamp: "2026-01-01T00:00:00.000Z", ...overrides };
}

function emptyData(): FeedSourceData {
  return { alerts: [], incidents: [], timelineActivity: [] };
}

describe("buildOperationalFeed", () => {
  it("produces one feed item per alert lifecycle timestamp actually present", () => {
    const data = emptyData();
    data.alerts = [makeAlert({ acknowledged_at: "2026-01-02T00:00:00.000Z", resolved_at: "2026-01-03T00:00:00.000Z" })];
    const items = buildOperationalFeed(data);
    expect(items.map((i) => i.description)).toEqual(["Alert opened: Field operation blocked", "Alert acknowledged: Field operation blocked", "Alert resolved: Field operation blocked"]);
  });

  it("derives an incident's feed category from its own first linked alert", () => {
    const data = emptyData();
    data.alerts = [makeAlert({ id: "a1", category: "route_optimization" })];
    data.incidents = [makeIncident({ source_alert_ids: ["a1"] })];
    const items = buildOperationalFeed(data).filter((i) => i.relatedIncidentId === "operational_incident_1");
    expect(items[0].category).toBe("route_optimization");
  });

  it("falls back to the timeline category when an incident has no resolvable linked alert", () => {
    const data = emptyData();
    data.incidents = [makeIncident({ source_alert_ids: ["missing_alert"] })];
    const items = buildOperationalFeed(data);
    expect(items[0].category).toBe("timeline");
  });

  it("wraps reused Timeline activity as feed items with no severity and no deep link", () => {
    const data = emptyData();
    data.timelineActivity = [makeTimelineActivity()];
    const [item] = buildOperationalFeed(data);
    expect(item.severity).toBeNull();
    expect(item.deepLink).toBeNull();
    expect(item.category).toBe("timeline");
  });

  it("marks items pinned when their id is in the pinned set", () => {
    const data = emptyData();
    data.alerts = [makeAlert()];
    const items = buildOperationalFeed(data, new Set(["operational_alert_1:opened"]));
    expect(items[0].pinned).toBe(true);
  });
});

describe("filterFeed", () => {
  it("filters by category, date range, and pinned-only together", () => {
    const items = buildOperationalFeed({ alerts: [makeAlert({ category: "dispatch" }), makeAlert({ id: "a2", category: "workforce", created_at: "2026-06-01T00:00:00.000Z" })], incidents: [], timelineActivity: [] });
    expect(filterFeed(items, { category: "dispatch" })).toHaveLength(1);
    expect(filterFeed(items, { occurredAfter: "2026-03-01" })).toHaveLength(1);
    expect(filterFeed(items, { pinnedOnly: true })).toHaveLength(0);
  });
});

describe("sortFeedChronological / sortFeedByPriority", () => {
  it("sorts pinned items first, then newest-first chronologically", () => {
    const items = buildOperationalFeed({ alerts: [makeAlert({ id: "a1", created_at: "2026-01-01T00:00:00.000Z" }), makeAlert({ id: "a2", created_at: "2026-02-01T00:00:00.000Z" })], incidents: [], timelineActivity: [] }, new Set(["a1:opened"]));
    const sorted = sortFeedChronological(items);
    expect(sorted[0].id).toBe("a1:opened");
    expect(sorted[1].id).toBe("a2:opened");
  });

  it("sorts by severity rank once pinning is equal, most severe first", () => {
    const items = buildOperationalFeed({ alerts: [makeAlert({ id: "a1", severity: "low" }), makeAlert({ id: "a2", severity: "critical" })], incidents: [], timelineActivity: [] });
    const sorted = sortFeedByPriority(items);
    expect(sorted[0].id).toBe("a2:opened");
  });

  it("sorts severity-less items (reused Timeline activity) after every severity-bearing item", () => {
    const items = buildOperationalFeed({ alerts: [makeAlert({ severity: "low" })], incidents: [], timelineActivity: [makeTimelineActivity()] });
    const sorted = sortFeedByPriority(items);
    expect(sorted[sorted.length - 1].category).toBe("timeline");
  });
});
