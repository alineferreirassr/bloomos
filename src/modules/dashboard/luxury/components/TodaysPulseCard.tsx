import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";

/** AF-Inspired "Today, at a Glance" Reconstruction — a compact metrics
 * roundup beside Today's Timeline, inspired by AF Digital Studio OS's own
 * "Today's Pulse" tile. AF's own row set (Priorities/Events/Tasks
 * pending/Habits) is not copied verbatim — BloomOS has no habits system,
 * so callers pass only the metrics they can compute from real, already-
 * fetched dashboard data (2-4 rows depending on role); this component
 * never pads the list to match a row count. */
export interface TodaysPulseMetric {
  label: string;
  value: string;
}

export function TodaysPulseCard({ metrics, compact = false, className = "" }: { metrics: TodaysPulseMetric[]; compact?: boolean; className?: string }) {
  const allZero = metrics.length > 0 && metrics.every((metric) => metric.value === "0");
  return (
    <LuxuryCard padding={compact ? "compact" : "default"} className={`${compact ? "lg:p-5" : ""} ${className}`}>
      <h2 className="font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">Today&apos;s Pulse</h2>
      <dl className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2.5"}>
        {metrics.map((metric, index) => (
          <div key={metric.label} className={`flex items-center justify-between ${index > 0 ? `border-t border-luxury-border ${compact ? "pt-1.5" : "pt-2.5"}` : ""}`}>
            <dt className="text-luxury-small text-luxury-text-muted">{metric.label}</dt>
            <dd className="font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">{metric.value}</dd>
          </div>
        ))}
      </dl>
      {allZero ? <p className="mt-2 text-luxury-small text-luxury-rose">All done for today ♡</p> : null}
    </LuxuryCard>
  );
}
