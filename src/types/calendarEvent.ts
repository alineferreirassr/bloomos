import type { CalendarEventCategory } from "@/core/calendar/types";

/**
 * A generic, source-agnostic calendar entry — deliberately not the same
 * type as `Event` (BloomOS's proposal/wedding/etc. engagement record). A
 * calendar can and eventually will show more than Events (team shifts,
 * purchase deliveries), so the calendar domain owns its own shape and
 * each `CalendarEventSource` maps its own records into this one, rather
 * than the calendar depending on any one module's type.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  sourceType: string;
  sourceId: string;
  /** Where clicking through to the underlying record goes, if anywhere. */
  href?: string;
  /** Which of the Advanced Calendar's closed icon/filter categories this entry belongs to — every real source classifies its own entries, never inferred by the UI. */
  category: CalendarEventCategory;
  /** Free-text assignee name, only when the underlying record actually carries one (e.g. `Event.assigned_owner`, `ChecklistItem.assigned_name`) — never fabricated. */
  assignedName?: string | null;
  /** A human-readable status label from the underlying record's own status enum — never fabricated. */
  statusLabel?: string | null;
  /** Weather integration's minimal Calendar extension point — populated only by sources whose underlying record actually carries coordinates/timezone (currently just Events, from `Event.latitude`/`longitude`/`timezone`), never fabricated or geocoded from an address. Absent entirely on sources that don't carry location (e.g. tasks). */
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
}
