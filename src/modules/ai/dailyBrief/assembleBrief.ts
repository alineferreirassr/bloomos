import type { DailyOperationsBriefContext, DailyOperationsBrief, DailyOperationsBriefModelOutput } from "@/modules/ai/dailyBrief/types";

/**
 * Mirrors `modules/ai/assembleBrief.ts`'s semantic cross-check: an
 * `eventNotes[].eventId` the model invented (not one of the real Events
 * actually present in context) is discarded rather than rendered.
 */
export function assembleDailyOperationsBrief(
  modelOutput: DailyOperationsBriefModelOutput,
  context: DailyOperationsBriefContext,
): DailyOperationsBrief {
  const eventsById = new Map(
    [...context.upcomingEvents, ...context.eventsAtRisk].map((event) => [event.eventId, event]),
  );

  const eventNotes = modelOutput.eventNotes
    .map((entry) => {
      const event = eventsById.get(entry.eventId);
      return event ? { event, note: entry.note } : null;
    })
    .filter((entry): entry is { event: (typeof context.eventsAtRisk)[number]; note: string } => entry !== null);

  return {
    overview: modelOutput.overview,
    topPriorities: modelOutput.topPriorities,
    eventNotes,
  };
}
