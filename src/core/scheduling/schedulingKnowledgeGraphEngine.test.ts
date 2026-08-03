import { describe, expect, it } from "vitest";
import { buildScheduledForRelationship, buildReservedForRelationship, buildConflictsWithRelationship, buildBelongsToCalendarRelationship } from "@/core/scheduling/schedulingKnowledgeGraphEngine";

const EVENT_CONTEXT = { nodeType: "event" as const, nodeId: "event_1" };
const OTHER_EVENT_CONTEXT = { nodeType: "event" as const, nodeId: "event_2" };
const TEAM_CONTEXT = { nodeType: "team" as const, nodeId: "team_1" };

describe("buildScheduledForRelationship", () => {
  it("builds worker -> appointment context", () => {
    const result = buildScheduledForRelationship({ worker_id: "worker_1", context: EVENT_CONTEXT });
    expect(result).toEqual({ sourceNode: { nodeType: "worker", nodeId: "worker_1" }, targetNode: EVENT_CONTEXT, relationshipType: "scheduled_for" });
  });

  it("is null when no worker is assigned", () => {
    expect(buildScheduledForRelationship({ worker_id: null, context: EVENT_CONTEXT })).toBeNull();
  });

  it("is null when the appointment has no real context node", () => {
    expect(buildScheduledForRelationship({ worker_id: "worker_1", context: null })).toBeNull();
  });
});

describe("buildReservedForRelationship", () => {
  it("builds resource -> appointment context for equipment", () => {
    const result = buildReservedForRelationship({ resource_type: "equipment", resource_id: "equipment_1" }, { context: EVENT_CONTEXT });
    expect(result).toEqual({ sourceNode: { nodeType: "equipment", nodeId: "equipment_1" }, targetNode: EVENT_CONTEXT, relationshipType: "reserved_for" });
  });

  it("is null when there is no linked appointment", () => {
    expect(buildReservedForRelationship({ resource_type: "equipment", resource_id: "equipment_1" }, null)).toBeNull();
  });

  it("is null when the linked appointment has no real context node", () => {
    expect(buildReservedForRelationship({ resource_type: "equipment", resource_id: "equipment_1" }, { context: null })).toBeNull();
  });

  it("is null for an asset resource_type, which has no matching node type", () => {
    expect(buildReservedForRelationship({ resource_type: "asset", resource_id: "asset_1" }, { context: EVENT_CONTEXT })).toBeNull();
  });
});

describe("buildConflictsWithRelationship", () => {
  it("orders the relationship from the earlier appointment to the later one", () => {
    const later = { starts_at: "2026-08-03T11:00:00.000Z", context: OTHER_EVENT_CONTEXT };
    const earlier = { starts_at: "2026-08-03T10:00:00.000Z", context: EVENT_CONTEXT };
    const result = buildConflictsWithRelationship(later, earlier);
    expect(result).toEqual({ sourceNode: EVENT_CONTEXT, targetNode: OTHER_EVENT_CONTEXT, relationshipType: "conflicts_with" });
  });

  it("is null when either side has no real context node", () => {
    expect(buildConflictsWithRelationship({ starts_at: "2026-08-03T10:00:00.000Z", context: null }, { starts_at: "2026-08-03T11:00:00.000Z", context: EVENT_CONTEXT })).toBeNull();
  });
});

describe("buildBelongsToCalendarRelationship", () => {
  it("builds appointment context -> calendar context", () => {
    const result = buildBelongsToCalendarRelationship({ context: EVENT_CONTEXT }, { context: TEAM_CONTEXT });
    expect(result).toEqual({ sourceNode: EVENT_CONTEXT, targetNode: TEAM_CONTEXT, relationshipType: "belongs_to_calendar" });
  });

  it("is null when the calendar has no real context node", () => {
    expect(buildBelongsToCalendarRelationship({ context: EVENT_CONTEXT }, { context: null })).toBeNull();
  });
});
