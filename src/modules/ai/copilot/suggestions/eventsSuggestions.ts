import { getEvents, getChecklistByEventId } from "@/lib/data";
import type { Event } from "@/types/event";
import type { SuggestionProvider, CopilotSuggestion } from "@/core/ai/copilot/suggestionEngine";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Two Events on the same date genuinely overlap when their [start,end) time ranges intersect — a real, deterministic check, not a guess. */
function timeRangesOverlap(a: Event, b: Event): boolean {
  const aStart = toMinutes(a.start_time);
  const aEnd = toMinutes(a.end_time);
  const bStart = toMinutes(b.start_time);
  const bEnd = toMinutes(b.end_time);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Checkpoint 20, Step 7 — Events suggestions: Assign Team, Checklist,
 * Timeline, Calendar Conflict Detection. Conflict detection is a real,
 * deterministic time-range comparison over `event_date`/`start_time`/
 * `end_time` — never a guess at whether two Events "feel" close together.
 */
export const eventsSuggestionProvider: SuggestionProvider = {
  module: "events",
  async compute(): Promise<CopilotSuggestion[]> {
    const events = await getEvents({ includeArchived: false });
    const now = Date.now();
    const suggestions: CopilotSuggestion[] = [];

    const unassigned = events.filter(
      (event) => event.assigned_owner === null && event.event_date && new Date(event.event_date).getTime() >= now,
    );
    for (const event of unassigned.slice(0, 3)) {
      suggestions.push({
        id: `events-assign-team-${event.id}`,
        module: "events",
        label: `Assign a team owner for ${event.title}`,
        description: "No owner assigned yet for an upcoming Event.",
        actionId: "update-status",
        actionFacts: { eventId: event.id, status: event.status },
        tone: "warning",
      });
    }

    const upcomingSoon = events.filter((event) => {
      if (!event.event_date) return false;
      const eventTime = new Date(event.event_date).getTime();
      return eventTime >= now && eventTime - now <= THIRTY_DAYS_MS;
    });
    const checklistResults = await Promise.all(
      upcomingSoon.map(async (event) => ({ event, checklist: await getChecklistByEventId(event.id) })),
    );
    const withOverdueChecklist = checklistResults.filter(({ checklist }) =>
      checklist.some((item) => item.status !== "completed" && item.due_date && new Date(item.due_date).getTime() < now),
    );
    for (const { event } of withOverdueChecklist.slice(0, 3)) {
      suggestions.push({
        id: `events-checklist-${event.id}`,
        module: "events",
        label: `Review overdue checklist items for ${event.title}`,
        description: "One or more checklist items are past their due date on an Event happening within 30 days.",
        actionId: null,
        tone: "warning",
      });
    }

    const noSchedule = upcomingSoon.filter((event) => event.lifecycle_stage !== "post_event" && event.lifecycle_stage !== "closed");
    if (noSchedule.length > 0) {
      suggestions.push({
        id: "events-build-timeline",
        module: "events",
        label: `Confirm the day-of timeline for ${noSchedule.length} upcoming Event${noSchedule.length === 1 ? "" : "s"}`,
        description: "Events within 30 days still in an active lifecycle stage — worth a timeline pass before the date arrives.",
        actionId: null,
        tone: "info",
      });
    }

    const byDate = new Map<string, Event[]>();
    for (const event of events) {
      if (!event.event_date) continue;
      const list = byDate.get(event.event_date) ?? [];
      list.push(event);
      byDate.set(event.event_date, list);
    }
    for (const sameDay of byDate.values()) {
      if (sameDay.length < 2) continue;
      for (let i = 0; i < sameDay.length; i++) {
        for (let j = i + 1; j < sameDay.length; j++) {
          if (timeRangesOverlap(sameDay[i], sameDay[j])) {
            suggestions.push({
              id: `events-conflict-${sameDay[i].id}-${sameDay[j].id}`,
              module: "events",
              label: `Scheduling conflict: ${sameDay[i].title} and ${sameDay[j].title}`,
              description: `Both on ${sameDay[i].event_date} with overlapping times — confirm staffing and venue availability.`,
              actionId: null,
              tone: "warning",
            });
          }
        }
      }
    }

    return suggestions;
  },
};
