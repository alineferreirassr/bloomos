interface SocialAnalyticsTrendChartProps {
  /** Ascending by date — already the read model's own ordering. */
  points: { date: string; value: number }[];
  label: string;
}

const WIDTH = 640;
const HEIGHT = 140;
const PADDING_BOTTOM = 20;
const PADDING_TOP = 8;

function shortDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * SOCIAL-05E — a dependency-free line chart, matching
 * `RevenueTrendChart.tsx`'s own established "no chart library anywhere in
 * this codebase" precedent exactly (inline SVG, a `<title>` per point for
 * the same text-equivalent every other chart here already provides).
 * Every point here is a real, persisted snapshot value — this component
 * never receives (and therefore never renders) a fabricated zero for a
 * missing day; the caller only passes points that actually exist.
 */
export function SocialAnalyticsTrendChart({ points, label }: SocialAnalyticsTrendChartProps) {
  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const plotWidth = WIDTH;
  const plotHeight = HEIGHT - PADDING_BOTTOM - PADDING_TOP;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((point, index) => {
    const x = points.length > 1 ? index * stepX : plotWidth / 2;
    const y = PADDING_TOP + plotHeight - (point.value / maxValue) * plotHeight;
    return { x, y, point };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${label} trend`} className="h-32 w-full">
      {points.length > 1 ? <path d={linePath} fill="none" className="stroke-accent" strokeWidth={2} /> : null}
      {coords.map(({ x, y, point }) => (
        <g key={point.date}>
          <title>{`${shortDateLabel(point.date)}: ${point.value.toLocaleString()} ${label}`}</title>
          <circle cx={x} cy={y} r={3} className="fill-accent" />
        </g>
      ))}
      {coords.length > 0 ? (
        <>
          <text x={coords[0].x} y={HEIGHT - 6} textAnchor="start" className="fill-current text-[9px] text-text-muted">
            {shortDateLabel(coords[0].point.date)}
          </text>
          {coords.length > 1 ? (
            <text x={coords[coords.length - 1].x} y={HEIGHT - 6} textAnchor="end" className="fill-current text-[9px] text-text-muted">
              {shortDateLabel(coords[coords.length - 1].point.date)}
            </text>
          ) : null}
        </>
      ) : null}
    </svg>
  );
}
