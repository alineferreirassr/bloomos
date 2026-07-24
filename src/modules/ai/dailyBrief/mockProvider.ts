import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

const MOCK_MODEL_NAME = "bloomos-daily-mock-v1";

/**
 * Deterministic mock for the Daily Operations Brief — same rationale as
 * `modules/ai/mockProvider.ts`: never registered into the global registry,
 * always reflects the supplied context's real Events rather than a fixed
 * string.
 */
export function createDailyOperationsBriefMockProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.dailyOperationsBriefContext as
        | DailyOperationsBriefContext
        | undefined;

      if (!context) {
        return {
          content: JSON.stringify({ overview: "No daily context was supplied.", topPriorities: [], eventNotes: [] }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const overviewParts: string[] = [
        `${context.upcomingEvents.length} Event(s) are scheduled within the next ${context.upcomingWindowDays} day(s).`,
        `${context.eventsAtRisk.length} Event(s) currently need attention.`,
      ];
      if (context.totalOverdueChecklistItems > 0 || context.totalDelayedScheduleItems > 0) {
        overviewParts.push(
          `${context.totalOverdueChecklistItems} checklist item(s) and ${context.totalDelayedScheduleItems} schedule item(s) are overdue workspace-wide.`,
        );
      }

      const topPriorities = context.eventsAtRisk.slice(0, 5).map((event) =>
        event.topRisk ? `${event.title}: ${event.topRisk.label}` : `${event.title}: needs attention`,
      );
      if (topPriorities.length === 0) {
        topPriorities.push("No Events currently need attention — continue routine monitoring.");
      }

      const eventNotes = context.eventsAtRisk.slice(0, 10).map((event) => ({
        eventId: event.eventId,
        note: event.topRisk ? event.topRisk.evidence : `Health status is ${event.healthStatus}.`,
      }));

      return {
        content: JSON.stringify({ overview: overviewParts.join(" "), topPriorities, eventNotes }),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}
