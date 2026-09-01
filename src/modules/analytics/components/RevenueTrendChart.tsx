import { formatMoney } from "@/lib/money";

interface RevenueTrendChartProps {
  rows: { label: string; revenueMinor: number }[];
  currency: string;
}

const WIDTH = 640;
const HEIGHT = 160;
const PADDING_BOTTOM = 24;
const BAR_GAP = 6;
const MONTH_ABBREVIATIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `groupByMonth`'s own row label is a raw `"YYYY-MM"` bucket key (see `core/analytics/engine.ts`), not a display string — turn it into a short month abbreviation for the chart's x-axis. */
function shortMonthLabel(label: string): string {
  const month = Number(label.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? MONTH_ABBREVIATIONS[month - 1] : label.slice(0, 3);
}

/**
 * A dependency-free monthly revenue bar chart. BloomOS has no chart library
 * anywhere in the codebase — this renders directly as inline SVG rather than
 * introducing one, matching the Phase 08 brief's "one real chart only if it
 * clarifies" without adding a second competing chart dependency.
 */
export function RevenueTrendChart({ rows, currency }: RevenueTrendChartProps) {
  const maxMinor = Math.max(1, ...rows.map((r) => r.revenueMinor));
  const barWidth = rows.length > 0 ? WIDTH / rows.length - BAR_GAP : 0;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Monthly revenue trend" className="h-40 w-full">
      {rows.map((row, index) => {
        const barHeight = (row.revenueMinor / maxMinor) * (HEIGHT - PADDING_BOTTOM - 8);
        const x = index * (barWidth + BAR_GAP);
        const y = HEIGHT - PADDING_BOTTOM - barHeight;
        return (
          <g key={row.label}>
            <title>{`${row.label}: ${formatMoney(row.revenueMinor, currency)}`}</title>
            <rect x={x} y={y} width={Math.max(barWidth, 1)} height={Math.max(barHeight, 1)} rx={3} className="fill-accent/70" />
            <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-current text-[9px] text-text-muted">
              {shortMonthLabel(row.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
