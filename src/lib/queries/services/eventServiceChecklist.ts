import { getChecklistByEventId } from "@/lib/data";
import type { ChecklistItem } from "@/types/checklistItem";

/**
 * A generated ChecklistItem is owned by `owner_type: "event"` /
 * `owner_id: event_id` — there is no first-class "checklist items for this
 * EventService" query in the Events repository. `source_event_service_id`
 * is the only thread back to a specific assignment (set only on rows this
 * EventService generated at assignment time), so the Workspace's Template
 * Execution section fetches the Event's full checklist (already exposed by
 * the Events repository) and filters client-side, rather than inventing a
 * new repository method that would just do the same filter server-side for
 * a per-event list that's already small.
 */
export async function getEventServiceChecklistItems(eventServiceId: string, eventId: string): Promise<ChecklistItem[]> {
  const items = await getChecklistByEventId(eventId);
  return items.filter((item) => item.source_event_service_id === eventServiceId);
}
