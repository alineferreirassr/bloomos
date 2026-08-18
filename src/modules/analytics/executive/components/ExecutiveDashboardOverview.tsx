"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getExecutiveDashboardData, type ExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";
import { getDashboardLayoutAction, saveDashboardLayoutAction } from "@/modules/analytics/layout/dashboardLayoutActions";
import { EXECUTIVE_DASHBOARD_WIDGET_LABELS, type ExecutiveDashboardWidgetId } from "@/modules/analytics/executive/executiveWidgets";

/** A `DashboardWidgetPreference` whose `widgetId` is narrowed to this dashboard's own known widget ids — `getDashboardLayoutAction`/`saveDashboardLayoutAction` only ever persist ids from `EXECUTIVE_DASHBOARD_WIDGET_IDS`, so this cast reflects a real, server-enforced invariant rather than an unchecked assumption. */
type KnownDashboardWidgetPreference = Omit<DashboardWidgetPreference, "widgetId"> & { widgetId: ExecutiveDashboardWidgetId };
import { ExportMenu } from "@/modules/analytics/export/components/ExportMenu";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@/lib/money";
import { BUSINESS_HEALTH_BAND_LABELS, BUSINESS_HEALTH_DIMENSION_LABELS, type DashboardWidgetPreference } from "@/types/businessIntelligence";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ExecutiveDashboardData };

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Matches `ClientFinancialSummaryCard`'s own `money()` convention — `null` means "hidden from your role" (finance.amounts.view/finance.executive.view redaction in `getExecutiveDashboardData`), never `$0.00`. */
function money(minor: number | null, currency: string): string {
  return minor === null ? "—" : formatMoney(minor, currency);
}

interface StatTileContent {
  id: ExecutiveDashboardWidgetId;
  value: string;
  trend?: { value: number | null; positiveIsGood?: boolean };
  helpText?: string;
  drillDownHref?: string;
}

