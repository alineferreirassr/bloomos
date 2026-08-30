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
  className = "",
}: {
  priority: TodaysPriorityData | null;
  viewAllHref?: string;
  viewAllLabel?: string;
  className?: string;
}) {
  return (
    <LuxuryCard className={className}>
      <SectionHeader
        title="Today's Priority"
        action={viewAllHref ? <Link href={viewAllHref} className="text-luxury-small font-medium text-luxury-rose">{viewAllLabel}</Link> : null}
      />
      {priority ? (
        <div className="mt-1">
          <p className="font-luxury-display text-2xl leading-tight font-semibold text-luxury-text sm:text-3xl">{priority.headline}</p>
          {priority.meta ? <p className="mt-2 text-luxury-small text-luxury-text-muted">{priority.meta}</p> : null}
        </div>
      ) : (
        <div className="mt-1 space-y-1">
          <p className="font-luxury-display text-2xl leading-tight font-semibold text-luxury-text">Nothing needs your attention right now ♡</p>
          <p className="text-luxury-small text-luxury-text-muted">A little breathing room is a good thing.</p>
        </div>
      )}
    </LuxuryCard>
  );
}
