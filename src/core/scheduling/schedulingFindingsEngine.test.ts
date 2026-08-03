import { describe, expect, it } from "vitest";
import { schedulingFindingsToRecommendations } from "@/core/scheduling/schedulingFindingsEngine";
import type { SchedulingFinding, Calendar, Appointment } from "@/types/scheduling";

function makeFinding(overrides: Partial<SchedulingFinding> = {}): SchedulingFinding {
  return { id: "finding_1", type: "calendar_health", severity: "medium", description: "Low calendar health.", relatedCalendarId: null, relatedAppointmentId: null, relatedReservationId: null, ...overrides };
}

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return { id: "calendar_1", workspace_id: "ws_1", name: "Main", description: null, context_type: "team", context: { nodeType: "team", nodeId: "team_1" }, time_zone: "UTC", status: "active", created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null, ...overrides };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    title: "Consultation",
    starts_at: "2026-08-03T09:00:00.000Z",
    ends_at: "2026-08-03T10:00:00.000Z",
    status: "confirmed",
    priority: "medium",
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    client_id: null,
    worker_id: null,
    location_placeholder: null,
    preparation_minutes: 0,
    cleanup_minutes: 0,
    notes: null,
    recurrence_rule_id: null,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("schedulingFindingsToRecommendations", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings = [makeFinding({ severity: "high" }), makeFinding({ severity: "medium" }), makeFinding({ severity: "low" })];
    const result = schedulingFindingsToRecommendations(findings, [], [], "ws_1");
    expect(result.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("prefers the related appointment's context node when available", () => {
    const finding = makeFinding({ relatedAppointmentId: "appointment_1", relatedCalendarId: "calendar_1" });
    const result = schedulingFindingsToRecommendations([finding], [makeCalendar()], [makeAppointment()], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("falls back to the related calendar's context node when there is no appointment", () => {
    const finding = makeFinding({ relatedCalendarId: "calendar_1" });
    const result = schedulingFindingsToRecommendations([finding], [makeCalendar()], [], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "team", nodeId: "team_1" });
  });

  it("falls back to the workspace node when nothing else resolves", () => {
    const result = schedulingFindingsToRecommendations([makeFinding()], [], [], "ws_1");
    expect(result[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("prefixes ruleId with scheduling.", () => {
    const result = schedulingFindingsToRecommendations([makeFinding({ type: "overbooked_schedule" })], [], [], "ws_1");
    expect(result[0].ruleId).toBe("scheduling.overbooked_schedule");
  });
});
