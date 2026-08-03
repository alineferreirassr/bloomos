import { describe, expect, it } from "vitest";
import { createDailyOperationsBriefMockProvider } from "@/modules/ai/dailyBrief/mockProvider";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";
import type { AICompletionRequest } from "@/core/ai/types";

const NOW = "2026-07-25T00:00:00.000Z";

function context(overrides: Partial<DailyOperationsBriefContext> = {}): DailyOperationsBriefContext {
  return {
    generatedAt: NOW,
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

function request(dailyOperationsBriefContext?: DailyOperationsBriefContext): AICompletionRequest {
  return {
    conversation: {
      id: "conv_1",
      workspaceId: "ws_1",
      context: { workspaceId: "ws_1", facts: { dailyOperationsBriefContext } },
      messages: [],
      createdAt: NOW,
      updatedAt: NOW,
    },
    prompt: { role: "user", content: "x" },
  };
}

describe("createDailyOperationsBriefMockProvider", () => {
  it("returns a finishReason of error when no context was supplied", async () => {
    const provider = createDailyOperationsBriefMockProvider();
    const completion = await provider.complete(request(undefined));
    expect(completion.finishReason).toBe("error");
  });

  it("reflects the real at-risk Events in todaysPriorities and riskExplanations", async () => {
    const provider = createDailyOperationsBriefMockProvider();
    const completion = await provider.complete(
      request(
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
      ),
    );
    const parsed = JSON.parse(completion.content);
    expect(parsed.todaysPriorities[0]).toContain("Beachfront Proposal");
    expect(parsed.riskExplanations).toEqual([{ eventId: "event_1", explanation: "No owner on file." }]);
  });

  it("suggests following up on real late payments and unsigned contracts, referencing their real ids", async () => {
    const provider = createDailyOperationsBriefMockProvider();
    const completion = await provider.complete(
      request(
        context({
          latePayments: [{ invoiceId: "inv_1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, balanceMinor: 5000, currency: "USD", dueDate: "2026-07-20", daysOverdue: 5 }],
          unsignedContracts: [{ contractId: "contract_1", contractNumber: "C-1", clientId: "c1", eventId: null, signatureStatus: "unsigned", eventDate: null }],
        }),
      ),
    );
    const parsed = JSON.parse(completion.content);
    expect(parsed.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetType: "invoice", targetId: "inv_1" }),
        expect.objectContaining({ targetType: "contract", targetId: "contract_1" }),
      ]),
    );
  });

  it("falls back to a routine-monitoring priority when nothing is at risk", async () => {
    const provider = createDailyOperationsBriefMockProvider();
    const completion = await provider.complete(request(context()));
    const parsed = JSON.parse(completion.content);
    expect(parsed.todaysPriorities).toEqual(["No Events currently need attention — continue routine monitoring."]);
  });

  it("always returns valid JSON matching the model output schema shape", async () => {
    const provider = createDailyOperationsBriefMockProvider();
    const completion = await provider.complete(request(context()));
    const parsed = JSON.parse(completion.content);
    expect(parsed).toHaveProperty("executiveSummary");
    expect(parsed).toHaveProperty("todaysPriorities");
    expect(parsed).toHaveProperty("riskExplanations");
    expect(parsed).toHaveProperty("recommendations");
    expect(parsed).toHaveProperty("suggestedActions");
  });
});
