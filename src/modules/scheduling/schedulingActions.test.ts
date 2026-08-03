import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  createCalendarAction,
  listCalendarsAction,
  getCalendarAction,
  archiveCalendarAction,
  reactivateCalendarAction,
  createAppointmentAction,
  listAppointmentsAction,
  updateAppointmentAction,
  cancelAppointmentAction,
  getCalendarViewAction,
  createReservationAction,
  listReservationsAction,
  confirmReservationAction,
  sweepExpiredReservationsAction,
  createWorkingHoursRuleAction,
  createHolidayAction,
  createCapacityRuleAction,
  evaluateWorkspaceSchedulingAction,
} from "@/modules/scheduling/schedulingActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetCalendarsStore } from "@/lib/data/mock/calendarsStore";
import { resetAppointmentsStore } from "@/lib/data/mock/appointmentsStore";
import { resetReservationsStore } from "@/lib/data/mock/reservationsStore";
import { resetCalendarWindowsStore } from "@/lib/data/mock/calendarWindowsStore";
import { resetWorkingHoursStore } from "@/lib/data/mock/workingHoursStore";
import { resetRecurrenceRulesStore } from "@/lib/data/mock/recurrenceRulesStore";
import { resetCapacityRulesStore } from "@/lib/data/mock/capacityRulesStore";
import { resetHolidaysStore } from "@/lib/data/mock/holidaysStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import type { CreateCalendarInput, CreateAppointmentInput, CreateReservationInput, CreateWorkingHoursRuleInput, CreateHolidayInput, CreateCapacityRuleInput } from "@/core/scheduling";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["scheduling.view", "scheduling.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const baseCalendarInput: CreateCalendarInput = {
  name: "Main Calendar",
  description: null,
  context_type: "team",
  context: { nodeType: "team", nodeId: "team_1" },
  time_zone: "UTC",
};

function baseAppointmentInput(calendarId: string): CreateAppointmentInput {
  return {
    calendar_id: calendarId,
    title: "Consultation",
    starts_at: "2026-08-03T10:00:00.000Z",
    ends_at: "2026-08-03T11:00:00.000Z",
    priority: "medium",
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_2" },
    client_id: null,
    worker_id: "worker_1",
    location_placeholder: null,
    preparation_minutes: 0,
    cleanup_minutes: 0,
    notes: null,
    recurrence_rule_id: null,
  };
}

function resetAll(): void {
  resetCalendarsStore();
  resetAppointmentsStore();
  resetReservationsStore();
  resetCalendarWindowsStore();
  resetWorkingHoursStore();
  resetRecurrenceRulesStore();
  resetCapacityRulesStore();
  resetHolidaysStore();
  resetKnowledgeGraphStore();
  resetTimelineStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("createCalendarAction / listCalendarsAction / getCalendarAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createCalendarAction(baseCalendarInput);
    expect(result.success).toBe(false);
  });

  it("creates a calendar as active and lists it scoped to the workspace", async () => {
    const created = await createCalendarAction(baseCalendarInput);
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data.status).toBe("active");

    const list = await listCalendarsAction();
    expect(list.success).toBe(true);
    if (list.success) expect(list.data).toHaveLength(1);
  });

  it("getCalendarAction returns an error for a calendar that doesn't exist", async () => {
    const result = await getCalendarAction("calendar_missing");
    expect(result.success).toBe(false);
  });

  it("archiveCalendarAction / reactivateCalendarAction toggle status and record calendar_updated", async () => {
    const created = await createCalendarAction(baseCalendarInput);
    if (!created.success) return;

    const archived = await archiveCalendarAction(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");

    const reactivated = await reactivateCalendarAction(created.data.id);
    expect(reactivated.success).toBe(true);
    if (reactivated.success) {
      expect(reactivated.data.status).toBe("active");
      expect(reactivated.data.archived_at).toBeNull();
    }
    expect(readActivities().filter((a) => a.type === "calendar_updated")).toHaveLength(2);
  });
});

