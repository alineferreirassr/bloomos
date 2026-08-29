import type { CalendarEventSource, CalendarRange, CalendarEventCategory } from "@/core/calendar/types";
import type { CalendarEvent } from "@/types/calendarEvent";
import type { ChecklistItem } from "@/types/checklistItem";
import { getEvents, getChecklistByEventId } from "@/lib/data";
import { CHECKLIST_STATUS_LABELS } from "@/core/enums/checklistStatus";

function dueDateWithinRange(dueDate: string, range: CalendarRange): boolean {
  const [year, month, day] = dueDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date >= range.start && date < range.end;
}

/** A checklist item's due date is a deadline (not just a task to do sometime) once it's urgent enough to warrant its own visual weight on the calendar — `high`/`critical` priority, matching `NotePriority`'s own top two tiers. */
function categoryFor(item: ChecklistItem): CalendarEventCategory {
  return item.priority === "high" || item.priority === "critical" ? "deadline" : "task";
}

function toCalendarEvent(item: ChecklistItem, eventId: string): CalendarEvent {
  return {
    id: `checklist_item:${item.id}`,
    title: item.title,
    start: `${item.due_date}T00:00:00`,
    end: `${item.due_date}T00:00:00`,
    allDay: true,
    sourceType: "checklist_item",
    sourceId: item.id,
    href: `/events/${eventId}/checklist`,
    category: categoryFor(item),
    assignedName: item.assigned_name,
    statusLabel: CHECKLIST_STATUS_LABELS[item.status],
  };
}

/**
 * Advanced Calendar phase — shows dated Event checklist items on the
 * calendar without a second task-fetching pathway or a duplicate task
 * store: it reuses `getChecklistByEventId` per Event, the same
 * per-event-chain pattern `getTeamDashboardData.ts` already established
 * for "My Tasks." Only items with a `due_date` and not already
 * `completed`/`cancelled` are calendar-worthy — a task with no due date
 * has nothing to plot, and a closed-out item is no longer something to
 * act on.
 */
export function createTaskCalendarSource(): CalendarEventSource {
  return {
    sourceType: "checklist_item",
    label: "Tasks",
    async fetch(range, workspaceId, context) {
      const events = await getEvents(undefined, context);
      const activeEvents = events.filter((event) => event.workspace_id === workspaceId && event.archived_at === null && event.cancelled_at === null);

      const perEventItems = await Promise.all(
        activeEvents.map(async (event) => {
          const items = await getChecklistByEventId(event.id, context);
          return items
            .filter((item) => item.due_date !== null && item.status !== "completed" && item.status !== "cancelled")
            .filter((item) => dueDateWithinRange(item.due_date as string, range))
            .map((item) => toCalendarEvent(item, event.id));
        }),
      );

      return perEventItems.flat();
    },
  };
}
