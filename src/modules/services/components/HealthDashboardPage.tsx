"use client";

import { useCallback, useMemo } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { useServiceHealth } from "@/modules/services/hooks/useServiceHealth";
import { HealthLoadingState } from "@/modules/services/components/HealthLoadingState";
import { HealthScoreCard } from "@/modules/services/components/HealthScoreCard";
import { HealthBreakdownCard } from "@/modules/services/components/HealthBreakdownCard";
import { HealthCategoryList } from "@/modules/services/components/HealthCategoryList";
import { HealthIssueList } from "@/modules/services/components/HealthIssueList";
import { HealthTrendCard } from "@/modules/services/components/HealthTrendCard";
import { HealthSummarySidebar } from "@/modules/services/components/HealthSummarySidebar";
import { deriveHealthCategoryStatuses, resolveHealthNavigationTarget, type HealthNavigationTarget } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthDashboardPageProps {
  serviceId: string;
  onNavigate: (target: HealthNavigationTarget) => void;
}

/**
 * Entirely read-only — every edit this tab could ever prompt happens back
 * on Overview (base price) or in the Template Builder (every other
 * category); this page only ever reads `useServiceHealth` and renders it.
 * `deriveHealthCategoryStatuses` groups the query's own `missing[]` by
 * signal — it never recomputes `percent` or a weight, so nothing here can
 * drift from the one real Health calculation in lib/queries/services/health.ts.
 */
export function HealthDashboardPage({ serviceId, onNavigate }: HealthDashboardPageProps) {
  const query = useServiceHealth(serviceId);

  const statuses = useMemo(() => deriveHealthCategoryStatuses(query.data?.missing ?? []), [query.data]);
  const blocking = useMemo(() => statuses.filter((status) => status.isMissing && status.severity === "blocking"), [statuses]);
  const warnings = useMemo(() => statuses.filter((status) => status.isMissing && status.severity === "warning"), [statuses]);
  const complete = useMemo(() => statuses.filter((status) => !status.isMissing), [statuses]);

  const handleNavigate = useCallback(
    (jumpTo: ServiceHealthMissingItem["jumpTo"]) => {
      onNavigate(resolveHealthNavigationTarget(jumpTo));
    },
    [onNavigate],
  );

  if (query.status === "pending") {
    return <HealthLoadingState />;
  }

  if (query.status === "error") {
    return <ErrorState message="We couldn't load Service Health." onRetry={() => query.refetch()} />;
  }

  const health = query.data;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <HealthScoreCard percent={health.percent} />
        <HealthBreakdownCard blockingCount={blocking.length} warningCount={warnings.length} completeCount={complete.length} totalCount={statuses.length} />
        <HealthCategoryList statuses={statuses} onNavigate={handleNavigate} />
        <HealthIssueList blocking={blocking} warnings={warnings} onNavigate={handleNavigate} />
        <HealthTrendCard percent={health.percent} />
      </div>
      <div>
        <HealthSummarySidebar percent={health.percent} blockingCount={blocking.length} warningCount={warnings.length} statuses={statuses} onNavigate={handleNavigate} />
      </div>
    </div>
  );
}
