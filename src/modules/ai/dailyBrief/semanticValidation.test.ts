import { describe, expect, it } from "vitest";
import { validateDailyOperationsBriefSemantics } from "@/modules/ai/dailyBrief/semanticValidation";
import type { DailyOperationsBriefContext, DailyOperationsBriefModelOutput } from "@/modules/ai/dailyBrief/types";

function eventSummary(eventId: string) {
  return {
    eventId,
    title: "Beachfront Proposal",
    eventDate: "2026-07-25",
    lifecycleStage: "planning",
    status: "planning",
    healthStatus: "ready" as const,
    assignedOwner: "Jamie",
    topRisk: null,
  };
}

function context(overrides: Partial<DailyOperationsBriefContext> = {}): DailyOperationsBriefContext {
  return {
    generatedAt: "2026-07-25T00:00:00.000Z",
    eventsToday: [],
    eventsThisWeek: [],
    eventsAtRisk: [eventSummary("event_1")],
    latePayments: [{ invoiceId: "inv_1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, balanceMinor: 5000, currency: "USD", dueDate: "2026-07-20", daysOverdue: 5 }],
    unsignedContracts: [{ contractId: "contract_1", contractNumber: "C-1", clientId: "c1", eventId: null, signatureStatus: "unsigned", eventDate: null }],
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

describe("validateDailyOperationsBriefSemantics", () => {
  it("accepts a risk explanation tied to a real at-risk Event", () => {
    const result = validateDailyOperationsBriefSemantics(output({ riskExplanations: [{ eventId: "event_1", explanation: "Needs attention." }] }), context());
    expect(result.success).toBe(true);
  });

  it("rejects a risk explanation tied to an Event that doesn't exist in context", () => {
    const result = validateDailyOperationsBriefSemantics(output({ riskExplanations: [{ eventId: "invented_event", explanation: "Needs attention." }] }), context());
    expect(result.success).toBe(false);
  });

  it("accepts a suggested action whose invoice target is real", () => {
    const result = validateDailyOperationsBriefSemantics(
      output({ suggestedActions: [{ label: "Follow up", reason: "overdue", targetType: "invoice", targetId: "inv_1" }] }),
      context(),
    );
    expect(result.success).toBe(true);
  });

  it("rejects a suggested action whose invoice target is invented", () => {
    const result = validateDailyOperationsBriefSemantics(
      output({ suggestedActions: [{ label: "Follow up", reason: "overdue", targetType: "invoice", targetId: "invented_invoice" }] }),
      context(),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a suggested action whose contract target is invented", () => {
    const result = validateDailyOperationsBriefSemantics(
      output({ suggestedActions: [{ label: "Chase signature", reason: "unsigned", targetType: "contract", targetId: "invented_contract" }] }),
      context(),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a suggested action whose event target is invented", () => {
    const result = validateDailyOperationsBriefSemantics(
      output({ suggestedActions: [{ label: "Check in", reason: "at risk", targetType: "event", targetId: "invented_event" }] }),
      context(),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a suggested action with a target type but no target id", () => {
    const result = validateDailyOperationsBriefSemantics(
      output({ suggestedActions: [{ label: "Check in", reason: "at risk", targetType: "event", targetId: null }] }),
      context(),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a suggested action with no target at all", () => {
    const result = validateDailyOperationsBriefSemantics(
      output({ suggestedActions: [{ label: "Review the week ahead", reason: "routine", targetType: null, targetId: null }] }),
      context(),
    );
    expect(result.success).toBe(true);
  });

  it("accepts an output with no risk explanations or suggested actions at all", () => {
    expect(validateDailyOperationsBriefSemantics(output(), context()).success).toBe(true);
  });
});
