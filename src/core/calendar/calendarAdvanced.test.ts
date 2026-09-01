import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getEvents: vi.fn(),
  getChecklistByEventId: vi.fn(),
}));

import { getRangeForView, goToNext, goToPrevious } from "@/core/calendar/navigation";
import { dateKey, eventDateKey, groupEventsByDate, formatEventTime } from "@/modules/calendar/components/calendarFormat";
import { createEventsCalendarSource } from "@/core/calendar/sources/eventsCalendarSource";
import { createTaskCalendarSource } from "@/core/calendar/sources/taskCalendarSource";
import { getEvents, getChecklistByEventId } from "@/lib/data";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { CalendarEvent } from "@/types/calendarEvent";

const mockGetEvents = vi.mocked(getEvents);
const mockGetChecklistByEventId = vi.mocked(getChecklistByEventId);

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    originating_lead_id: null,
    title: "Malibu Sunset Wedding",
    event_type: "micro_wedding",
    status: "confirmed",
    lifecycle_stage: "planning",
    event_date: "2026-08-20",
    start_time: "14:00",
    end_time: "22:00",
    timezone: "America/Los_Angeles",
    location_name: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    latitude: null,
    longitude: null,
    guest_count: null,
    budget_min: null,
    budget_max: null,
    package_name: null,
    theme: null,
    color_palette: null,
    surprise_event: false,
    confidentiality_notes: null,
    accessibility_notes: null,
    dietary_notes: null,
    weather_plan: null,
    backup_location: null,
    internal_summary: null,
    assigned_owner: "Marina Costa",
    priority: "high",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function makeChecklistItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "checklist_1",
    workspace_id: "ws_1",
    owner_type: "event",
    owner_id: "event_1",
    title: "Confirm florist delivery window",
    description: null,
    category: "flowers",
    priority: "normal",
    status: "pending",
    due_date: "2026-08-18",
    completed_at: null,
    assigned_type: "employee",
    assigned_id: null,
    assigned_name: "Ana Ferreira",
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("core/calendar navigation — agenda view", () => {
  it("covers a rolling 14-day window starting at the anchor date", () => {
    const anchor = new Date(2026, 7, 15);
    const range = getRangeForView(anchor, "agenda");
    expect(range.start).toEqual(new Date(2026, 7, 15));
    expect(range.end).toEqual(new Date(2026, 7, 29));
  });

  it("advances and retreats by 14 days", () => {
    const anchor = new Date(2026, 7, 15);
    expect(goToNext(anchor, "agenda")).toEqual(new Date(2026, 7, 29));
    expect(goToPrevious(anchor, "agenda")).toEqual(new Date(2026, 7, 1));
  });
});

describe("modules/calendar calendarFormat", () => {
  it("builds a local YYYY-MM-DD key, never shifting via UTC", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("reads the date straight from a CalendarEvent's start string", () => {
    const event = { start: "2026-08-20T14:00:00" } as CalendarEvent;
    expect(eventDateKey(event)).toBe("2026-08-20");
  });

  it("groups and sorts events by date", () => {
    const events = [
      { id: "b", start: "2026-08-20T18:00:00" } as CalendarEvent,
      { id: "a", start: "2026-08-20T09:00:00" } as CalendarEvent,
      { id: "c", start: "2026-08-21T09:00:00" } as CalendarEvent,
    ];
    const grouped = groupEventsByDate(events);
    expect([...grouped.keys()].sort()).toEqual(["2026-08-20", "2026-08-21"]);
    expect(grouped.get("2026-08-20")!.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("formats a timed entry in 12-hour clock and an all-day entry as 'All day'", () => {
    expect(formatEventTime("2026-08-20T14:05:00", false)).toBe("2:05 PM");
    expect(formatEventTime("2026-08-20T00:00:00", true)).toBe("All day");
  });
});

describe("eventsCalendarSource", () => {
  it("maps active, in-range events into CalendarEvent, classified as 'event'", async () => {
    mockGetEvents.mockResolvedValue([
      makeEvent(),
      makeEvent({ id: "event_2", event_date: "2026-09-01" }), // outside range
      makeEvent({ id: "event_3", archived_at: "2026-01-02T00:00:00.000Z" }), // archived
      makeEvent({ id: "event_4", workspace_id: "ws_other" }), // different workspace
    ]);

    const source = createEventsCalendarSource();
    const range = { start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) };
    const result = await source.fetch(range, "ws_1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "event:event_1",
      title: "Malibu Sunset Wedding",
      start: "2026-08-20T14:00:00",
      end: "2026-08-20T22:00:00",
      allDay: false,
      category: "event",
      href: "/events/event_1",
      assignedName: "Marina Costa",
    });
  });
});

describe("taskCalendarSource", () => {
  it("classifies high/critical-priority dated items as 'deadline' and the rest as 'task'", async () => {
    mockGetEvents.mockResolvedValue([makeEvent()]);
    mockGetChecklistByEventId.mockResolvedValue([
      makeChecklistItem({ id: "item_normal", priority: "normal", due_date: "2026-08-19" }),
      makeChecklistItem({ id: "item_high", priority: "high", due_date: "2026-08-19" }),
      makeChecklistItem({ id: "item_no_due_date", due_date: null }),
      makeChecklistItem({ id: "item_completed", status: "completed", due_date: "2026-08-19" }),
    ]);

    const source = createTaskCalendarSource();
    const range = { start: new Date(2026, 7, 1), end: new Date(2026, 7, 31) };
    const result = await source.fetch(range, "ws_1");

    expect(result).toHaveLength(2);
    const byId = Object.fromEntries(result.map((e) => [e.sourceId, e]));
    expect(byId["item_normal"].category).toBe("task");
    expect(byId["item_high"].category).toBe("deadline");
    expect(byId["item_normal"].href).toBe("/events/event_1/checklist");
    expect(byId["item_normal"].allDay).toBe(true);
  });
});
