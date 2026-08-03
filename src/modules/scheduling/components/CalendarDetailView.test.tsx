import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDetailView } from "@/modules/scheduling/components/CalendarDetailView";
import type { EvaluateWorkspaceSchedulingResult } from "@/modules/scheduling/schedulingActions";
import type { Calendar, Appointment, CalendarView, SchedulingScores } from "@/types/scheduling";

vi.mock("@/modules/scheduling/schedulingActions", () => ({
  getCalendarAction: vi.fn(),
  getCalendarViewAction: vi.fn(),
  listReservationsAction: vi.fn(),
  listWorkingHoursRulesAction: vi.fn(),
  listCalendarWindowsAction: vi.fn(),
  evaluateWorkspaceSchedulingAction: vi.fn(),
}));

import { getCalendarAction, getCalendarViewAction, listReservationsAction, listWorkingHoursRulesAction, listCalendarWindowsAction, evaluateWorkspaceSchedulingAction } from "@/modules/scheduling/schedulingActions";

const NOW = "2026-01-01T00:00:00.000Z";
const PERFECT_SCORES: SchedulingScores = { windowQualityScore: 100, bufferQualityScore: 100, capacityUtilizationScore: 100, conflictSeverityScore: 100, scheduleDensityScore: 50, calendarHealthScore: 90 };

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return { id: "calendar_1", workspace_id: "ws_1", name: "Main Calendar", description: null, context_type: "workspace", context: null, time_zone: "UTC", status: "active", created_by: "member_1", created_at: NOW, updated_at: NOW, archived_at: null, ...overrides };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    title: "Consultation",
    starts_at: "2026-08-03T10:00:00.000Z",
    ends_at: "2026-08-03T11:00:00.000Z",
    status: "confirmed",
    priority: "medium",
    context_type: "custom",
    context: null,
    client_id: null,
    worker_id: null,
    location_placeholder: null,
    preparation_minutes: 0,
    cleanup_minutes: 0,
    notes: null,
    recurrence_rule_id: null,
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeView(entries: CalendarView["entries"] = []): CalendarView {
  return { calendarId: "calendar_1", granularity: "weekly", rangeStart: "2026-08-01T00:00:00.000Z", rangeEnd: "2026-08-14T00:00:00.000Z", entries };
}

function mockAllSucceed(overrides: { view?: CalendarView; evalResult?: EvaluateWorkspaceSchedulingResult } = {}) {
  vi.mocked(getCalendarAction).mockResolvedValue({ success: true, data: makeCalendar() });
  vi.mocked(getCalendarViewAction).mockResolvedValue({ success: true, data: overrides.view ?? makeView() });
  vi.mocked(listReservationsAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(listWorkingHoursRulesAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(listCalendarWindowsAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(evaluateWorkspaceSchedulingAction).mockResolvedValue({ success: true, data: overrides.evalResult ?? { calendars: [makeCalendar()], scoresByCalendarId: { calendar_1: PERFECT_SCORES }, findings: [] } });
}

beforeEach(() => {
  vi.mocked(getCalendarAction).mockReset();
  vi.mocked(getCalendarViewAction).mockReset();
  vi.mocked(listReservationsAction).mockReset();
  vi.mocked(listWorkingHoursRulesAction).mockReset();
  vi.mocked(listCalendarWindowsAction).mockReset();
  vi.mocked(evaluateWorkspaceSchedulingAction).mockReset();
});

describe("CalendarDetailView", () => {
  it("renders the calendar name, KPI cards, and its schedule quality once data resolves", async () => {
    mockAllSucceed({ view: makeView([{ appointment: makeAppointment(), isRecurringInstance: false, recurrenceRuleId: null }]) });
    render(<CalendarDetailView calendarId="calendar_1" />);

    expect(await screen.findByRole("heading", { name: "Main Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.getByText("Schedule Quality")).toBeInTheDocument();
  });

  it("renders an error state when the calendar doesn't exist", async () => {
    vi.mocked(getCalendarAction).mockResolvedValue({ success: false, error: "This calendar could not be found." });
    render(<CalendarDetailView calendarId="calendar_missing" />);
    expect(await screen.findByText("This calendar could not be found.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no upcoming appointments", async () => {
    mockAllSucceed();
    render(<CalendarDetailView calendarId="calendar_1" />);
    expect(await screen.findByText("No upcoming appointments")).toBeInTheDocument();
  });
});
