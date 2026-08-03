import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

const MOCK_MODEL_NAME = "bloomos-daily-mock-v2";

/**
 * Deterministic mock for the Daily Operations Brief — same rationale as
 * `modules/ai/mockProvider.ts`: never registered into the global registry,
 * always reflects the supplied context's real data rather than a fixed
 * string.
 */
export function createDailyOperationsBriefMockProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.dailyOperationsBriefContext as DailyOperationsBriefContext | undefined;

      if (!context) {
        return {
          content: JSON.stringify({ executiveSummary: "No daily context was supplied.", todaysPriorities: [], riskExplanations: [], recommendations: [], suggestedActions: [] }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const executiveSummaryParts: string[] = [
        `${context.calendarSummary.eventsToday} Event(s) today, ${context.calendarSummary.eventsThisWeek} this week.`,
        `${context.eventsAtRisk.length} Event(s) currently need attention.`,
        `${context.latePayments.length} late payment(s) and ${context.unsignedContracts.length} unsigned contract(s) outstanding.`,
        `${context.checklistProgress.totalOverdue} checklist item(s) overdue workspace-wide.`,
      ];

      const todaysPriorities = context.eventsAtRisk.slice(0, 5).map((event) =>
        event.topRisk ? `${event.title}: ${event.topRisk.label}` : `${event.title}: needs attention`,
      );
      if (todaysPriorities.length === 0) {
        todaysPriorities.push("No Events currently need attention — continue routine monitoring.");
      }

      const riskExplanations = context.eventsAtRisk.slice(0, 10).map((event) => ({
        eventId: event.eventId,
        explanation: event.topRisk ? event.topRisk.evidence : `Health status is ${event.healthStatus}.`,
      }));

      const recommendations: string[] = [];
      if (context.latePayments.length > 0) recommendations.push("Follow up on outstanding late payments.");
      if (context.unsignedContracts.length > 0) recommendations.push("Chase down unsigned contracts, especially for imminent Events.");
      if (context.checklistProgress.totalOverdue > 0) recommendations.push("Clear overdue checklist items before they compound.");

      const suggestedActions = [
        ...context.latePayments.slice(0, 3).map((payment) => ({
          label: `Follow up on Invoice ${payment.invoiceNumber}`,
          reason: `${payment.daysOverdue} day(s) overdue.`,
          targetType: "invoice" as const,
          targetId: payment.invoiceId,
        })),
        ...context.unsignedContracts.slice(0, 3).map((contract) => ({
          label: `Chase signature on Contract ${contract.contractNumber}`,
          reason: "Still unsigned.",
          targetType: "contract" as const,
          targetId: contract.contractId,
        })),
      ];

      return {
        content: JSON.stringify({
          executiveSummary: executiveSummaryParts.join(" "),
          todaysPriorities,
          riskExplanations,
          recommendations,
          suggestedActions,
        }),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}
