import { describe, expect, it } from "vitest";
import { prepareCriticalFindings } from "@/modules/ai/dailyBrief/notifications";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

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

describe("prepareCriticalFindings", () => {
  it("prepares a finding for a high-severity risk", () => {
    const findings = prepareCriticalFindings(
      context({
        eventsAtRisk: [
          {
            eventId: "event_1",
            title: "Beachfront Proposal",
            eventDate: "2026-07-25",
            lifecycleStage: "planning",
            status: "planning",
            healthStatus: "blocked",
            assignedOwner: null,
            topRisk: { kind: "missing_owner", label: "No assigned owner", severity: "high", evidence: "No owner on file." },
          },
        ],
      }),
      "ws_1",
      "member_1",
      NOW,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ workspace_id: "ws_1", recipient_member_id: "member_1", channel: "in_app", related_owner_type: "event", related_owner_id: "event_1", read_at: null });
  });

  it("does not prepare a finding for a low or medium severity risk", () => {
    const findings = prepareCriticalFindings(
      context({
        eventsAtRisk: [
          {
            eventId: "event_1",
            title: "Beachfront Proposal",
            eventDate: "2026-07-25",
            lifecycleStage: "planning",
            status: "planning",
            healthStatus: "waiting",
            assignedOwner: "Jamie",
            topRisk: { kind: "overdue_checklist", label: "Overdue checklist", severity: "medium", evidence: "1 item overdue." },
          },
        ],
      }),
      "ws_1",
      "member_1",
      NOW,
    );
    expect(findings).toEqual([]);
  });

  it("prepares a finding for every late payment", () => {
    const findings = prepareCriticalFindings(
      context({ latePayments: [{ invoiceId: "inv_1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, balanceMinor: 5000, currency: "USD", dueDate: "2026-07-20", daysOverdue: 5 }] }),
      "ws_1",
      "member_1",
      NOW,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].related_owner_type).toBe("invoice");
  });

  it("prepares a finding for an unsigned contract whose Event is within a week", () => {
    const findings = prepareCriticalFindings(
      context({ unsignedContracts: [{ contractId: "contract_1", contractNumber: "C-1", clientId: "c1", eventId: "event_1", signatureStatus: "unsigned", eventDate: "2026-07-28" }] }),
      "ws_1",
      "member_1",
      NOW,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].related_owner_type).toBe("contract");
  });

  it("does not prepare a finding for an unsigned contract with no imminent Event", () => {
    const findings = prepareCriticalFindings(
      context({ unsignedContracts: [{ contractId: "contract_1", contractNumber: "C-1", clientId: "c1", eventId: null, signatureStatus: "unsigned", eventDate: null }] }),
      "ws_1",
      "member_1",
      NOW,
    );
    expect(findings).toEqual([]);
  });

  it("never persists or sends anything — returns plain objects only", () => {
    const findings = prepareCriticalFindings(
      context({ latePayments: [{ invoiceId: "inv_1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, balanceMinor: 5000, currency: "USD", dueDate: "2026-07-20", daysOverdue: 5 }] }),
      "ws_1",
      "member_1",
      NOW,
    );
    expect(findings[0].id).toMatch(/^daily-brief-finding_/);
  });
});