interface StatTileProps extends StatTileContent {
  pinned: boolean;
  onTogglePin: () => void;
  onHide: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function StatTile({ id, value, trend, helpText, drillDownHref, pinned, onTogglePin, onHide, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: StatTileProps) {
  const router = useRouter();
  const positiveIsGood = trend?.positiveIsGood ?? true;
  const tone: BadgeTone | null = trend === undefined || trend.value === null ? null : (trend.value >= 0) === positiveIsGood ? "success" : "danger";

  return (
    <Card className="relative">
      <div className="flex items-start justify-between gap-1">
        <h3 className="truncate text-xs font-medium uppercase tracking-wide text-text-muted">{EXECUTIVE_DASHBOARD_WIDGET_LABELS[id]}</h3>
        <div className="flex shrink-0 items-center gap-0.5 text-text-muted">
          <button type="button" aria-label="Move widget earlier" title="Move earlier" disabled={!canMoveUp} onClick={onMoveUp} className="rounded px-1 text-xs hover:bg-surface-hover disabled:opacity-30">
            ↑
          </button>
          <button type="button" aria-label="Move widget later" title="Move later" disabled={!canMoveDown} onClick={onMoveDown} className="rounded px-1 text-xs hover:bg-surface-hover disabled:opacity-30">
            ↓
          </button>
          <button type="button" aria-label={pinned ? "Unpin widget" : "Pin widget"} title={pinned ? "Unpin" : "Pin"} onClick={onTogglePin} className={`rounded px-1 text-xs hover:bg-surface-hover ${pinned ? "text-accent" : ""}`}>
            📌
          </button>
          <button type="button" aria-label="Hide widget" title="Hide" onClick={onHide} className="rounded px-1 text-xs hover:bg-surface-hover">
            ✕
          </button>
        </div>
      </div>
      <div
        className={`mt-1.5 flex items-baseline justify-between gap-2 ${drillDownHref ? "cursor-pointer" : ""}`}
        onClick={drillDownHref ? () => router.push(drillDownHref) : undefined}
        role={drillDownHref ? "button" : undefined}
        tabIndex={drillDownHref ? 0 : undefined}
        onKeyDown={drillDownHref ? (e) => (e.key === "Enter" ? router.push(drillDownHref) : undefined) : undefined}
      >
        <p className="font-serif text-2xl font-semibold text-text tabular-nums">{value}</p>
        {trend !== undefined && tone !== null ? <Badge tone={tone}>{formatPercent(trend.value)}</Badge> : null}
      </div>
      {helpText ? <p className="mt-2 text-xs text-text-muted">{helpText}</p> : null}
    </Card>
  );
}

const HEALTH_BAND_TONE: Record<string, BadgeTone> = { excellent: "success", healthy: "success", attention: "warning", critical: "danger" };

function buildWidgetContent(d: ExecutiveDashboardData): Record<ExecutiveDashboardWidgetId, StatTileContent> {
  return {
    todaysRevenue: { id: "todaysRevenue", value: money(d.todaysRevenueMinor, d.currency), drillDownHref: "/finance/payments" },
    monthlyRevenue: { id: "monthlyRevenue", value: money(d.monthlyRevenueMinor, d.currency), trend: { value: d.revenueGrowthPercent }, drillDownHref: "/finance/payments" },
    revenueGrowth: { id: "revenueGrowth", value: formatPercent(d.revenueGrowthPercent), drillDownHref: "/finance/payments" },
    profit: { id: "profit", value: money(d.profitMinor, d.currency), drillDownHref: "/finance/reports/profit-and-loss" },
    expenses: { id: "expenses", value: money(d.expensesMinor, d.currency), trend: { value: null }, drillDownHref: "/finance/expenses" },
    cashFlow: { id: "cashFlow", value: money(d.cashFlowMinor, d.currency), helpText: "Cash collected minus cash expenses this month." },
    pipelineValue: { id: "pipelineValue", value: formatMoney(d.pipelineValueMinor, d.currency), drillDownHref: "/pipeline/commercial" },
    upcomingEvents: { id: "upcomingEvents", value: d.upcomingEventsCount.toLocaleString(), drillDownHref: "/events" },
    eventsThisMonth: { id: "eventsThisMonth", value: d.eventsThisMonthCount.toLocaleString(), drillDownHref: "/events" },
    conversionRate: { id: "conversionRate", value: `${d.conversionRatePercent.toFixed(1)}%`, drillDownHref: "/pipeline/commercial" },
    averageTicket: { id: "averageTicket", value: money(d.averageTicketMinor, d.currency), drillDownHref: "/finance/invoices" },
    averageDeposit: { id: "averageDeposit", value: money(d.averageDepositMinor, d.currency), drillDownHref: "/contracts" },
    outstandingPayments: { id: "outstandingPayments", value: money(d.outstandingPaymentsMinor, d.currency), drillDownHref: "/finance/invoices" },
    customerLifetimeValue: { id: "customerLifetimeValue", value: money(d.estimatedCustomerLifetimeValueMinor, d.currency), helpText: "Estimated — total collected to date divided by paying clients.", drillDownHref: "/clients" },
  };
}

/**
 * v2 Checkpoint 23, Step 1 — Executive Dashboard 2.0. All 16 spec KPIs in
 * one glanceable view, backed entirely by `getExecutiveDashboardData()`.
 * Step 14 (Custom Dashboard Widgets) layers pin/hide/reorder on top,
 * persisted per-member via `DashboardLayoutStore`. Deliberately a new tab
 * alongside (not a replacement of) Checkpoint 15's existing Overview/
 * category tabs — per the spec's own "do not redesign existing pages,"
 * nothing about the original Analytics page changes.
 */
export function ExecutiveDashboardOverview() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [widgets, setWidgets] = useState<KnownDashboardWidgetPreference[] | null>(null);

  const fetchData = () => {
    getExecutiveDashboardData().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });
    getDashboardLayoutAction().then((result) => {
      if (result.success) setWidgets(result.data.widgets as KnownDashboardWidgetPreference[]);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  function persist(next: KnownDashboardWidgetPreference[]) {
    setWidgets(next);
    saveDashboardLayoutAction(next);
  }

  function updateWidget(id: ExecutiveDashboardWidgetId, patch: Partial<Omit<DashboardWidgetPreference, "widgetId">>) {
    if (!widgets) return;
    persist(widgets.map((w) => (w.widgetId === id ? { ...w, ...patch } : w)));
  }

  const orderedVisible = useMemo(() => {
    if (!widgets) return [];
    return [...widgets]
      .filter((w) => !w.hidden)
      .sort((a, b) => (a.pinned === b.pinned ? a.order - b.order : a.pinned ? -1 : 1));
  }, [widgets]);
  const hiddenWidgets = useMemo(() => widgets?.filter((w) => w.hidden) ?? [], [widgets]);

  /** Swaps two adjacent widgets within the exact sequence currently on screen (`orderedVisible`), then renumbers every widget — visible and hidden alike — so the persisted `order` field always agrees with what's displayed. */
  function moveWidget(id: ExecutiveDashboardWidgetId, direction: -1 | 1) {
    if (!widgets) return;
    const visible = [...orderedVisible];
    const index = visible.findIndex((w) => w.widgetId === id);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= visible.length) return;
    [visible[index], visible[swapWith]] = [visible[swapWith], visible[index]];
    const reordered = [...visible, ...hiddenWidgets];
    persist(reordered.map((w, order) => ({ ...w, order })));
  }

  if (state.status === "loading" || !widgets) {
    return (
      <div aria-live="polite" aria-busy="true" className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={fetchData} />;
  }

  const d = state.data;
  const content = buildWidgetContent(d);
  const orderInList = orderedVisible.map((w) => w.widgetId);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportMenu
          filenameBase="executive-dashboard"
          sheetName="Executive Dashboard"
          headers={["KPI", "Value"]}
          rows={orderedVisible.map((widget) => [EXECUTIVE_DASHBOARD_WIDGET_LABELS[widget.widgetId], content[widget.widgetId].value])}
          pdfTitle="Executive Summary"
          pdfSections={[
            { heading: "Key Performance Indicators", lines: orderedVisible.map((widget) => `${EXECUTIVE_DASHBOARD_WIDGET_LABELS[widget.widgetId]}: ${content[widget.widgetId].value}`) },
            { heading: `Business Health Score: ${d.businessHealth.score} / 100 (${BUSINESS_HEALTH_BAND_LABELS[d.businessHealth.band]})`, lines: d.businessHealth.dimensions.map((dim) => `${BUSINESS_HEALTH_DIMENSION_LABELS[dim.dimension]}: ${dim.score === null ? "no data yet" : `${dim.score} / 100`} — ${dim.explanation}`) },
            { heading: "Revenue Forecast", lines: d.forecast ? [d.forecast.note, ...d.forecast.projected.map((p) => `${p.label}: ${formatMoney(p.value, d.currency)}`)] : ["Restricted — ask an Owner or Admin for the revenue forecast."] },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {orderedVisible.map((widget) => {
          const index = orderInList.indexOf(widget.widgetId);
          return (
            <StatTile
              key={widget.widgetId}
              {...content[widget.widgetId]}
              pinned={widget.pinned}
              onTogglePin={() => updateWidget(widget.widgetId, { pinned: !widget.pinned })}
              onHide={() => updateWidget(widget.widgetId, { hidden: true })}
              onMoveUp={() => moveWidget(widget.widgetId, -1)}
              onMoveDown={() => moveWidget(widget.widgetId, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < orderInList.length - 1}
            />
          );
        })}
      </div>

      {hiddenWidgets.length > 0 ? (
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Hidden widgets</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {hiddenWidgets.map((w) => (
              <button key={w.widgetId} type="button" className="rounded-full border border-border px-3 py-1 text-xs text-text-muted hover:bg-surface-hover" onClick={() => updateWidget(w.widgetId, { hidden: false })}>
                + {EXECUTIVE_DASHBOARD_WIDGET_LABELS[w.widgetId]}
              </button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-serif text-[17px] font-semibold text-text">Business Health Score</h3>
          <Badge tone={HEALTH_BAND_TONE[d.businessHealth.band]}>{BUSINESS_HEALTH_BAND_LABELS[d.businessHealth.band]}</Badge>
        </div>
        <p className="mt-1 font-serif text-3xl font-semibold text-text tabular-nums">{d.businessHealth.score}<span className="text-base font-normal text-text-muted"> / 100</span></p>
        <div className="mt-4 space-y-2">
          {d.businessHealth.dimensions.map((dimension) => (
            <div key={dimension.dimension} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-text">{BUSINESS_HEALTH_DIMENSION_LABELS[dimension.dimension]}</p>
                <p className="text-xs text-text-muted">{dimension.explanation}</p>
                {dimension.factors.length > 0 ? (
                  <ul className="mt-1 list-inside list-disc text-xs text-text-muted">
                    {dimension.factors.map((factor) => (
                      <li key={factor.label}>{factor.label}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="shrink-0 font-serif text-lg font-semibold text-text tabular-nums">{dimension.score === null ? "—" : dimension.score}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Revenue Forecast</h3>
        {d.forecast ? (
          <>
            <p className="mt-1 text-xs text-text-muted">{d.forecast.note}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-text-muted">
                    <th className="pb-2 pr-3 font-normal">Period</th>
                    <th className="pb-2 font-normal">Projected Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {d.forecast.projected.map((point) => (
                    <tr key={point.label} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 text-text">{point.label}</td>
                      <td className="py-2 tabular-nums text-text-muted">{formatMoney(point.value, d.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-text-muted">Restricted — ask an Owner or Admin for the revenue forecast.</p>
        )}
      </Card>
    </div>
  );
}
