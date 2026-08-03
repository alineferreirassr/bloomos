"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAnalyticsDashboardData, type AnalyticsDashboardData } from "@/modules/analytics/getAnalyticsDashboardData";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/modules/analytics/components/KpiCard";
import { TrendWindowPicker } from "@/modules/analytics/components/TrendWindowPicker";
import { AnalyticsExecutiveSummaryCard } from "@/modules/analytics/components/AnalyticsExecutiveSummaryCard";
import { ExecutiveDashboardOverview } from "@/modules/analytics/executive/components/ExecutiveDashboardOverview";
import { RevenueAnalyticsPanel } from "@/modules/analytics/revenue/components/RevenueAnalyticsPanel";
import { ProfitabilityPanel } from "@/modules/analytics/profitability/components/ProfitabilityPanel";
import { SalesFunnelPanel } from "@/modules/analytics/funnel/components/SalesFunnelPanel";
import { ClientIntelligencePanel } from "@/modules/analytics/clientIntelligence/components/ClientIntelligencePanel";
import { EventIntelligencePanel } from "@/modules/analytics/eventIntelligence/components/EventIntelligencePanel";
import { OperationsAnalyticsPanel } from "@/modules/analytics/operationsAnalytics/components/OperationsAnalyticsPanel";
import { FinancialForecastPanel } from "@/modules/analytics/forecast/components/FinancialForecastPanel";
import { GoalsPanel } from "@/modules/analytics/goals/components/GoalsPanel";
import { BenchmarkPanel } from "@/modules/analytics/benchmark/components/BenchmarkPanel";
import { ExecutiveInsightsPanel } from "@/modules/analytics/insights/components/ExecutiveInsightsPanel";
import type { MetricCategory, TrendWindowKey } from "@/types/analytics";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: AnalyticsDashboardData };

const CATEGORY_TABS: { value: MetricCategory; label: string }[] = [
  { value: "revenue", label: "Revenue" },
  { value: "finance", label: "Finance" },
  { value: "clients", label: "Clients" },
  { value: "events", label: "Events" },
  { value: "operations", label: "Operations" },
  { value: "documents", label: "Documents" },
  { value: "workflow", label: "Workflow" },
  { value: "ai", label: "AI" },
  { value: "portal", label: "Portal" },
];

function MetricGrid({ snapshots, emptyDescription }: { snapshots: AnalyticsDashboardData["overview"]; emptyDescription: string }) {
  if (snapshots.length === 0) return <EmptyState title="Nothing to show yet" description={emptyDescription} />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {snapshots.map((snapshot) => (
        <KpiCard key={snapshot.metric.id} snapshot={snapshot} />
      ))}
    </div>
  );
}

/**
 * Checkpoint 15, Step 3 — the Executive Dashboard shell: Overview plus one
 * tab per Metrics Registry category. Every tab renders the exact same
 * generic `KpiCard` grid over `getAnalyticsDashboardData()`'s own output —
 * no per-category hand-built visualization, matching Step 2's own "never
 * hardcode calculations inside the UI" for layout too.
 */
export function AnalyticsDashboardView() {
  const router = useRouter();
  const [windowKey, setWindowKey] = useState<TrendWindowKey>("30d");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = (key: TrendWindowKey) =>
    getAnalyticsDashboardData(key).then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData(windowKey);
  }, [windowKey]);

  useEffect(() => {
    registerCommand({ id: "open-analytics", label: "Open Analytics", group: "Analytics", keywords: ["analytics", "metrics", "dashboard", "kpi"], run: () => router.push("/analytics") });
    return () => unregisterCommand("open-analytics");
  }, [router]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="The executive view of business performance, financial health, and engagement across every module."
        actions={<TrendWindowPicker value={windowKey} onChange={setWindowKey} />}
      />

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true" className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={() => fetchData(windowKey)} />
      ) : (
        <Tabs defaultValue="executive">
          <TabList aria-label="Analytics categories">
            <Tab value="executive">Executive</Tab>
            <Tab value="revenue-analytics">Revenue Analytics</Tab>
            <Tab value="profitability">Profitability</Tab>
            <Tab value="sales-funnel">Sales Funnel</Tab>
            <Tab value="client-intelligence">Client Intelligence</Tab>
            <Tab value="event-intelligence">Event Intelligence</Tab>
            <Tab value="operations-analytics">Operations</Tab>
            <Tab value="financial-forecast">Forecast</Tab>
            <Tab value="goals">Goals</Tab>
            <Tab value="benchmark">Benchmark</Tab>
            <Tab value="insights">Bloom AI Insights</Tab>
            <Tab value="overview">Overview</Tab>
            {CATEGORY_TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tab>
            ))}
          </TabList>

          <TabPanel value="executive" className="mt-4">
            <ExecutiveDashboardOverview />
          </TabPanel>

          <TabPanel value="revenue-analytics" className="mt-4">
            <RevenueAnalyticsPanel />
          </TabPanel>

          <TabPanel value="profitability" className="mt-4">
            <ProfitabilityPanel />
          </TabPanel>

          <TabPanel value="sales-funnel" className="mt-4">
            <SalesFunnelPanel />
          </TabPanel>

          <TabPanel value="client-intelligence" className="mt-4">
            <ClientIntelligencePanel />
          </TabPanel>

          <TabPanel value="event-intelligence" className="mt-4">
            <EventIntelligencePanel />
          </TabPanel>

          <TabPanel value="operations-analytics" className="mt-4">
            <OperationsAnalyticsPanel />
          </TabPanel>

          <TabPanel value="financial-forecast" className="mt-4">
            <FinancialForecastPanel />
          </TabPanel>

          <TabPanel value="goals" className="mt-4">
            <GoalsPanel />
          </TabPanel>

          <TabPanel value="benchmark" className="mt-4">
            <BenchmarkPanel />
          </TabPanel>

          <TabPanel value="insights" className="mt-4">
            <ExecutiveInsightsPanel />
          </TabPanel>

          <TabPanel value="overview" className="mt-4 space-y-6">
            <AnalyticsExecutiveSummaryCard windowKey={windowKey} />
            <MetricGrid snapshots={state.data.overview} emptyDescription="No metrics are visible to your role yet." />
          </TabPanel>

          {CATEGORY_TABS.map((tab) => (
            <TabPanel key={tab.value} value={tab.value} className="mt-4">
              <MetricGrid snapshots={state.data.byCategory[tab.value]} emptyDescription={`No ${tab.label} metrics are visible to your role yet.`} />
            </TabPanel>
          ))}
        </Tabs>
      )}
    </div>
  );
}