describe("createAppointmentAction", () => {
  it("rejects when the calendar doesn't exist", async () => {
    const result = await createAppointmentAction(baseAppointmentInput("calendar_missing"));
    expect(result.success).toBe(false);
  });

  it("creates an appointment, records appointment_created, and syncs scheduled_for/belongs_to_calendar", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;

    const result = await createAppointmentAction(baseAppointmentInput(calendar.data.id));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("tentative");
    expect(readActivities().some((a) => a.type === "appointment_created")).toBe(true);

    const outbound = await getCoreKnowledgeGraphService().getOutboundRelationships("ws_1", { nodeType: "worker", nodeId: "worker_1" }, false);
    expect(outbound.some((r) => r.relationship_type === "scheduled_for" && r.target_node_id === "event_2")).toBe(true);

    const belongsTo = await getCoreKnowledgeGraphService().getOutboundRelationships("ws_1", { nodeType: "event", nodeId: "event_2" }, false);
    expect(belongsTo.some((r) => r.relationship_type === "belongs_to_calendar" && r.target_node_id === "team_1")).toBe(true);
  });

  it("rejects a genuine time_overlap conflict on the same calendar", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    const first = await createAppointmentAction(baseAppointmentInput(calendar.data.id));
    expect(first.success).toBe(true);

    const overlapping = await createAppointmentAction({ ...baseAppointmentInput(calendar.data.id), title: "Overlapping", starts_at: "2026-08-03T10:30:00.000Z", ends_at: "2026-08-03T11:30:00.000Z" });
    expect(overlapping.success).toBe(false);
  });

  it("rejects a blank title", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    const result = await createAppointmentAction({ ...baseAppointmentInput(calendar.data.id), title: "  " });
    expect(result.success).toBe(false);
  });
});

describe("listAppointmentsAction / updateAppointmentAction / cancelAppointmentAction", () => {
  it("listAppointmentsAction scopes strictly to this workspace even when filtering by calendar", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    await createAppointmentAction(baseAppointmentInput(calendar.data.id));

    const result = await listAppointmentsAction(calendar.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });

  it("updateAppointmentAction updates the title and records appointment_updated", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    const created = await createAppointmentAction(baseAppointmentInput(calendar.data.id));
    if (!created.success) return;

    const updated = await updateAppointmentAction(created.data.id, { title: "Updated Title" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.title).toBe("Updated Title");
    expect(readActivities().some((a) => a.type === "appointment_updated")).toBe(true);
  });

  it("cancelAppointmentAction sets status cancelled and records appointment_cancelled", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    const created = await createAppointmentAction(baseAppointmentInput(calendar.data.id));
    if (!created.success) return;

    const cancelled = await cancelAppointmentAction(created.data.id);
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.status).toBe("cancelled");
    expect(readActivities().some((a) => a.type === "appointment_cancelled")).toBe(true);
  });
});

describe("getCalendarViewAction", () => {
  it("returns entries for a calendar's appointments within the queried range", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    await createAppointmentAction(baseAppointmentInput(calendar.data.id));

    const result = await getCalendarViewAction(calendar.data.id, "weekly", "2026-08-01T00:00:00.000Z", "2026-08-07T00:00:00.000Z");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.entries).toHaveLength(1);
  });

  it("rejects a calendar that doesn't exist", async () => {
    const result = await getCalendarViewAction("calendar_missing", "weekly", "2026-08-01T00:00:00.000Z", "2026-08-07T00:00:00.000Z");
    expect(result.success).toBe(false);
  });
});

