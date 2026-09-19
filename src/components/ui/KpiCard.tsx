import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Card } from "@/components/ui/Card";

export interface KpiCardTrend {
  direction: "up" | "down" | "flat";
  /** Pre-formatted, e.g. "12%" or "+$400" — this component never computes the number itself. */
  label: string;
}

export interface KpiCardProps {
  label: string;
  value: string;
  helper?: string | null;
  href?: string | null;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Step 7 — a real period-over-period comparison, pre-computed by the caller from its own already-fetched series. */
  trend?: KpiCardTrend;
  /** Step 7 — a short real numeric series (oldest first) rendered as a tiny inline sparkline. */
  sparkline?: number[];
  /** GLOBAL-VISUAL-02B — an optional per-metric tint (a CSS color value, e.g.
   * "var(--color-success)") for the icon medallion, the same differentiation
   * LuxuryMetricCard's own ICON_TINT gives Dashboard/Team's cards. Falls back
   * to the existing flat accent tint, so every current call site (all without
   * this prop) renders with the same accent color it always has. */
  tint?: string;
  /** GLOBAL-VISUAL-02B — same opt-in sizing step-down as LuxuryMetricCard's own
   * `compact`, for a caller that wants to give a subset of its metrics less
   * visual weight (secondary/supporting figures) instead of one equal-weight
   * card wall. Defaults to false — no existing caller's size changes. */
  compact?: boolean;
}

const TREND_TONE: Record<KpiCardTrend["direction"], string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-text-muted",
};

const TREND_ARROW: Record<KpiCardTrend["direction"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const width = 64;
  const height = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });
  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `M ${coords[0].x.toFixed(1)} ${height} L ${coords
    .map((c) => `${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" L ")} L ${coords[coords.length - 1].x.toFixed(1)} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-6 w-16 shrink-0 text-accent" aria-hidden="true">
      <path d={areaPath} fill="currentColor" opacity="0.12" />
      <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardBody({ label, value, helper, icon: Icon, trend, sparkline, tint, compact }: Omit<KpiCardProps, "href">) {
  const iconTint = tint ?? "var(--color-accent)";
  const iconSize = compact ? "h-8 w-8" : "h-10 w-10";
  const valueSize = compact ? "text-lg" : "text-[1.625rem]";
  return (
    <Card className={`flex flex-col items-start ${compact ? "gap-2.5 p-3.5" : "gap-3.5"}`} style={{ borderRadius: 14 }}>
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full ${iconSize}`}
          style={{ backgroundColor: `color-mix(in srgb, ${iconTint} 16%, var(--color-surface))` }}
        >
          <Icon className={compact ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} style={{ color: iconTint }} aria-hidden="true" />
        </span>
        {sparkline ? <Sparkline points={sparkline} /> : null}
      </div>
      <div className="min-w-0">
        <p className={`font-serif leading-none font-semibold text-text tabular-nums ${valueSize}`}>{value}</p>
        <p className="mt-1.5 truncate text-xs font-medium tracking-wide text-text-muted uppercase">{label}</p>
        {helper ? <p className="mt-0.5 text-xs text-text-muted">{helper}</p> : null}
        {trend ? (
          <p className={`mt-0.5 text-xs font-medium tabular-nums ${TREND_TONE[trend.direction]}`}>
            <span aria-hidden="true">{TREND_ARROW[trend.direction]}</span> {trend.label}
            <span className="sr-only"> versus the prior period</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * Checkpoint 19.1 — Global Luxury Rollout. Checkpoint 19.2, Step 7 added the
 * optional `trend`/`sparkline` props — both opt-in, so every existing call
 * site (label/value/helper/icon only) keeps rendering identically. The
 * generic, Classical-token counterpart of the Owner Dashboard's own
 * `LuxuryMetricCard`, for every other module's KPI row.
 *
 * GLOBAL-VISUAL-02B — this previously diverged from LuxuryMetricCard in
 * real, structural ways (horizontal icon-left layout vs. its vertical
 * icon-top one, a flat rounded-square icon badge vs. a tinted circular
 * medallion, sans-serif value vs. serif) — the actual, compositional reason
 * every one of this component's 39 consumers (Events, Leads, Clients,
 * Contracts, Finance, Vendors, Purchases, Inventory, Automation, ...) still
 * read as visually different from Dashboard/Team/Relationships even though
 * they already shared the same color tokens. Rebuilt to match
 * LuxuryMetricCard's composition exactly while staying in the Classical
 * Card/token namespace (no cross-shell import) — same props for every
 * existing caller, so this is presentation-only.
 */
export function KpiCard(props: KpiCardProps): ReactNode {
  if (props.href) {
    return (
      <Link
        href={props.href}
        className="hover-lift block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        <CardBody {...props} />
      </Link>
    );
  }
  return <CardBody {...props} />;
}
