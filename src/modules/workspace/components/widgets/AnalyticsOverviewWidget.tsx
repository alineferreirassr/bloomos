import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";
import type { ExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";

/** v2.0 Checkpoint 38, Step 12 — reuses `getExecutiveDashboardData()` (Checkpoint 23, Executive Analytics & BI) directly; no metric here is recomputed. */
export function AnalyticsOverviewWidget({ analytics }: { analytics: ExecutiveDashboardData | null }) {
  if (!analytics) {
    return <EmptyState title="Analytics unavailable" description="Could not be loaded right now." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-text-muted">Revenue this month</p>
          <p className="mt-0.5 text-lg font-semibold text-text">{formatMoney(analytics.monthlyRevenueMinor, analytics.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Pipeline value</p>
          <p className="mt-0.5 text-lg font-semibold text-text">{formatMoney(analytics.pipelineValueMinor, analytics.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Upcoming events</p>
          <p className="mt-0.5 text-lg font-semibold text-text">{analytics.upcomingEventsCount}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Conversion rate</p>
          <p className="mt-0.5 text-lg font-semibold text-text">{analytics.conversionRatePercent}%</p>
        </div>
      </div>
      <Link href="/analytics" className="text-xs font-medium text-accent hover:underline">
        Open Analytics →
      </Link>
    </div>
  );
}