describe("createReservationAction / confirmReservationAction / sweepExpiredReservationsAction", () => {
  const baseReservationInput: CreateReservationInput = {
    calendar_id: "calendar_1",
    resource_type: "equipment",
    resource_id: "equipment_1",
    starts_at: "2026-08-03T10:00:00.000Z",
    ends_at: "2026-08-03T11:00:00.000Z",
    source: "manual",
    priority: "medium",
    hold_expires_at: "2026-08-03T10:30:00.000Z",
    appointment_id: null,
  };

  it("creates a held reservation and records reservation_created", async () => {
    const result = await createReservationAction(baseReservationInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("held");
    expect(readActivities().some((a) => a.type === "reservation_created")).toBe(true);
  });

  it("rejects a conflicting reservation for the same resource and overlapping time", async () => {
    const first = await createReservationAction(baseReservationInput);
    expect(first.success).toBe(true);
    const conflicting = await createReservationAction({ ...baseReservationInput, starts_at: "2026-08-03T10:15:00.000Z", ends_at: "2026-08-03T10:45:00.000Z" });
    expect(conflicting.success).toBe(false);
  });

  it("confirmReservationAction confirms a still-valid hold and records reservation_confirmed", async () => {
    const created = await createReservationAction(baseReservationInput);
    if (!created.success) return;
    const confirmed = await confirmReservationAction(created.data.id);
    expect(confirmed.success).toBe(true);
    if (confirmed.success) expect(confirmed.data.status).toBe("confirmed");
    expect(readActivities().some((a) => a.type === "reservation_confirmed")).toBe(true);
  });

  it("sweepExpiredReservationsAction marks a lapsed hold as expired and records reservation_expired", async () => {
    const created = await createReservationAction({ ...baseReservationInput, hold_expires_at: "2020-01-01T00:00:00.000Z" });
    if (!created.success) return;

    const result = await sweepExpiredReservationsAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("expired");
    }
    expect(readActivities().some((a) => a.type === "reservation_expired")).toBe(true);
  });

  it("listReservationsAction scopes strictly to this workspace", async () => {
    await createReservationAction(baseReservationInput);
    const result = await listReservationsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("configuration actions (working hours / holidays / capacity)", () => {
  it("createWorkingHoursRuleAction creates a rule", async () => {
    const input: CreateWorkingHoursRuleInput = { calendar_id: "calendar_1", kind: "regular", day_of_week: 1, specific_date: null, starts_time: "09:00", ends_time: "17:00", time_zone: "UTC", is_closed: false };
    const result = await createWorkingHoursRuleAction(input);
    expect(result.success).toBe(true);
  });

  it("createHolidayAction creates a holiday", async () => {
    const input: CreateHolidayInput = { name: "Founders Day", scope: "workspace", date: "2026-08-03", recurring: false, emergency: false, time_zone: "UTC" };
    const result = await createHolidayAction(input);
    expect(result.success).toBe(true);
  });

  it("createCapacityRuleAction creates a rule", async () => {
    const input: CreateCapacityRuleInput = { scope: "team", scope_id: "team_1", window: "time_window", max_concurrent: 2 };
    const result = await createCapacityRuleAction(input);
    expect(result.success).toBe(true);
  });
});

describe("evaluateWorkspaceSchedulingAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await evaluateWorkspaceSchedulingAction();
    expect(result.success).toBe(false);
  });

  it("returns a coherent, empty result for an empty workspace", async () => {
    const result = await evaluateWorkspaceSchedulingAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.calendars).toEqual([]);
    expect(result.data.findings).toEqual([]);
  });

  it("computes a SchedulingScores entry per calendar", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    await createAppointmentAction(baseAppointmentInput(calendar.data.id));

    const result = await evaluateWorkspaceSchedulingAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scoresByCalendarId[calendar.data.id]).toBeDefined();
    expect(typeof result.data.scoresByCalendarId[calendar.data.id].calendarHealthScore).toBe("number");
  });

  it("flags an unavailable_time_window finding when an appointment has no matching working hours rule", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    if (!calendar.success) return;
    await createAppointmentAction(baseAppointmentInput(calendar.data.id));

    const result = await evaluateWorkspaceSchedulingAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.findings.some((f) => f.type === "unavailable_time_window")).toBe(true);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutation for a session with no scheduling.manage permission", async () => {
    const calendar = await createCalendarAction(baseCalendarInput);
    expect(calendar.success).toBe(true);
    if (!calendar.success) return;
    const appointment = await createAppointmentAction(baseAppointmentInput(calendar.data.id));
    expect(appointment.success).toBe(true);
    if (!appointment.success) return;
    const reservation = await createReservationAction({ calendar_id: calendar.data.id, resource_type: "equipment", resource_id: "equipment_1", starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", source: "manual", priority: "medium", hold_expires_at: null, appointment_id: null });
    expect(reservation.success).toBe(true);
    if (!reservation.success) return;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: ["scheduling.view"] });

    expect((await createCalendarAction(baseCalendarInput)).success).toBe(false);
    expect((await archiveCalendarAction(calendar.data.id)).success).toBe(false);
    expect((await reactivateCalendarAction(calendar.data.id)).success).toBe(false);
    expect((await createAppointmentAction(baseAppointmentInput(calendar.data.id))).success).toBe(false);
    expect((await updateAppointmentAction(appointment.data.id, { title: "Blocked" })).success).toBe(false);
    expect((await cancelAppointmentAction(appointment.data.id)).success).toBe(false);
    expect((await createReservationAction({ calendar_id: calendar.data.id, resource_type: "equipment", resource_id: "equipment_2", starts_at: "2026-08-03T12:00:00.000Z", ends_at: "2026-08-03T13:00:00.000Z", source: "manual", priority: "medium", hold_expires_at: null, appointment_id: null })).success).toBe(false);
    expect((await confirmReservationAction(reservation.data.id)).success).toBe(false);
    expect((await sweepExpiredReservationsAction()).success).toBe(false);
    expect((await createWorkingHoursRuleAction({ calendar_id: calendar.data.id, kind: "regular", day_of_week: 1, specific_date: null, starts_time: "09:00", ends_time: "17:00", time_zone: "UTC", is_closed: false })).success).toBe(false);
    expect((await createHolidayAction({ name: "Blocked Holiday", scope: "workspace", date: "2026-12-25", recurring: false, emergency: false, time_zone: "UTC" })).success).toBe(false);
    expect((await createCapacityRuleAction({ scope: "workspace", scope_id: null, window: "day", max_concurrent: 5 })).success).toBe(false);
  });
});
