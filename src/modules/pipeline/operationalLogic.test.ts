import { describe, expect, it } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import type { OperationalCardData } from "@/modules/pipeline/operationalLogic";
import {
  EMPTY_OPERATIONAL_FILTERS,
  collectOwners,
  filterOperationalCards,
  getDaysUntilEventDate,
  groupCardsByColumn,
} from "@/modules/pipeline/operationalLogic";

function makeCard(overrides: Partial<OperationalCardData> = {}): OperationalCardData {
  return {
    event: makeEvent(),
    client: makeClient(),
    checklistTotal: 0,
    checklistCompleted: 0,
    checklistOverdue: 0,
    scheduleTotal: 0,
    scheduleCompleted: 0,
    nextAction: null,
    healthStatus: "ready",
    daysUntilEvent: null,
    ...overrides,
  };
}

describe("groupCardsByColumn", () => {
  it("buckets each card under its event's lifecycle_stage", () => {
    const cards = [
      makeCard({ event: makeEvent({ id: "e1", lifecycle_stage: "intake" }) }),
      makeCard({ event: makeEvent({ id: "e2", lifecycle_stage: "planning" }) }),
      makeCard({ event: makeEvent({ id: "e3", lifecycle_stage: "intake" }) }),
    ];
    const columns = groupCardsByColumn(cards);
    expect(columns.intake.map((c) => c.event.id).sort()).toEqual(["e1", "e3"]);
    expect(columns.planning.map((c) => c.event.id)).toEqual(["e2"]);
  });

  it("gives every canonical lifecycle stage its own bucket even when empty", () => {
    const columns = groupCardsByColumn([]);
    expect(columns.closed).toEqual([]);
    expect(columns.execution).toEqual([]);
  });
});

describe("filterOperationalCards", () => {
  const cards = [
    makeCard({
      event: makeEvent({ id: "e1", title: "Priya's Wedding", event_type: "micro_wedding", priority: "high", assigned_owner: "Jamie" }),
      client: makeClient({ first_name: "Priya", last_name: "Nair" }),
      checklistOverdue: 2,
      daysUntilEvent: 3,
      healthStatus: "blocked",
    }),
    makeCard({
      event: makeEvent({ id: "e2", title: "Corporate Gala", event_type: "branding", priority: "normal", assigned_owner: "Alex" }),
      client: makeClient({ first_name: "Sam", last_name: "Ortiz" }),
      checklistOverdue: 0,
      daysUntilEvent: 30,
      healthStatus: "ready",
    }),
    makeCard({
      event: makeEvent({ id: "e3", title: "Chen Anniversary", event_type: "anniversary", priority: "normal", assigned_owner: null }),
      client: makeClient({ first_name: "Priya", last_name: "Chen" }),
      checklistOverdue: 0,
      daysUntilEvent: -2,
      healthStatus: "waiting",
    }),
  ];

  it("matches by event title or client name substring, case-insensitive", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, search: "priya" });
    expect(result.map((c) => c.event.id).sort()).toEqual(["e1", "e3"]);
  });

  it("filters by eventType", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, eventType: "branding" });
    expect(result.map((c) => c.event.id)).toEqual(["e2"]);
  });

  it("filters by priority", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, priority: "high" });
    expect(result.map((c) => c.event.id)).toEqual(["e1"]);
  });

  it("filters by a specific owner", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, owner: "Alex" });
    expect(result.map((c) => c.event.id)).toEqual(["e2"]);
  });

  it("filters unassigned owner via the 'unassigned' sentinel", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, owner: "unassigned" });
    expect(result.map((c) => c.event.id)).toEqual(["e3"]);
  });

  it("filters by healthStatus", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, healthStatus: "blocked" });
    expect(result.map((c) => c.event.id)).toEqual(["e1"]);
  });

  it("filters to only cards with overdue checklist items", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, overdueOnly: true });
    expect(result.map((c) => c.event.id)).toEqual(["e1"]);
  });

  it("filters to only cards within the next 7 days, excluding past-due and far-future", () => {
    const result = filterOperationalCards(cards, { ...EMPTY_OPERATIONAL_FILTERS, upcomingOnly: true });
    expect(result.map((c) => c.event.id)).toEqual(["e1"]);
  });

  it("excludes cards with no event date at all when upcomingOnly is active", () => {
    const noDateCard = makeCard({ event: makeEvent({ id: "e4" }), daysUntilEvent: null });
    const result = filterOperationalCards([...cards, noDateCard], { ...EMPTY_OPERATIONAL_FILTERS, upcomingOnly: true });
    expect(result.some((c) => c.event.id === "e4")).toBe(false);
  });

  it("returns everything when no filters are active", () => {
    expect(filterOperationalCards(cards, EMPTY_OPERATIONAL_FILTERS)).toHaveLength(3);
  });
});

describe("collectOwners", () => {
  it("returns distinct, sorted, non-null owners", () => {
    const cards = [
      makeCard({ event: makeEvent({ assigned_owner: "Jamie" }) }),
      makeCard({ event: makeEvent({ assigned_owner: "Alex" }) }),
      makeCard({ event: makeEvent({ assigned_owner: "Jamie" }) }),
      makeCard({ event: makeEvent({ assigned_owner: null }) }),
    ];
    expect(collectOwners(cards)).toEqual(["Alex", "Jamie"]);
  });
});

describe("getDaysUntilEventDate", () => {
  it("returns null when there is no event date", () => {
    expect(getDaysUntilEventDate(null)).toBeNull();
  });

  it("returns 0 for today, using local calendar days, not UTC", () => {
    const now = new Date(2026, 5, 15, 23, 30);
    expect(getDaysUntilEventDate("2026-06-15", now)).toBe(0);
  });

  it("returns a positive count for a future date and negative for a past date", () => {
    const now = new Date(2026, 5, 15, 12, 0);
    expect(getDaysUntilEventDate("2026-06-20", now)).toBe(5);
    expect(getDaysUntilEventDate("2026-06-10", now)).toBe(-5);
  });

  it("is not shifted by a 'now' late in the day near a UTC day boundary", () => {
    // 11:30pm local on 2026-06-15 is already 2026-06-16 in UTC — a UTC-based
    // implementation would misreport this as 1 day away instead of 0.
    const now = new Date(2026, 5, 15, 23, 30);
    expect(getDaysUntilEventDate("2026-06-16", now)).toBe(1);
  });
});
