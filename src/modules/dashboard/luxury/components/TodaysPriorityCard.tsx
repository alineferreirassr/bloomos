import Link from "next/link";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";

/** AF-Inspired "Today, at a Glance" Reconstruction — a single, calm headline
 * instead of a list, mirroring AF Digital Studio OS's own `TodaysPriority`
 * (`pickTodaysPriority`, one deterministically-chosen item, never a ranked
 * list rendered in full). `headline` is real, caller-supplied content —
 * this component never invents a task; the empty state below is the only
 * fixed copy, matching AF's own exact fallback wording. */
export interface TodaysPriorityData {
  headline: string;
  meta?: string | null;
}

export function TodaysPriorityCard({
  priority,
  viewAllHref,
  viewAllLabel = "View all",
  compact = false,
  className = "",
}: {
  priority: TodaysPriorityData | null;
  viewAllHref?: string;
  viewAllLabel?: string;
  /** Trims card padding and the headline's own type scale for narrow paired layouts (e.g. beside Little Reminder or Upcoming Events at 375px) — opt-in, default unchanged. */
  compact?: boolean;
  className?: string;
}) {
  const headlineSize = compact ? "text-luxury-section sm:text-2xl lg:text-3xl" : "text-2xl sm:text-3xl";
  return (
    <LuxuryCard padding={compact ? "compact" : "default"} className={`${compact ? "lg:p-5" : ""} ${className}`}>
      <SectionHeader
        title="Today's Priority"
        action={viewAllHref ? <Link href={viewAllHref} className="text-luxury-small font-medium text-luxury-rose">{viewAllLabel}</Link> : null}
      />
      {priority ? (
        <div className="mt-1">
          <p className={`font-luxury-display leading-tight font-semibold text-luxury-text ${headlineSize}`}>{priority.headline}</p>
          {priority.meta ? <p className="mt-2 text-luxury-small text-luxury-text-muted">{priority.meta}</p> : null}
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          <p className={`font-luxury-display leading-tight font-semibold text-luxury-text ${headlineSize}`}>Nothing needs your attention right now ♡</p>
          <p className="text-luxury-small text-luxury-text-muted">A little breathing room is a good thing.</p>
        </div>
      )}
    </LuxuryCard>
  );
}
