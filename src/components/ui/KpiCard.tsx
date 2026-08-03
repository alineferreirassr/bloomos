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

function CardBody({ label, value, helper, icon: Icon, trend, sparkline }: Omit<KpiCardProps, "href">) {
  return (
    <Card className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-100">
        <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium tracking-wide text-text-muted uppercase">{label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="font-serif text-2xl font-semibold text-text tabular-nums">{value}</p>
          {sparkline ? <Sparkline points={sparkline} /> : null}
        </div>
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
