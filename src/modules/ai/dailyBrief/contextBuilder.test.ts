import { describe, expect, it } from "vitest";
import { makeEvent, makeChecklistItem, makeScheduleItem } from "@/modules/events/testUtils";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";
import { buildDailyOperationsBriefContext } from "@/modules/ai/dailyBrief/contextBuilder";

const NOW = new Date(2026, 5, 15, 12, 0);

describe("buildDailyOperationsBriefContext", () => {
  it("is deterministic — identical inputs produce identical output", () => {
    const context = buildEventOperationsBriefContext(makeEvent({ id: "e1" }), null, [], [], NOW);
    const first = buildDailyOperationsBriefContext([context], NOW);
    const second = buildDailyOperationsBriefContext([context], NOW);
    expect(first).toEqual(second);
  });

  it("includes an Event within the upcoming window, excludes one outside it", () => {
    const soon = buildEventOperationsBriefContext(makeEvent({ id: "soon", event_date: "2026-06-18" }), null, [], [], NOW);
    const far = buildEventOperationsBriefContext(makeEvent({ id: "far", event_date: "2026-08-01" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([soon, far], NOW, 7);

    expect(context.upcomingEvents.map((e) => e.eventId)).toEqual(["soon"]);
  });

  it("excludes a past Event from the upcoming window", () => {
    const past = buildEventOperationsBriefContext(makeEvent({ id: "past", event_date: "2026-06-01" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([past], NOW, 7);
    expect(context.upcomingEvents).toHaveLength(0);
  });

  it("excludes an Event with no date at all from the upcoming window", () => {
    const noDate = buildEventOperationsBriefContext(makeEvent({ id: "no-date", event_date: null }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([noDate], NOW, 7);
    expect(context.upcomingEvents).toHaveLength(0);
  });

  it("flags an Event as at-risk when its Health status isn't ready", () => {
    const atRisk = buildEventOperationsBriefContext(makeEvent({ id: "risky", status: "awaiting_deposit" }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([atRisk], NOW);
    expect(context.eventsAtRisk.map((e) => e.eventId)).toContain("risky");
  });

  it("does not flag a fully-ready Event as at-risk", () => {
    const ready = buildEventOperationsBriefContext(
      makeEvent({
        id: "ready",
        status: "confirmed",
        location_name: "Beach",
        budget_min: 1000,
        event_date: "2026-08-01",
        assigned_owner: "Jamie",
      }),
      null,
      [makeChecklistItem({ status: "completed" })],
      [makeScheduleItem({ status: "completed" })],
      NOW,
    );
    expect(ready.health.status).toBe("ready");
    const context = buildDailyOperationsBriefContext([ready], NOW);
    expect(context.eventsAtRisk.map((e) => e.eventId)).not.toContain("ready");
  });

  it("sums overdue checklist and delayed schedule counts across all supplied Events", () => {
    const a = { ...buildEventOperationsBriefContext(makeEvent({ id: "a" }), null, [], [], NOW), checklist: { total: 1, completed: 0, overdueCount: 2, overdueTitles: [] } };
    const b = { ...buildEventOperationsBriefContext(makeEvent({ id: "b" }), null, [], [], NOW), checklist: { total: 1, completed: 0, overdueCount: 3, overdueTitles: [] } };
    const context = buildDailyOperationsBriefContext([a, b], NOW);
    expect(context.totalOverdueChecklistItems).toBe(5);
  });

  it("leaves financeWarnings empty — no safe cross-Event finance aggregate exists yet", () => {
    const context = buildDailyOperationsBriefContext([], NOW);
    expect(context.financeWarnings).toEqual([]);
  });

  it("reuses each Event's already-detected top risk rather than re-deriving one", () => {
    const withRisk = buildEventOperationsBriefContext(makeEvent({ id: "e1", assigned_owner: null }), null, [], [], NOW);
    const context = buildDailyOperationsBriefContext([withRisk], NOW);
    const summary = context.eventsAtRisk.find((e) => e.eventId === "e1");
    expect(summary?.topRisk).toEqual(withRisk.detectedRisks[0]);
  });
});
