import type { HTMLAttributes, ReactNode } from "react";

/**
 * Checkpoint 19.2, Step 3 — a moving shimmer sweep (the shared
 * `luxury-shimmer` keyframe) instead of a flat opacity pulse, reading calmer
 * across the ~85 call sites that already use this component. Collapses to
 * a static block automatically under `prefers-reduced-motion`.
 */
export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`luxury-shimmer rounded-md ${className}`} {...props} />;
}

/** A full-width table skeleton — a header row plus N body rows, each column
 * proportioned like a real row (name wider, status/date narrower) so the
 * loading state previews the real layout instead of a generic gray block. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }): ReactNode {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className={`h-3 ${index === 0 ? "w-32" : "w-16"}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-b-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className={`h-4 ${colIndex === 0 ? "w-36" : "w-14"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A KPI/metric card grid skeleton — icon chip + label + value, matching
 * `KpiCard`'s own layout, so a loading dashboard/module page previews its
 * real shape instead of a row of plain rectangles. */
export function CardGridSkeleton({ count = 4 }: { count?: number }): ReactNode {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-2.5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
