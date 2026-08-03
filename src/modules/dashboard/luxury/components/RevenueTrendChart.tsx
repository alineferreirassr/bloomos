export interface RevenueTrendPoint {
  label: string;
  valueMinor: number;
}

const WIDTH = 560;
const HEIGHT = 140;
const PADDING = 8;

/**
 * Checkpoint 19, Step 6 — the Owner Dashboard's "Revenue Overview" line. A
 * small, dependency-free inline SVG polyline (this codebase has no
 * charting library, and adding one for a single sparkline was judged out
 * of proportion to this checkpoint) plotting a real, computed month-by-
 * month revenue series — never a fabricated shape. `points.length < 2`
 * renders nothing (a single point can't draw a meaningful line).
 */
export function RevenueTrendChart({ points }: { points: RevenueTrendPoint[] }) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.valueMinor);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const stepX = (WIDTH - PADDING * 2) / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = PADDING + index * stepX;
    const y = PADDING + (HEIGHT - PADDING * 2) * (1 - (point.valueMinor - min) / range);
    return { x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${HEIGHT - PADDING} L ${coords[0].x.toFixed(1)} ${HEIGHT - PADDING} Z`;
  const last = coords[coords.length - 1];

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-32 w-full" role="img" aria-label="Revenue trend over recent months" preserveAspectRatio="none">
        <path d={areaPath} fill="var(--luxury-rose)" opacity="0.12" />
        <path d={linePath} fill="none" stroke="var(--luxury-rose)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="4" fill="var(--luxury-rose)" />
      </svg>
      <div className="mt-1 flex justify-between text-luxury-small text-luxury-text-muted">
        {points.map((point) => (
          <span key={point.label}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}
