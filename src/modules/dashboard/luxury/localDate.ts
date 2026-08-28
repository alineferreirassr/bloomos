/**
 * The browser's own local calendar date as `YYYY-MM-DD` — deliberately not
 * `date.toISOString().slice(0, 10)`, which converts to UTC first and can
 * land on the wrong day near midnight in any non-UTC timezone. Used
 * everywhere a personal wellness widget needs "today" so it resets on the
 * employee's own clock, not the server's — the same class of bug the
 * Dashboard greeting fix addressed for time-of-day.
 */
export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date-only `YYYY-MM-DD` business field for display without ever
 * routing through UTC — `new Date("YYYY-MM-DD")` parses as UTC midnight,
 * which lands on the previous calendar day once formatted anywhere behind
 * UTC (e.g. `2026-08-22` renders as "Aug 21" in America/Los_Angeles). A
 * date-only field has no instant-of-time and must render the same calendar
 * date regardless of the reader's timezone, so this constructs the `Date`
 * from its local year/month/day components instead of parsing the string.
 */
export function formatDateOnlyLabel(dateOnly: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = dateOnly.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", options);
}
