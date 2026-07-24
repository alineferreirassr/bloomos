import type { EventOperationsBriefContext } from "@/modules/ai/types";
import type { DailyBriefEventSummary, DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

export const DAILY_OPERATIONS_BRIEF_CONTEXT_VERSION = "daily-operations-brief-context-v1";

const DEFAULT_UPCOMING_WINDOW_DAYS = 7;

function daysUntil(eventDate: string | null, now: Date): number | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

function toSummary(context: EventOperationsBriefContext): DailyBriefEventSummary {
  return {
    eventId: context.event.id,
    title: context.event.title,
    eventDate: context.event.eventDate,
    lifecycleStage: context.event.lifecycleStage,
    healthStatus: context.health.status,
    overdueChecklistCount: context.checklist.overdueCount,
    delayedScheduleCount: context.schedule.delayedCount,
    topRisk: context.detectedRisks[0] ?? null,
  };
}

/**
 * Pure and deterministic — takes already-built `EventOperationsBriefContext`
 * objects (one per active Event) rather than raw rows, so it never
 * recomputes Health Score, checklist/schedule stats, or risk detection;
 * every one of those is reused verbatim from Event Operations Brief. This
 * is what "one operational intelligence layer, not two" means in practice:
 * a dashboard-level brief is an aggregation over the same per-Event
 * computations already trusted for the single-Event brief, never a
 * parallel calculation.
 */
export function buildDailyOperationsBriefContext(
  eventContexts: EventOperationsBriefContext[],
  now: Date = new Date(),
  upcomingWindowDays: number = DEFAULT_UPCOMING_WINDOW_DAYS,
): DailyOperationsBriefContext {
  const summaries = eventContexts.map(toSummary);

  const upcomingEvents = summaries
    .filter((summary) => {
      const days = daysUntil(summary.eventDate, now);
      return days !== null && days >= 0 && days <= upcomingWindowDays;
    })
    .sort((a, b) => (a.eventDate ?? "").localeCompare(b.eventDate ?? ""));

  const eventsAtRisk = summaries.filter((summary) => summary.healthStatus !== "ready" || summary.topRisk !== null);

  return {
    generatedAt: now.toISOString(),
    upcomingWindowDays,
    upcomingEvents,
    eventsAtRisk,
    totalOverdueChecklistItems: eventContexts.reduce((sum, c) => sum + c.checklist.overdueCount, 0),
    totalDelayedScheduleItems: eventContexts.reduce((sum, c) => sum + c.schedule.delayedCount, 0),
    // No safe, already-existing cross-Event finance aggregate exists yet
    // (per-Event `getEventFinancialSummary` is the only thing available) —
    // left empty rather than fabricated. See `types.ts`'s doc comment.
    financeWarnings: [],
  };
}
