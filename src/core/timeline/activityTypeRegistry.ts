import { TIMELINE_ACTIVITY_TYPES, TIMELINE_ACTIVITY_LABELS, type TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * `TimelineActivityType` (`core/enums/timelineActivityType.ts`) is a closed
 * string-literal union — every module that wants a new activity type has
 * had to add it there directly, which means "Core" itself had to change
 * every time a business module grew. This type widens that for anything
 * built going forward: still autocompletes the ~90 known values, but also
 * accepts any string, so a future module can mint its own activity types
 * without a Core-file edit.
 *
 * The `string & {}` shape (rather than plain `string`) is deliberate — it
 * keeps TypeScript's literal-union autocomplete working for the known
 * values while still widening acceptance, unlike a bare `string` which
 * would erase the union entirely.
 */
export type CoreTimelineActivityType = TimelineActivityType | (string & {});

const registeredTypes = new Map<string, string>(Object.entries(TIMELINE_ACTIVITY_LABELS));

/**
 * Registers a new activity type + its display label at module-init time —
 * this is the "register without modifying Core" mechanism. Re-registering
 * an existing type (mock hot-reload, duplicate module init) just overwrites
 * its label rather than erroring, since that's a harmless no-op in practice.
 */
export function registerTimelineActivityType(type: string, label: string): void {
  registeredTypes.set(type, label);
}

export function isRegisteredTimelineActivityType(type: string): type is CoreTimelineActivityType {
  return registeredTypes.has(type);
}

/** Falls back to the raw type string when nothing registered it — never throws, since this only drives display. */
export function getTimelineActivityLabel(type: string): string {
  return registeredTypes.get(type) ?? type;
}

export function listRegisteredTimelineActivityTypes(): string[] {
  return [...registeredTypes.keys()];
}

/** Re-exported so a Core-only consumer doesn't also need to import from `core/enums` directly. */
export { TIMELINE_ACTIVITY_TYPES, TIMELINE_ACTIVITY_LABELS, type TimelineActivityType };
