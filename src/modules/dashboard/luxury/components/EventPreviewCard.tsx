import Link from "next/link";
import Image from "next/image";

export interface EventPreviewCardData {
  id: string;
  title: string;
  dayLabel: string;
  monthLabel: string;
  timeLabel: string | null;
  categoryLabel: string;
  imageUrl: string | null;
  href: string;
}

/** Checkpoint 19, Step 3/6 — one row in the Owner Dashboard's "Upcoming Events" list: a small thumbnail, a day/month date badge, title, time, and category pill — matches the approved Owner reference image's list rows exactly. */
export function EventPreviewCard({ data }: { data: EventPreviewCardData }) {
  return (
    <Link
      href={data.href}
      className="flex items-center gap-3 rounded-luxury-md p-2 transition-colors duration-150 hover:bg-luxury-blush/40 focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]"
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-luxury-md bg-luxury-blush">
        {data.imageUrl ? <Image src={data.imageUrl} alt="" fill sizes="48px" className="object-cover" /> : null}
      </span>
      <span className="flex w-11 shrink-0 flex-col items-center rounded-luxury-sm bg-luxury-surface-tint py-1 text-center">
        <span className="text-[10px] font-semibold tracking-wide text-luxury-rose uppercase">{data.monthLabel}</span>
        <span className="font-luxury-display text-base leading-none font-semibold text-luxury-text">{data.dayLabel}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-luxury-body font-semibold text-luxury-text">{data.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {data.timeLabel ? <span className="text-luxury-small text-luxury-text-muted">{data.timeLabel}</span> : null}
          <span className="rounded-luxury-full bg-luxury-blush px-2 py-0.5 text-[10px] font-semibold text-luxury-blush-foreground">{data.categoryLabel}</span>
        </span>
      </span>
    </Link>
  );
}
