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
}
