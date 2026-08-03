import { describe, expect, it } from "vitest";
import { isUpcomingAssignment, filterAssignmentRows, sortAssignmentsUpcomingFirst, DEFAULT_ASSIGNMENT_FILTERS } from "@/modules/services/assignmentFiltering";
import { makeEventService, makeEvent, makeClient } from "@/modules/services/testUtils";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

const NOW = new Date("2026-03-01T00:00:00.000Z");

function row(overrides: Partial<ServiceAssignmentRow> = {}): ServiceAssignmentRow {
  return {
    eventService: makeEventService(),
    event: makeEvent(),
    client: makeClient(),
    versionNumber: 1,
    isNameOverridden: false,
    isPriceOverridden: false,
    team: { resolved: 1, total: 2 },
    completion: { resolved: 2, total: 4 },
    ...overrides,
  };
}

describe("isUpcomingAssignment", () => {
  it("treats a null event_date as upcoming rather than guessing", () => {
    expect(isUpcomingAssignment(null, NOW)).toBe(true);
  });

  it("treats today and future dates as upcoming", () => {
    expect(isUpcomingAssignment("2026-03-01", NOW)).toBe(true);
    expect(isUpcomingAssignment("2026-06-15", NOW)).toBe(true);
  });

  it("treats a date before today as past", () => {
    expect(isUpcomingAssignment("2026-01-01", NOW)).toBe(false);
  });
});

describe("filterAssignmentRows", () => {
  const upcoming = row({ event: makeEvent({ id: "event_1", title: "Amelia's Wedding", event_date: "2026-06-15" }), client: makeClient({ first_name: "Amelia", last_name: "Carter" }) });
  const past = row({
    eventService: makeEventService({ id: "es_2", status: "cancelled" }),
    event: makeEvent({ id: "event_2", title: "Liam's Birthday", event_date: "2025-01-01" }),
    client: makeClient({ first_name: "Liam", last_name: "Chen" }),
    versionNumber: 2,
    team: { resolved: 0, total: 0 },
  });
  const rows = [upcoming, past];

  it("filters by status", () => {
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, status: "cancelled" }, NOW)).toEqual([past]);
  });

  it("filters by timing", () => {
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, timing: "upcoming" }, NOW)).toEqual([upcoming]);
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, timing: "past" }, NOW)).toEqual([past]);
  });

  it("filters by assigned version", () => {
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, versionNumber: 2 }, NOW)).toEqual([past]);
  });

  it("filters by search across Event title and Client name, case-insensitively", () => {
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, search: "liam" }, NOW)).toEqual([past]);
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, search: "wedding" }, NOW)).toEqual([upcoming]);
  });

  it("excludes rows with no team requirements from either half of the team filter", () => {
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, team: "fully_assigned" }, NOW)).toEqual([]);
    expect(filterAssignmentRows(rows, { ...DEFAULT_ASSIGNMENT_FILTERS, team: "needs_assignment" }, NOW)).toEqual([upcoming]);
  });

  it("returns every row when filters are all default", () => {
    expect(filterAssignmentRows(rows, DEFAULT_ASSIGNMENT_FILTERS, NOW)).toEqual(rows);
  });

  it("hides assignments belonging to an archived Event by default, and reveals them when includeArchived is set", () => {
    const archived = row({
      eventService: makeEventService({ id: "es_3" }),
      event: makeEvent({ id: "event_3", title: "Noah's Anniversary", status: "archived", event_date: "2026-07-01" }),
      client: makeClient({ first_name: "Noah", last_name: "Diaz" }),
    });
    const rowsWithArchived = [...rows, archived];
    expect(filterAssignmentRows(rowsWithArchived, DEFAULT_ASSIGNMENT_FILTERS, NOW)).toEqual(rows);
    expect(filterAssignmentRows(rowsWithArchived, { ...DEFAULT_ASSIGNMENT_FILTERS, includeArchived: true }, NOW)).toEqual(rowsWithArchived);
  });
});

describe("sortAssignmentsUpcomingFirst", () => {
  it("puts every upcoming row before every past row, regardless of raw date magnitude", () => {
    const farUpcoming = row({ event: makeEvent({ id: "e1", event_date: "2026-12-25" }) });
    const recentPast = row({ event: makeEvent({ id: "e2", event_date: "2026-02-15" }) });
    expect(sortAssignmentsUpcomingFirst([recentPast, farUpcoming], NOW)).toEqual([farUpcoming, recentPast]);
  });

  it("within the upcoming group, sorts nearest event first — a nearer date outranks a farther one", () => {
    const soon = row({ event: makeEvent({ id: "e1", event_date: "2026-03-15" }) });
    const far = row({ event: makeEvent({ id: "e2", event_date: "2026-08-01" }) });
    expect(sortAssignmentsUpcomingFirst([far, soon], NOW)).toEqual([soon, far]);
  });

  it("within the past group, sorts most recent event first", () => {
    const recent = row({ event: makeEvent({ id: "e1", event_date: "2026-02-15" }) });
    const older = row({ event: makeEvent({ id: "e2", event_date: "2025-01-01" }) });
    expect(sortAssignmentsUpcomingFirst([older, recent], NOW)).toEqual([recent, older]);
  });

  it("sorts an undated Event (always upcoming) after every dated upcoming Event", () => {
    const dated = row({ event: makeEvent({ id: "e1", event_date: "2026-03-15" }) });
    const undated = row({ event: makeEvent({ id: "e2", event_date: null }) });
    expect(sortAssignmentsUpcomingFirst([undated, dated], NOW)).toEqual([dated, undated]);
  });

  it("breaks ties among undated Events by assigned_at descending", () => {
    const olderAssignment = row({
      eventService: makeEventService({ id: "es_1", assigned_at: "2026-01-01T00:00:00.000Z" }),
      event: makeEvent({ id: "e1", event_date: null }),
    });
    const newerAssignment = row({
      eventService: makeEventService({ id: "es_2", assigned_at: "2026-02-01T00:00:00.000Z" }),
      event: makeEvent({ id: "e2", event_date: null }),
    });
    expect(sortAssignmentsUpcomingFirst([olderAssignment, newerAssignment], NOW)).toEqual([newerAssignment, olderAssignment]);
  });
});
