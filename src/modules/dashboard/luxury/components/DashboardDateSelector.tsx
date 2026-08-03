import { LuxuryCalendarIcon } from "@/modules/dashboard/luxury/luxuryIcons";

/**
 * A plain, real display of today's date — deliberately not a functioning
 * date-range picker: nothing behind these dashboards is scoped to a
 * selectable date range today, and rendering a chevron that implies
 * switchable content with no real effect would fail Step 13's "do not
 * display fabricated data" in spirit. Real text only.
 */
export function DashboardDateSelector({ date = new Date() }: { date?: Date }) {
  // A fixed locale, never `undefined` — the server (Node's own OS/ICU
  // locale) and the browser can otherwise resolve `undefined` to two
  // different locales and format identical text differently ("28 de
  // julho de 2026" vs. "July 28, 2026"), a real hydration mismatch this
  // checkpoint's own browser verification caught.
  const formatted = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <span className="inline-flex items-center gap-2 rounded-luxury-full border border-luxury-border bg-luxury-surface px-3.5 py-2 text-luxury-small font-medium text-luxury-text">
      <LuxuryCalendarIcon className="h-4 w-4 text-luxury-rose" aria-hidden="true" />
      {formatted}
    </span>
  );
}
