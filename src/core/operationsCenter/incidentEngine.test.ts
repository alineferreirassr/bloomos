import { describe, expect, it } from "vitest";
import { groupCriticalAlerts, buildIncidentFromAlerts } from "@/core/operationsCenter/incidentEngine";
import type { OperationalAlert } from "@/types/operationsCenter";

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
  return {
    id: "operational_alert_1",
    workspace_id: "ws_1",
    rule_id: "field_operations.operation_blocked",
    category: "field_operations",
    severity: "critical",
    title: "Field operation blocked",
    description: "Field operation field_operation_1 is blocked.",
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
    dedupe_key: "field_operations.operation_blocked:field_operation_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("groupCriticalAlerts", () => {
  it("does not group when fewer than 2 critical alerts are open", () => {
    expect(groupCriticalAlerts([makeAlert()])).toEqual([]);
  });

  it("groups 2+ open critical alerts into one cluster", () => {
    const alerts = [makeAlert({ id: "a1" }), makeAlert({ id: "a2", source_record_id: "field_operation_2" })];
    const groups = groupCriticalAlerts(alerts);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("ignores resolved/dismissed alerts even if critical", () => {
    const alerts = [makeAlert({ id: "a1", status: "resolved" }), makeAlert({ id: "a2", status: "dismissed" }), makeAlert({ id: "a3" })];
    expect(groupCriticalAlerts(alerts)).toEqual([]);
  });

  it("does not group non-critical alerts regardless of count", () => {
    const alerts = [makeAlert({ id: "a1", severity: "high" }), makeAlert({ id: "a2", severity: "high" })];
    expect(groupCriticalAlerts(alerts)).toEqual([]);
  });
});

describe("buildIncidentFromAlerts", () => {
  it("collects every alert's own id into source_alert_ids and takes the highest severity present", () => {
    const alerts = [makeAlert({ id: "a1", severity: "high" }), makeAlert({ id: "a2", severity: "critical" })];
    const input = buildIncidentFromAlerts(alerts);
    expect(input.source_alert_ids).toEqual(["a1", "a2"]);
    expect(input.severity).toBe("critical");
  });

  it("populates related_field_operation_ids only from field_operations-category alerts, and related_route_plan_ids only from route_optimization ones", () => {
    const alerts = [
      makeAlert({ id: "a1", category: "field_operations", source_record_id: "fo_1" }),
      makeAlert({ id: "a2", category: "route_optimization", source_record_id: "rp_1" }),
      makeAlert({ id: "a3", category: "dispatch", source_record_id: "assignment_1" }),
    ];
    const input = buildIncidentFromAlerts(alerts);
    expect(input.related_field_operation_ids).toEqual(["fo_1"]);
    expect(input.related_route_plan_ids).toEqual(["rp_1"]);
    expect(input.related_dispatch_order_ids).toEqual([]);
  });

  it("uses the single alert's own title verbatim when only one alert is grouped", () => {
    const input = buildIncidentFromAlerts([makeAlert({ title: "Field operation blocked" })]);
    expect(input.title).toBe("Field operation blocked");
  });
});
