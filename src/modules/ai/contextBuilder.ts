import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { EVENT_STATUS_LABELS } from "@/core/enums/eventStatus";
import { EVENT_LIFECYCLE_STAGE_LABELS } from "@/core/enums/eventLifecycleStage";
import { EVENT_PRIORITY_LABELS } from "@/core/enums/eventPriority";
import { getEventHealthDetails, getEventHealthStatus } from "@/core/workflows/eventHealth";
import { getEventNextRecommendedAction } from "@/core/workflows/eventWorkflow";
import { isChecklistItemOverdue } from "@/modules/events/checklistStats";
import { detectOperationalRisks } from "@/modules/ai/riskEngine";
import { computeContextConfidence } from "@/modules/ai/confidence";
import type { EventOperationsBriefContext } from "@/modules/ai/types";

/**
 * Whole days from `event_date` to `now` — duplicated in miniature from
 * `operationalLogic.ts`'s `getDaysUntilEventDate` rather than imported,
 * since importing a Pipeline-module helper into AI would create a
 * cross-module dependency this phase's scope explicitly rules out
 * ("unrelated cross-module refactors"). Both independently do the same
 * local-calendar-day math for the same reason: `new Date("YYYY-MM-DD")`
 * parses as UTC midnight, which shifts by a day in timezones behind UTC.
 */
function daysUntil(eventDate: string | null, now: Date): number | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * Bumped whenever `EventOperationsBriefContext`'s shape changes — carried
 * through onto `GeneratedEventOperationsBrief.contextVersion` so a future
 * persistence phase can tell which context shape produced a given brief.
 */
export const EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION = "event-operations-brief-context-v2";

function buildOverdueSummary(checklistOverdueCount: number, scheduleDelayedCount: number): string {
  const parts: string[] = [];
  if (checklistOverdueCount > 0) {
    parts.push(`${checklistOverdueCount} checklist item${checklistOverdueCount === 1 ? "" : "s"}`);
  }
  if (scheduleDelayedCount > 0) {
    parts.push(`${scheduleDelayedCount} schedule item${scheduleDelayedCount === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return "Nothing overdue.";
  return `${parts.join(" and ")} overdue.`;
}

/**
 * Pure and deterministic — same inputs always produce the same context, so
 * this is independently testable with plain fixtures and never needs a
 * network or database mock. The only place Event/Client/ChecklistItem[]/
 * EventScheduleItem[] get turned into what the AI module is allowed to see;
 * `fetchEventContext.server.ts` is the only caller, and it never hands the
 * model raw rows directly.
 */
export function buildEventOperationsBriefContext(
  event: Event,
  client: Client | null,
  checklist: ChecklistItem[],
  schedule: EventScheduleItem[],
  now: Date = new Date(),
): EventOperationsBriefContext {
  const hasOverdueChecklistItems = checklist.some((item) => isChecklistItemOverdue(item, now));
  const daysUntilEvent = daysUntil(event.event_date, now);
  const healthContext = {
    hasChecklistItems: checklist.length > 0,
    hasOverdueChecklistItems,
    hasScheduleItems: schedule.length > 0,
    hasPostEventReview: false,
    daysUntilEvent,
  };
  const healthDetails = getEventHealthDetails(event, healthContext);
  const healthStatus = getEventHealthStatus(event, healthContext);

  const overdueItems = checklist.filter((item) => isChecklistItemOverdue(item, now));
  // Capped defensively — a Workspace with an unusually large overdue
  // checklist should never balloon the provider context; `overdueCount`
  // below still reflects the true total regardless of this cap.
  const overdueTitles = overdueItems.map((item) => item.title).slice(0, 15);
  const completed = checklist.filter((item) => item.status === "completed").length;
  const delayedScheduleCount = schedule.filter((item) => item.status === "delayed").length;

  const upcomingSchedule = schedule
    .filter((item) => item.status !== "cancelled")
    .slice()
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  // Every triggered Health factor is either "something is absent from the
  // record" (Missing.../No...) or "an active condition needs attention"
  // (Overdue.../Awaiting.../Critical priority/Approaching...) — split by
  // label rather than duplicating the same list under two headings, since
  // `EventHealthFactor` only exposes the rendered label, not its source key.
  const missingInformation = healthDetails.factors
    .filter((factor) => factor.label.startsWith("Missing") || factor.label.startsWith("No "))
    .map((factor) => factor.label);
  const riskReasons = healthDetails.factors
    .filter((factor) => !factor.label.startsWith("Missing") && !factor.label.startsWith("No "))
    .map((factor) => factor.label);

  const detectedRisks = detectOperationalRisks({
    checklistOverdueCount: overdueItems.length,
    scheduleDelayedCount: delayedScheduleCount,
    assignedOwner: event.assigned_owner,
    missingInformation,
    healthStatus,
    daysUntilEvent,
  });

  const confidence = computeContextConfidence({
    hasClient: client !== null,
    hasEventDate: event.event_date !== null,
    hasLocation: event.location_name !== null || event.address !== null,
    hasBudget: event.budget_min !== null || event.budget_max !== null,
    hasAssignedOwner: event.assigned_owner !== null,
    hasChecklistItems: checklist.length > 0,
    hasScheduleItems: schedule.length > 0,
  });

  return {
    event: {
      id: event.id,
      title: event.title,
      eventType: EVENT_TYPE_LABELS[event.event_type],
      status: EVENT_STATUS_LABELS[event.status],
      lifecycleStage: EVENT_LIFECYCLE_STAGE_LABELS[event.lifecycle_stage],
      priority: EVENT_PRIORITY_LABELS[event.priority],
      eventDate: event.event_date,
      locationName: event.location_name,
      assignedOwner: event.assigned_owner,
      updatedAt: event.updated_at,
    },
    client: client ? { name: `${client.first_name} ${client.last_name}` } : null,
    health: {
      status: healthStatus,
      score: healthDetails.score,
      riskReasons,
      topFactors: healthDetails.factors,
    },
    checklist: {
      total: checklist.length,
      completed,
      overdueCount: overdueItems.length,
      overdueTitles,
    },
    schedule: {
      total: schedule.length,
      nextItem: upcomingSchedule[0] ? { title: upcomingSchedule[0].title, startTime: upcomingSchedule[0].start_time } : null,
      delayedCount: delayedScheduleCount,
    },
    missingInformation,
    overdueSummary: buildOverdueSummary(overdueItems.length, delayedScheduleCount),
    deterministicNextAction: getEventNextRecommendedAction(event, healthContext),
    detectedRisks,
    confidence,
    generatedAt: now.toISOString(),
  };
}
