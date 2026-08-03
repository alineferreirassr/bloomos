import { describe, expect, it } from "vitest";
import { assembleDailyOperationsBrief } from "@/modules/ai/dailyBrief/assembleBrief";
import type { DailyOperationsBriefContext, DailyOperationsBriefModelOutput } from "@/modules/ai/dailyBrief/types";

const NOW = new Date("2026-07-25T12:00:00.000Z");

function context(overrides: Partial<DailyOperationsBriefContext> = {}): DailyOperationsBriefContext {
  return {
    generatedAt: "2026-07-25T00:00:00.000Z",
    eventsToday: [],
    eventsThisWeek: [],
    eventsAtRisk: [],
    latePayments: [],
    unsignedContracts: [],
    checklistProgress: { totalOpen: 0, totalOverdue: 0, totalCompleted: 0 },
    teamAssignments: [],
    unreadNotificationCount: 0,
    highPriorityClients: [],
    calendarSummary: { eventsToday: 0, eventsThisWeek: 0, eventsThisMonth: 0 },
    recentActivity: [],
    upcomingDeadlines: [],
    unavailableCategories: [],
    ...overrides,
  };
}

function output(overrides: Partial<DailyOperationsBriefModelOutput> = {}): DailyOperationsBriefModelOutput {
  return {
    executiveSummary: "Everything is on track today.",
    todaysPriorities: ["Follow up on Invoice INV-1."],
    riskExplanations: [],
    recommendations: [],
    suggestedActions: [],
    ...overrides,
  };
}

describe("assembleDailyOperationsBrief", () => {
  it("carries the model's narrative fields straight through", () => {
    const brief = assembleDailyOperationsBrief(output(), context(), "ws_1", "member_1", NOW);
    expect(brief.executiveSummary).toBe("Everything is on track today.");
    expect(brief.todaysPriorities).toEqual(["Follow up on Invoice INV-1."]);
  });

  it("renders deterministic sections straight from context, not the model", () => {
    const eventsToday = context({
      eventsToday: [{ eventId: "event_1", title: "Beachfront", eventDate: "2026-07-25", lifecycleStage: "planning", status: "planning", healthStatus: "ready", assignedOwner: "Jamie", topRisk: null }],
    });
    const brief = assembleDailyOperationsBrief(output(), eventsToday, "ws_1", "member_1", NOW);
    expect(brief.eventsToday).toEqual(eventsToday.eventsToday);
  });

  it("resolves operational risks by pairing each at-risk Event with its own model explanation", () => {
    const withRisk = context({
      eventsAtRisk: [
        {
          eventId: "event_1",
          title: "Beachfront",
          eventDate: "2026-07-25",
          lifecycleStage: "planning",
          status: "planning",
          healthStatus: "blocked",
          assignedOwner: null,
          topRisk: { kind: "missing_owner", label: "No assigned owner", severity: "high", evidence: "No owner on file." },
        },
      ],
    });
    const brief = assembleDailyOperationsBrief(output({ riskExplanations: [{ eventId: "event_1", explanation: "Assign an owner today." }] }), withRisk, "ws_1", "member_1", NOW);
    expect(brief.operationalRisks).toEqual([
      { event: withRisk.eventsAtRisk[0], risk: withRisk.eventsAtRisk[0].topRisk, explanation: "Assign an owner today." },
    ]);
  });

  it("falls back to the risk's own evidence when the model supplies no explanation for it", () => {
    const withRisk = context({
      eventsAtRisk: [
        {
          eventId: "event_1",
          title: "Beachfront",
          eventDate: "2026-07-25",
          lifecycleStage: "planning",
          status: "planning",
          healthStatus: "blocked",
          assignedOwner: null,
          topRisk: { kind: "missing_owner", label: "No assigned owner", severity: "high", evidence: "No owner on file." },
        },
      ],
    });
    const brief = assembleDailyOperationsBrief(output(), withRisk, "ws_1", "member_1", NOW);
    expect(brief.operationalRisks[0].explanation).toBeNull();
  });

  it("resolves a suggested action's real target into a real href", () => {
    const withInvoice = context({ latePayments: [{ invoiceId: "inv_1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, balanceMinor: 5000, currency: "USD", dueDate: "2026-07-20", daysOverdue: 5 }] });
    const brief = assembleDailyOperationsBrief(
      output({ suggestedActions: [{ label: "Follow up", reason: "overdue", targetType: "invoice", targetId: "inv_1" }] }),
      withInvoice,
      "ws_1",
      "member_1",
      NOW,
    );
    expect(brief.suggestedActions).toEqual([{ label: "Follow up", reason: "overdue", actionTarget: { type: "invoice", href: "/finance/invoices/inv_1", label: "Open Invoice" } }]);
  });

  it("computes confidence and missingInformation entirely from context, never the model", () => {
    const withGap = context({ unavailableCategories: ["finance"] });
    const brief = assembleDailyOperationsBrief(output(), withGap, "ws_1", "member_1", NOW);
    expect(brief.confidence).toBeLessThan(100);
    expect(brief.missingInformation).toHaveLength(1);
  });

  it("includes prepared critical findings for the acting member", () => {
    const withLatePayment = context({ latePayments: [{ invoiceId: "inv_1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, balanceMinor: 5000, currency: "USD", dueDate: "2026-07-20", daysOverdue: 5 }] });
    const brief = assembleDailyOperationsBrief(output(), withLatePayment, "ws_1", "member_1", NOW);
    expect(brief.criticalFindings).toHaveLength(1);
    expect(brief.criticalFindings[0].recipient_member_id).toBe("member_1");
  });
});
