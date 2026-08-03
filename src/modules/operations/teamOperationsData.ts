import { getEvents, getChecklistByEventId, getTimelineByEventId } from "@/lib/data";
import { getLiveEventLog } from "@/core/operations/operationsStore";
import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { TimelineActivity } from "@/types/timelineActivity";

export interface TeamOperationsView {
  todaysEvents: Event[];
  myEvents: Event[];
  assignedTasks: ChecklistItem[];
  timeline: TimelineActivity[];
  isCheckedIn: boolean;
  lastCheckInAt: string | null;
}

function isToday(eventDate: string | null): boolean {
  if (!eventDate) return false;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).setHours(0, 0, 0, 0);
  return eventMidnight === new Date().setHours(0, 0, 0, 0);
}

/**
 * Team Operations (v2 Checkpoint 21, Step 6) — every team member's own
 * operational view. Reuses the exact `Event.assigned_owner === fullName`
 * string-match convention `generateTeamBrief` (Checkpoint 20) already
 * established, since this codebase still has no id-based Team Member FK on
 * Event or ChecklistItem — so this page never disagrees with what the
 * Copilot's own Team Brief already shows for "my events."
 *
 * "Inventory" and "Messages" (named in the spec) have no real per-team-
 * member assignment or internal messaging system in this codebase today —
 * honestly omitted here rather than fabricated (see Known Limitations in
 * the Checkpoint 21 certification report). "Navigation Notes" surfaces each
 * event's own real location fields, the closest real proxy that exists.
 * "Shift Status" is derived from this member's own Live Event Log check-in/
 * check-out entries for today's events.
 */
export async function getTeamOperationsView(fullName: string): Promise<TeamOperationsView> {
  const events = await getEvents({ includeArchived: false });
  const myEvents = events.filter((event) => event.assigned_owner === fullName && event.status !== "cancelled" && event.status !== "archived");
  const todaysEvents = myEvents.filter((event) => isToday(event.event_date));

  const [checklistLists, timelineLists, logLists] = await Promise.all([
    Promise.all(myEvents.map((event) => getChecklistByEventId(event.id))),
    Promise.all(todaysEvents.map((event) => getTimelineByEventId(event.id))),
    Promise.all(todaysEvents.map((event) => getLiveEventLog(event.id))),
  ]);

  const assignedTasks = checklistLists.flat().filter((item) => item.assigned_name === fullName && item.status !== "completed" && item.status !== "cancelled");
  const timeline = timelineLists.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const myLog = logLists.flat().filter((entry) => entry.logged_by_name === fullName).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const lastEntry = myLog[0] ?? null;
  const isCheckedIn = lastEntry?.kind === "check_in";

  return {
    todaysEvents,
    myEvents,
    assignedTasks,
    timeline,
    isCheckedIn,
    lastCheckInAt: lastEntry?.occurred_at ?? null,
  };
}
