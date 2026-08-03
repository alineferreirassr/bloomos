import type { CalendarEventSource } from "@/core/calendar/types";

/**
 * What the calendar can display, decoupled from how it's rendered — same
 * registry shape as `core/search/registry.ts` and
 * `core/commandPalette/registry.ts` on purpose. Nothing registers here yet
 * (Events integration is scheduling logic, explicitly out of scope for
 * this checkpoint).
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
