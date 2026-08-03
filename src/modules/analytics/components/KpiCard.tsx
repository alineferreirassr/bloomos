import { createElement } from "react";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { resolveMetricIcon } from "@/modules/analytics/components/metricIcons";
import type { AnalyticsMetricSnapshot } from "@/types/analytics";

function formatValue(value: number, unit: AnalyticsMetricSnapshot["metric"]["unit"]): string {
  if (unit === "currency") return formatMoney(Math.round(value), "USD");
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString();
}

const TREND_TONE: Record<AnalyticsMetricSnapshot["result"]["trend"], BadgeTone> = {
  up: "success",
  down: "danger",
  flat: "neutral",
};

const TREND_ARROW: Record<AnalyticsMetricSnapshot["result"]["trend"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

/** Step 4's own generic KPI Card — driven entirely by a computed `AnalyticsMetricSnapshot`, never a per-metric hand-built component. Every metric renders through this one component, matching Step 2's own "never hardcode calculations inside the UI" for the display layer too. */
export function KpiCard({ snapshot }: { snapshot: AnalyticsMetricSnapshot }) {
  const { metric, result } = snapshot;
  // Rendered via `createElement` rather than a `<Icon />` JSX tag — same reasoning `NodeRenderer.tsx` already documents: `resolveMetricIcon` is a static lookup table, never a component factory, but the React Compiler's static-components lint rule can't verify that for a JSX tag whose identifier was just locally assigned.
  const iconElement = createElement(resolveMetricIcon(metric.icon), { "aria-hidden": true, className: "h-3.5 w-3.5 shrink-0" });
  const trendLabel =
    result.changePercent === null
      ? "No prior-period comparison available"
      : `${result.changePercent >= 0 ? "up" : "down"} ${Math.abs(result.changePercent).toFixed(1)} percent versus the prior period`;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-text-muted">
            {iconElement}
            <h3 className="truncate text-xs font-medium uppercase tracking-wide">{metric.name}</h3>
          </div>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatValue(result.value, metric.unit)}</p>
        </div>
        <Badge tone={TREND_TONE[result.trend]}>
          <span aria-hidden="true">{TREND_ARROW[result.trend]}</span>{" "}
          {result.changePercent === null ? "—" : `${Math.abs(result.changePercent).toFixed(1)}%`}
          <span className="sr-only"> {trendLabel}</span>
        </Badge>
      </div>
      <p className="mt-2 text-xs text-text-muted">{metric.description}</p>
    </Card>
  );
}
