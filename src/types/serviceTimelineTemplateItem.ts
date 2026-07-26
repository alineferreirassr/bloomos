import type { ScheduleCategory } from "@/core/enums/scheduleCategory";

/** One reusable day-of schedule entry a Service generates on every Event it's assigned to. `offset_minutes_from_event_start` is resolved against the Event's own start time at generation time to produce that real EventScheduleItem's `start_time`. Reuses ScheduleCategory — the same vocabulary real `event_schedule_items` rows already use. */
export interface ServiceTimelineTemplateItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  title: string;
  description: string | null;
  category: ScheduleCategory;
  offset_minutes_from_event_start: number;
  duration_minutes: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
