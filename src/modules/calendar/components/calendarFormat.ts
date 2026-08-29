import type { CalendarEvent } from "@/types/calendarEvent";

/** `YYYY-MM-DD` key for a local `Date` — never `toISOString()`, which shifts to UTC and can land on the wrong local day. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** `CalendarEvent.start` is always `"YYYY-MM-DDTHH:MM:SS"` local time (see each source's own mapper) — the date is just its first 10 characters, no `Date` parsing/timezone conversion needed. */
export function eventDateKey(event: CalendarEvent): string {
  return event.start.slice(0, 10);
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    const existing = map.get(key);
    if (existing) existing.push(event);
    else map.set(key, [event]);
  }
  for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
  return map;
}

export function formatEventTime(iso: string, allDay: boolean): string {
  if (allDay) return "All day";
  const time = iso.split("T")[1] ?? "00:00";
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr} ${period}`;
}
