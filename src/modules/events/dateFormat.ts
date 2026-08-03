/**
 * Formats a "YYYY-MM-DD" date-only string for display, in local time.
 * `new Date("2026-07-17")` parses as UTC midnight, so `.toLocaleDateString()`
 * in a timezone behind UTC renders the day before — this constructs the
 * Date from local year/month/day components instead, avoiding that
 * off-by-one.
 */
export function formatEventDate(date: string | null): string {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}
