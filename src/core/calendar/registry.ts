import type { CalendarEventSource } from "@/core/calendar/types";

/**
 * What the calendar can display, decoupled from how it's rendered — same
 * registry shape as `core/search/registry.ts` and
 * `core/commandPalette/registry.ts` on purpose.
 *
 * Weather integration note: Weather is not a `CalendarEventSource` — it
 * augments existing entries rather than adding new ones, so it needed no
 * registry entry of its own. Its extension point is the few optional
 * `latitude`/`longitude`/`timezone` fields added to `CalendarEvent`
 * (`src/types/calendarEvent.ts`), populated today only by
 * `createEventsCalendarSource` from the real `Event` record. Any future
 * source that carries a real location should populate those same fields
 * rather than inventing a parallel mechanism.
 */
const registry = new Map<string, CalendarEventSource>();

export function registerCalendarEventSource(source: CalendarEventSource): void {
  registry.set(source.sourceType, source);
}

export function unregisterCalendarEventSource(sourceType: string): void {
  registry.delete(sourceType);
}

export function getCalendarEventSources(): CalendarEventSource[] {
  return [...registry.values()];
}

/** Test-only: restore the registry to empty between test cases. */
export function resetCalendarEventSourceRegistry(): void {
  registry.clear();
}
