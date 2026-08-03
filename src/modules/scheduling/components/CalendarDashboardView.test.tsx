import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalendarDashboardView } from "@/modules/scheduling/components/CalendarDashboardView";
import type { EvaluateWorkspaceSchedulingResult } from "@/modules/scheduling/schedulingActions";
import type { Calendar, SchedulingScores } from "@/types/scheduling";

vi.mock("@/modules/scheduling/schedulingActions", () => ({
  listCalendarsAction: vi.fn(),
  listAppointmentsAction: vi.fn(),
  listReservationsAction: vi.fn(),
  listCalendarWindowsAction: vi.fn(),
  listHolidaysAction: vi.fn(),
  evaluateWorkspaceSchedulingAction: vi.fn(),
}));

import { listCalendarsAction, listAppointmentsAction, listReservationsAction, listCalendarWindowsAction, listHolidaysAction, evaluateWorkspaceSchedulingAction } from "@/modules/scheduling/schedulingActions";

const NOW = "2026-01-01T00:00:00.000Z";
const PERFECT_SCORES: SchedulingScores = { windowQualityScore: 100, bufferQualityScore: 100, capacityUtilizationScore: 100, conflictSeverityScore: 100, scheduleDensityScore: 50, calendarHealthScore: 90 };

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return { id: "calendar_1", workspace_id: "ws_1", name: "Main Calendar", description: null, context_type: "workspace", context: null, time_zone: "UTC", status: "active", created_by: "member_1", created_at: NOW, updated_at: NOW, archived_at: null, ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateWorkspaceSchedulingResult> = {}) {
  vi.mocked(listCalendarsAction).mockResolvedValue({ success: true, data: [makeCalendar()] });
  vi.mocked(listAppointmentsAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(listReservationsAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(listCalendarWindowsAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(listHolidaysAction).mockResolvedValue({ success: true, data: [] });
  vi.mocked(evaluateWorkspaceSchedulingAction).mockResolvedValue({ success: true, data: { calendars: [makeCalendar()], scoresByCalendarId: { calendar_1: PERFECT_SCORES }, findings: [], ...overrides } });
}

beforeEach(() => {
  vi.mocked(listCalendarsAction).mockReset();
  vi.mocked(listAppointmentsAction).mockReset();
  vi.mocked(listReservationsAction).mockReset();
  vi.mocked(listCalendarWindowsAction).mockReset();
  vi.mocked(listHolidaysAction).mockReset();
  vi.mocked(evaluateWorkspaceSchedulingAction).mockReset();
});

describe("CalendarDashboardView", () => {
  it("renders KPI cards and the calendar list once data resolves", async () => {
    mockAllSucceed();
    render(<CalendarDashboardView />);

    expect(await screen.findByText("Main Calendar")).toBeInTheDocument();
    expect(screen.getAllByText("Calendars").length).toBeGreaterThan(0);
    expect(screen.getByText("No high-severity scheduling findings.")).toBeInTheDocument();
  });

  it("renders an error state when the evaluation action fails", async () => {
    vi.mocked(listCalendarsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listAppointmentsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listReservationsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listCalendarWindowsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listHolidaysAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateWorkspaceSchedulingAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<CalendarDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "overbooked_schedule", severity: "high", description: '"Main Calendar" is overbooked.', relatedCalendarId: "calendar_1", relatedAppointmentId: null, relatedReservationId: null }] });
    render(<CalendarDashboardView />);
    expect(await screen.findByText('"Main Calendar" is overbooked.')).toBeInTheDocument();
  });

  it("shows an empty state when there are no calendars", async () => {
    vi.mocked(listCalendarsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listAppointmentsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listReservationsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listCalendarWindowsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listHolidaysAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateWorkspaceSchedulingAction).mockResolvedValue({ success: true, data: { calendars: [], scoresByCalendarId: {}, findings: [] } });

    render(<CalendarDashboardView />);
    expect(await screen.findByText("No calendars yet")).toBeInTheDocument();
  });
});
