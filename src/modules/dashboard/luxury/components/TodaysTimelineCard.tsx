import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { ScheduleTimeline, type ScheduleTimelineItemData } from "@/modules/dashboard/luxury/components/ScheduleTimeline";

/** AF-Inspired "Today, at a Glance" Reconstruction — a wrapper around the
 * already-shared `ScheduleTimeline` primitive (the exact list renderer
 * Team's "Today's Schedule" and Client's "Event Timeline" already use),
 * adding AF Digital Studio OS's own `DayTimeline` composition: heading,
 * subtitle, an honest empty state, and quiet footer navigation to
 * BloomOS's own real Calendar route — never the AF app's URL, never a
 * pixel-positioned hour-grid (that engine reads AF's own minute-level
 * schedule model, which this checkpoint does not attempt to reproduce). */
export function TodaysTimelineCard({
  items,
  addEventHref = "/calendar",
  viewCalendarHref = "/calendar",
  showFooterLinks = true,
  compact = false,
  className = "",
}: {
  items: ScheduleTimelineItemData[];
  addEventHref?: string;
  viewCalendarHref?: string;
  /** False for the Client Portal, which has no internal `/calendar` route of its own — never point a client at BloomOS's internal team calendar. */
  showFooterLinks?: boolean;
  /** Trims card padding and empty-state spacing for narrow paired layouts — opt-in, default unchanged. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <LuxuryCard padding={compact ? "compact" : "default"} className={`${compact ? "lg:p-5" : ""} ${className}`}>
      <h2 className="font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">Today&apos;s Timeline</h2>
      <p className="mt-1 text-luxury-small text-luxury-text-muted">A gentle look at your day.</p>
      {items.length === 0 ? (
        <div className={`${compact ? "mt-2" : "mt-4"} space-y-1`}>
          <p className="font-luxury-display text-lg leading-tight font-semibold text-luxury-text">Your day is open ♡</p>
          <p className="text-luxury-small text-luxury-text-muted">Nothing is scheduled yet.</p>
        </div>
      ) : (
        <div className={compact ? "mt-2" : "mt-4"}>
          <ScheduleTimeline items={items} />
        </div>
      )}
      {showFooterLinks ? (
        <div className={`${compact ? "mt-2" : "mt-4"} flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-luxury-border pt-3`}>
          <Link href={addEventHref} className="text-luxury-small font-medium text-luxury-rose hover:underline">
            + Add event
          </Link>
          <Link href={viewCalendarHref} className="text-luxury-small font-medium text-luxury-rose hover:underline">
            View full calendar
          </Link>
        </div>
      ) : null}
    </LuxuryCard>
  );
}
