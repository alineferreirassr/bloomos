/**
 * The one seam every "what time is it right now" default should call,
 * instead of `new Date()` directly. A function like
 * `buildDailyOperationsBriefContext(materials, now: Date = clockNow())`
 * still behaves identically for every real caller (nothing passes an
 * explicit `now`, so this fires every time) — the difference only shows up
 * in a test, which can freeze time for the whole call graph with a single
 * `vi.spyOn(clockModule, "clockNow").mockReturnValue(fixedDate)`, without
 * threading a `now` parameter through every intermediate layer between a
 * Server Action and the deeply-nested pure function that actually needs it.
 *
 * Exists specifically so a date-sensitive test (e.g. "N days overdue")
 * never depends on which real calendar day it happens to run on.
 */
export function clockNow(): Date {
  return new Date();
}
