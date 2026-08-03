import { createElement } from "react";
import { resolveLuxuryIcon } from "@/modules/dashboard/luxury/resolveLuxuryIcon";

export interface ScheduleTimelineItemData {
  id: string;
  timeLabel: string;
  title: string;
  subtitle: string | null;
  icon: string;
  done?: boolean;
}

/**
 * Checkpoint 19, Step 3/6/7/9 — the vertical time-marker list shared by the
 * Team Dashboard's "Today's Schedule" and the Client Dashboard's "Event
 * Timeline" (same composition, different data). A `<ol>` (not a `<div>`
 * soup) with each time genuinely marked up as the item's own label —
 * Step 14's own "screen-reader-friendly timelines."
 */
export function ScheduleTimeline({ items }: { items: ScheduleTimelineItemData[] }) {
  return (
    <ol className="relative space-y-5 border-l border-luxury-border pl-5">
      {items.map((item, index) => {
        const iconElement = createElement(resolveLuxuryIcon(item.icon), { className: "h-3.5 w-3.5", "aria-hidden": true });
        return (
          <li key={item.id} className={`animate-timeline-reveal stagger-${Math.min(index, 6)} relative`}>
            <span
              className={`absolute top-0.5 -left-[27px] flex h-5 w-5 items-center justify-center rounded-full ${item.done ? "bg-luxury-rose text-luxury-rose-foreground" : "bg-luxury-blush text-luxury-blush-foreground"}`}
              aria-hidden="true"
            >
              {iconElement}
            </span>
            <p className="text-luxury-small font-semibold text-luxury-rose">{item.timeLabel}</p>
            <p className={`mt-0.5 text-luxury-body font-medium ${item.done ? "text-luxury-text-muted line-through" : "text-luxury-text"}`}>{item.title}</p>
            {item.subtitle ? <p className="text-luxury-small text-luxury-text-muted">{item.subtitle}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
