import { describe, expect, it } from "vitest";
import { buildDailyOperationsBriefContext } from "@/modules/ai/dailyBrief/contextBuilder";
import { makeEvent, makeChecklistItem } from "@/modules/events/testUtils";
import { makeInvoice } from "@/modules/finance/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeClient } from "@/modules/clients/testUtils";
import type { DailyOperationsBriefMaterials } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";
import type { EventContextRecord } from "@/modules/ai/fetchEventContext.server";

const NOW = new Date("2026-07-25T12:00:00.000Z");

function record(overrides: Partial<EventContextRecord> = {}): EventContextRecord {
  return {
    event: makeEvent({ id: "event_1", title: "Beachfront Proposal", event_date: "2026-07-25", assigned_owner: "Jamie" }),
    client: null,
    checklist: [],
    schedule: [],
    ...overrides,
  };
}

function materials(overrides: Partial<DailyOperationsBriefMaterials> = {}): DailyOperationsBriefMaterials {
  return {
    eventRecords: [],
    lateInvoices: [],
    unsignedContracts: [],
    highPriorityClients: [],
    unreadNotificationCount: 0,
    recentActivity: [],
    unavailableCategories: [],
    ...overrides,
  };
}

describe("buildDailyOperationsBriefContext", () => {
  it("classifies an Event happening today into eventsToday", () => {
    const context = buildDailyOperationsBriefContext(materials({ eventRecords: [record()] }), NOW);
    expect(context.eventsToday.map((e) => e.eventId)).toEqual(["event_1"]);
    expect(context.calendarSummary.eventsToday).toBe(1);
  });

  it("classifies an Event 5 days out into eventsThisWeek but not eventsToday", () => {
    const context = buildDailyOperationsBriefContext(
      materials({ eventRecords: [record({ event: makeEvent({ id: "event_2", event_date: "2026-07-30" }) })] }),
      NOW,
    );
    expect(context.eventsToday).toEqual([]);
    expect(context.eventsThisWeek.map((e) => e.eventId)).toEqual(["event_2"]);
  });

  it("excludes an Event more than 7 days out from eventsThisWeek", () => {
    const context = buildDailyOperationsBriefContext(
      materials({ eventRecords: [record({ event: makeEvent({ id: "event_3", event_date: "2026-08-10" }) })] }),
      NOW,
    );
    expect(context.eventsThisWeek).toEqual([]);
    expect(context.calendarSummary.eventsThisMonth).toBe(1);
  });

  it("flags an Event with a missing owner as at-risk", () => {
    const context = buildDailyOperationsBriefContext(
      materials({ eventRecords: [record({ event: makeEvent({ id: "event_4", assigned_owner: null, event_date: "2026-07-25" }) })] }),
      NOW,
    );
    expect(context.eventsAtRisk.map((e) => e.eventId)).toContain("event_4");
  });

  it("maps late invoices into latePayments with computed daysOverdue", () => {
    const context = buildDailyOperationsBriefContext(
      materials({ lateInvoices: [makeInvoice({ id: "inv_1", invoice_number: "INV-1", due_date: "2026-07-20", balance_minor: 5000 })] }),
      NOW,
    );
    expect(context.latePayments).toEqual([
      expect.objectContaining({ invoiceId: "inv_1", invoiceNumber: "INV-1", balanceMinor: 5000, daysOverdue: 5 }),
    ]);
  });

  it("maps unsigned contracts and resolves the linked Event's date when present", () => {
    const context = buildDailyOperationsBriefContext(
      materials({
        eventRecords: [record()],
        unsignedContracts: [makeContract({ id: "contract_1", contract_number: "C-1", event_id: "event_1", signature_status: "unsigned" })],
      }),
      NOW,
    );
    expect(context.unsignedContracts).toEqual([
      expect.objectContaining({ contractId: "contract_1", eventId: "event_1", eventDate: "2026-07-25" }),
    ]);
  });

  it("computes checklist progress from every Event's own checklist, flattened", () => {
    const checklist = [
      makeChecklistItem({ id: "c1", status: "pending", due_date: "2026-07-20" }), // overdue
      makeChecklistItem({ id: "c2", status: "pending", due_date: "2026-08-01" }), // open, not overdue
      makeChecklistItem({ id: "c3", status: "completed" }),
    ];
    const context = buildDailyOperationsBriefContext(materials({ eventRecords: [record({ checklist })] }), NOW);
    expect(context.checklistProgress).toEqual({ totalOpen: 2, totalOverdue: 1, totalCompleted: 1 });
  });

  it("aggregates team assignments by assignee name across every open checklist item", () => {
    const checklist = [
      makeChecklistItem({ id: "c1", status: "pending", assigned_name: "Jamie", due_date: "2026-07-20" }),
      makeChecklistItem({ id: "c2", status: "pending", assigned_name: "Jamie", due_date: "2026-08-01" }),
      makeChecklistItem({ id: "c3", status: "completed", assigned_name: "Jamie" }),
      makeChecklistItem({ id: "c4", status: "pending", assigned_name: null }),
    ];
    const context = buildDailyOperationsBriefContext(materials({ eventRecords: [record({ checklist })] }), NOW);
    expect(context.teamAssignments).toEqual([{ assigneeName: "Jamie", openItemCount: 2, overdueItemCount: 1 }]);
  });

  it("maps VIP clients into highPriorityClients", () => {
    const context = buildDailyOperationsBriefContext(
      materials({ highPriorityClients: [makeClient({ id: "client_1", first_name: "Jordan", last_name: "Ellis" })] }),
      NOW,
    );
    expect(context.highPriorityClients).toEqual([{ clientId: "client_1", name: "Jordan Ellis" }]);
  });

  it("passes unreadNotificationCount through and projects recentActivity to a safe shape (never before/after)", () => {
    const context = buildDailyOperationsBriefContext(
      materials({
        unreadNotificationCount: 3,
        recentActivity: [
          { id: "audit_1", workspace_id: "ws_1", actor: "user_1", action: "client.updated", owner_type: "client", owner_id: "client_1", before: { secret: "x" }, after: { secret: "y" }, occurred_at: "2026-07-25T10:00:00.000Z" },
        ],
      }),
      NOW,
    );
    expect(context.unreadNotificationCount).toBe(3);
    expect(context.recentActivity).toEqual([{ action: "client.updated", ownerType: "client", occurredAt: "2026-07-25T10:00:00.000Z" }]);
  });

  it("propagates unavailableCategories straight through for confidence/missing-info to consume", () => {
    const context = buildDailyOperationsBriefContext(materials({ unavailableCategories: ["finance", "contracts"] }), NOW);
    expect(context.unavailableCategories).toEqual(["finance", "contracts"]);
  });

  it("includes an open checklist item due within 14 days in upcomingDeadlines", () => {
    const checklist = [makeChecklistItem({ id: "c1", title: "Confirm florist", status: "pending", due_date: "2026-08-01" })];
    const context = buildDailyOperationsBriefContext(materials({ eventRecords: [record({ checklist })] }), NOW);
    expect(context.upcomingDeadlines).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Confirm florist", kind: "checklist" })]),
    );
  });
});
