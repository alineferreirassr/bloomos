import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

export type StudioTodayCardTone = "blush" | "champagne" | "rose";

export interface StudioTodayCardData {
  id: string;
  label: string;
  value: string;
  /** Small truthful context in the card's top-right corner (e.g. "next 14 days") — omitted entirely when there's nothing truthful to say, never filled with meaningless text just for visual symmetry. */
  meta?: string | null;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href?: string | null;
  tone?: StudioTodayCardTone;
}

const TONE_ICON_CLASS: Record<StudioTodayCardTone, string> = {
  blush: "bg-luxury-blush text-luxury-rose",
  champagne: "text-luxury-coral",
  rose: "text-luxury-rose",
};

/** Inline background for the two non-default tones — a `color-mix()` of an
 * existing token, expressed as a plain style rather than a Tailwind
 * arbitrary-value class, since that syntax's parsing of a comma-bearing
 * nested function isn't an established pattern anywhere else in this
 * codebase. */
const TONE_ICON_BACKGROUND: Partial<Record<StudioTodayCardTone, string>> = {
  champagne: "color-mix(in srgb, var(--luxury-coral) 20%, transparent)",
  rose: "color-mix(in srgb, var(--luxury-rose) 16%, transparent)",
};

/**
 * VISUAL-01 Revision B — Workspace's own "At a Glance / The studio today"
 * operational card. Originally built for Home (as `StudioTodayMetricCard`)
 * then relocated here once the founder moved this entire operational
 * overview off Home and onto Workspace — reused rather than rebuilt, per
 * the founder's own "don't leave orphaned Revision A code" instruction.
 * Uses the same `--luxury-*` design tokens as the Luxury Dashboard (these
 * are plain global CSS custom properties, available anywhere in the app —
 * reusing them here does not put Workspace "on" the Luxury Dashboard
 * system, and none of Workspace's existing Classical `src/components/ui/*`
 * primitives are touched). `tone` gives icon chips a restrained, three-way
 * palette (blush/champagne/rose) so cards read as categorized without
 * becoming a "rainbow dashboard" — the card surface itself stays neutral
 * ivory for every tone.
 */
export function StudioTodayCard({ data }: { data: StudioTodayCardData }) {
  const tone = data.tone ?? "blush";
  const Icon = data.icon;

  const card = (
    <div className="flex h-full flex-col gap-5 rounded-luxury-lg border border-luxury-border bg-luxury-surface p-7 shadow-luxury-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-luxury-md ${TONE_ICON_CLASS[tone]}`} style={TONE_ICON_BACKGROUND[tone] ? { backgroundColor: TONE_ICON_BACKGROUND[tone] } : undefined}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {data.meta ? <span className="mt-1 text-luxury-small text-luxury-text-muted">{data.meta}</span> : null}
      </div>
      <div>
        <p className="font-luxury-display text-luxury-numeric font-semibold text-luxury-text">{data.value}</p>
        <p className="mt-1 text-luxury-small text-luxury-text-muted">{data.label}</p>
      </div>
    </div>
  );

  if (data.href) {
    return (
      <Link href={data.href} className="block h-full rounded-luxury-lg transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:[box-shadow:var(--luxury-focus-ring)]">
        {card}
      </Link>
    );
  }
  return card;
}
