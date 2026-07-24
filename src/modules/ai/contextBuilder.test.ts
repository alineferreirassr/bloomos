import { describe, expect, it } from "vitest";
import { makeEvent, makeChecklistItem, makeScheduleItem } from "@/modules/events/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import { buildEventOperationsBriefContext } from "@/modules/ai/contextBuilder";

const NOW = new Date(2026, 5, 15, 12, 0);

describe("buildEventOperationsBriefContext", () => {
  it("is deterministic — identical inputs produce identical output", () => {
    const event = makeEvent({ title: "Beachfront Proposal" });
    const first = buildEventOperationsBriefContext(event, null, [], [], NOW);
    const second = buildEventOperationsBriefContext(event, null, [], [], NOW);
    expect(first).toEqual(second);
  });

  it("minimizes the Event to display labels, excluding raw enum values and unrelated fields", () => {
    const event = makeEvent({
      id: "event_1",
      title: "Beachfront Proposal",
      event_type: "elopement",
      status: "confirmed",
      lifecycle_stage: "preparation",
      priority: "high",
    });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);

    expect(context.event.id).toBe("event_1");
    expect(context.event.eventType).toBe("Elopement");
    expect(context.event.status).toBe("Confirmed");
    expect(context.event.lifecycleStage).toBe("Preparation");
    expect(context.event.priority).toBe("High");
    // No raw workspace/client/session identifiers leak into the context.
    expect(context).not.toHaveProperty("workspaceId");
    expect(context).not.toHaveProperty("client_id");
  });

  it("resolves the client to only a display name, never raw contact fields", () => {
    const client = makeClient({ first_name: "Priya", last_name: "Nair", email: "priya@example.com", phone: "+1 555" });
    const context = buildEventOperationsBriefContext(makeEvent(), client, [], [], NOW);

    expect(context.client).toEqual({ name: "Priya Nair" });
  });

  it("reports a null client when none is found", () => {
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], [], NOW);
    expect(context.client).toBeNull();
  });

  it("splits Health factors into missingInformation (absent data) and riskReasons (active conditions)", () => {
    const event = makeEvent({ location_name: null, address: null, budget_min: null, budget_max: null, status: "awaiting_deposit" });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);

    expect(context.missingInformation).toContain("Missing location");
    expect(context.missingInformation).toContain("Missing budget");
    expect(context.missingInformation).toContain("No checklist items");
    expect(context.health.riskReasons).toContain("Awaiting deposit");
    expect(context.health.riskReasons).not.toContain("Missing location");
    expect(context.missingInformation).not.toContain("Awaiting deposit");
  });

  it("computes checklist totals and an always-accurate overdueCount independent of the capped overdueTitles list", () => {
    const overdueItems = Array.from({ length: 20 }, (_, i) =>
      makeChecklistItem({ id: `item_${i}`, title: `Overdue item ${i}`, status: "pending", due_date: "2026-01-01" }),
    );
    const completedItem = makeChecklistItem({ id: "done", status: "completed" });
    const context = buildEventOperationsBriefContext(makeEvent(), null, [...overdueItems, completedItem], [], NOW);

    expect(context.checklist.total).toBe(21);
    expect(context.checklist.completed).toBe(1);
    expect(context.checklist.overdueCount).toBe(20);
    expect(context.checklist.overdueTitles.length).toBeLessThanOrEqual(15);
  });

  it("does not mark completed or cancelled items as overdue even with a past due date", () => {
    const items = [
      makeChecklistItem({ id: "a", status: "completed", due_date: "2020-01-01" }),
      makeChecklistItem({ id: "b", status: "cancelled", due_date: "2020-01-01" }),
    ];
    const context = buildEventOperationsBriefContext(makeEvent(), null, items, [], NOW);
    expect(context.checklist.overdueCount).toBe(0);
  });

  it("picks the earliest non-cancelled schedule item as nextItem", () => {
    const schedule = [
      makeScheduleItem({ id: "s1", title: "Load-in", start_time: "2026-06-15T14:00:00.000Z" }),
      makeScheduleItem({ id: "s2", title: "Cancelled setup", start_time: "2026-06-15T10:00:00.000Z", status: "cancelled" }),
      makeScheduleItem({ id: "s3", title: "Ceremony", start_time: "2026-06-15T17:00:00.000Z" }),
    ];
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], schedule, NOW);
    expect(context.schedule.total).toBe(3);
    expect(context.schedule.nextItem).toEqual({ title: "Load-in", startTime: "2026-06-15T14:00:00.000Z" });
  });

  it("reports no next scheduled item when the schedule is empty", () => {
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], [], NOW);
    expect(context.schedule.nextItem).toBeNull();
  });

  it("carries the same deterministic next action Events itself already computes", () => {
    const event = makeEvent({ status: "draft" });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    expect(context.deterministicNextAction).toBe("Complete the event details to move it out of draft");
  });

  it("stamps generatedAt from the supplied clock, not wall time", () => {
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], [], NOW);
    expect(context.generatedAt).toBe(NOW.toISOString());
  });

  it("carries the Event's real updated_at through for future staleness comparison", () => {
    const event = makeEvent({ updated_at: "2026-07-20T00:00:00.000Z" });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    expect(context.event.updatedAt).toBe("2026-07-20T00:00:00.000Z");
  });

  it("carries the same top Health factors the real engine computed, in the same order, without recomputing them", () => {
    const event = makeEvent({ location_name: null, address: null, budget_min: null, budget_max: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    expect(context.health.topFactors[0].label).toBe("Missing location");
    expect(context.health.topFactors.every((f) => f.deduction > 0)).toBe(true);
  });

  it("counts delayed schedule items independently of cancelled/completed ones", () => {
    const schedule = [
      makeScheduleItem({ id: "s1", status: "delayed" }),
      makeScheduleItem({ id: "s2", status: "delayed" }),
      makeScheduleItem({ id: "s3", status: "cancelled" }),
      makeScheduleItem({ id: "s4", status: "completed" }),
    ];
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], schedule, NOW);
    expect(context.schedule.delayedCount).toBe(2);
  });

  it("summarizes overdue checklist and delayed schedule counts deterministically", () => {
    const overdue = makeChecklistItem({ id: "c1", status: "pending", due_date: "2020-01-01" });
    const delayed = makeScheduleItem({ id: "s1", status: "delayed" });
    const context = buildEventOperationsBriefContext(makeEvent(), null, [overdue], [delayed], NOW);
    expect(context.overdueSummary).toBe("1 checklist item and 1 schedule item overdue.");
  });

  it("reports 'Nothing overdue.' when neither checklist nor schedule has anything overdue", () => {
    const context = buildEventOperationsBriefContext(makeEvent(), null, [], [], NOW);
    expect(context.overdueSummary).toBe("Nothing overdue.");
  });

  it("detects operational risks from the same signals already computed, never a second set of facts", () => {
    const event = makeEvent({ assigned_owner: null });
    const context = buildEventOperationsBriefContext(event, null, [], [], NOW);
    expect(context.detectedRisks.some((r) => r.kind === "missing_owner")).toBe(true);
  });

  it("derives confidence from context completeness, never from the model", () => {
    const complete = makeEvent({
      location_name: "Beach",
      budget_min: 1000,
      assigned_owner: "Jamie",
      event_date: "2026-09-01",
    });
    const client = makeClient();
    const checklist = [makeChecklistItem()];
    const schedule = [makeScheduleItem()];
    const context = buildEventOperationsBriefContext(complete, client, checklist, schedule, NOW);
    expect(context.confidence.score).toBe(100);
    expect(context.confidence.reason).toMatch(/all key fields/i);
  });
});
