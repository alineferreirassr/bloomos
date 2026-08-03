"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRevenueBreakdown } from "@/modules/analytics/revenue/getRevenueBreakdown";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { TrendWindowPicker } from "@/modules/analytics/components/TrendWindowPicker";
import { ExportMenu } from "@/modules/analytics/export/components/ExportMenu";
import { formatMoney } from "@/lib/money";
import { REVENUE_BREAKDOWN_DIMENSIONS, REVENUE_BREAKDOWN_DIMENSION_LABELS } from "@/types/businessIntelligence";
import type { RevenueBreakdown } from "@/types/businessIntelligence";
import type { TrendWindowKey } from "@/types/analytics";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: RevenueBreakdown };

/** Caps how many rows the on-screen table renders — rows are already sorted by revenue descending, so the most meaningful ones are never truncated. Exports (CSV/Excel/PDF) always get the complete, uncapped dataset via `state.data.rows`; only DOM rendering is bounded, since a "by client"/"by event" breakdown could otherwise render thousands of table rows for a large workspace. */
const MAX_VISIBLE_ROWS = 50;

function BreakdownTable({ state, currency, onRetry }: { state: LoadState; currency: string; onRetry: () => void }) {
  const router = useRouter();

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={onRetry} />;
  if (state.data.rows.length === 0) return <EmptyState title="No revenue in this window" description="No succeeding payments fall in the selected window for this breakdown." />;

  const visibleRows = state.data.rows.slice(0, MAX_VISIBLE_ROWS);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ExportMenu
          filenameBase={`revenue-${state.data.dimension}`}
          sheetName={REVENUE_BREAKDOWN_DIMENSION_LABELS[state.data.dimension]}
          headers={[REVENUE_BREAKDOWN_DIMENSION_LABELS[state.data.dimension], "Revenue", "Share %"]}
          rows={state.data.rows.map((row) => [row.label, row.revenueMinor / 100, state.data.totalMinor === 0 ? 0 : Number(((row.revenueMinor / state.data.totalMinor) * 100).toFixed(1))])}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="pb-2 pr-3 font-normal">{REVENUE_BREAKDOWN_DIMENSION_LABELS[state.data.dimension]}</th>
              <th className="pb-2 pr-3 font-normal">Revenue</th>
              <th className="pb-2 font-normal">Share</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-border/60 last:border-0 ${row.drillDown ? "cursor-pointer hover:bg-surface-hover" : ""}`}
                role={row.drillDown ? "button" : undefined}
                tabIndex={row.drillDown ? 0 : undefined}
                aria-label={row.drillDown ? row.drillDown.label : undefined}
                onClick={row.drillDown ? () => router.push(row.drillDown!.href) : undefined}
                onKeyDown={row.drillDown ? (e) => (e.key === "Enter" ? router.push(row.drillDown!.href) : undefined) : undefined}
              >
                <td className="py-2 pr-3 text-text">{row.label}</td>
                <td className="py-2 pr-3 tabular-nums text-text">{formatMoney(row.revenueMinor, currency)}</td>
                <td className="py-2 tabular-nums text-text-muted">{state.data.totalMinor === 0 ? "—" : `${((row.revenueMinor / state.data.totalMinor) * 100).toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.data.rows.length > MAX_VISIBLE_ROWS ? (
          <p className="mt-2 text-xs text-text-muted">
            Showing the top {MAX_VISIBLE_ROWS} of {state.data.rows.length} rows by revenue — export to see all of them.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** v2 Checkpoint 23, Step 2 — Revenue Analytics: one tab per breakdown dimension, all sharing the same Trend Window picker (reused from Checkpoint 15). */
export function RevenueAnalyticsPanel() {
  const [windowKey, setWindowKey] = useState<TrendWindowKey>("30d");
  const [dimension, setDimension] = useState<(typeof REVENUE_BREAKDOWN_DIMENSIONS)[number]>("month");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () => {
    getRevenueBreakdown(dimension, windowKey).then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, windowKey]);

  const currency = "usd";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-muted">
          {state.status === "ready" ? `${formatMoney(state.data.totalMinor, currency)} total` : " "}
        </p>
        <TrendWindowPicker value={windowKey} onChange={setWindowKey} />
      </div>
      <Card>
        <Tabs value={dimension} onValueChange={(value) => setDimension(value as (typeof REVENUE_BREAKDOWN_DIMENSIONS)[number])}>
          <TabList aria-label="Revenue breakdown dimension">
            {REVENUE_BREAKDOWN_DIMENSIONS.map((dim) => (
              <Tab key={dim} value={dim}>
                {REVENUE_BREAKDOWN_DIMENSION_LABELS[dim]}
              </Tab>
            ))}
          </TabList>
          {REVENUE_BREAKDOWN_DIMENSIONS.map((dim) => (
            <TabPanel key={dim} value={dim} className="mt-4">
              <BreakdownTable state={state} currency={currency} onRetry={fetchData} />
            </TabPanel>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}
