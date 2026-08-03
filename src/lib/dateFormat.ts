/**
 * Formats a date-only ("YYYY-MM-DD") or full ISO timestamp string for
 * display, in local time. Always takes just the date portion
 * (`.slice(0, 10)`) before constructing the Date from local year/month/day
 * components — `new Date("2026-07-17")` parses as UTC midnight, so
 * `.toLocaleDateString()` in a timezone behind UTC would otherwise render
 * the day before.
 *
 * Shared by formatInventoryDate, formatPurchaseDate, and formatDocumentDate,
 * which were previously identical copies of this same logic.
 */
export function formatDateOnly(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString();
}
