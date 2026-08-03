"use client";

import { useEffect, useState } from "react";
import { getProfitAndLossReport } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { ProfitAndLossReport, ProfitAndLossSectionKind } from "@/types/financeReport";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FinanceReportsNav } from "@/modules/finance/components/FinanceReportsNav";
import { ProfitAndLossFilters, type ProfitAndLossFiltersValue } from "@/modules/finance/components/ProfitAndLossFilters";
import { ProfitAndLossSectionTable } from "@/modules/finance/components/ProfitAndLossSectionTable";
import { formatEventDate } from "@/modules/events/dateFormat";

const ROLLUP_KINDS = new Set<ProfitAndLossSectionKind>(["gross_profit", "operating_income", "net_income"]);

function currentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
  };
}

const DEFAULT_FILTERS: ProfitAndLossFiltersValue = {
  ...currentMonthRange(),
  compareEnabled: false,
  comparisonStartDate: "",
  comparisonEndDate: "",
};

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; report: ProfitAndLossReport };

function validate(filters: ProfitAndLossFiltersValue): string | null {
  if (!filters.startDate || !filters.endDate) return "A start date and end date are required.";
  if (filters.endDate < filters.startDate) return "End date must not be before start date.";
  if (filters.compareEnabled) {
    if (!filters.comparisonStartDate || !filters.comparisonEndDate) {
      return "A comparison period requires both a start date and an end date.";
    }
    if (filters.comparisonEndDate < filters.comparisonStartDate) {
      return "Comparison end date must not be before comparison start date.";
    }
  }
  return null;
}

async function loadReport(filters: ProfitAndLossFiltersValue): Promise<LoadState> {
  const validationError = validate(filters);
  if (validationError) return { status: "error", message: validationError };

  try {
    const report = await getProfitAndLossReport({
      startDate: filters.startDate,
      endDate: filters.endDate,
      comparison: filters.compareEnabled
        ? { startDate: filters.comparisonStartDate, endDate: filters.comparisonEndDate }
        : undefined,
    });
    return { status: "ready", report };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not load Profit and Loss." };
  }
}

export function ProfitAndLossReportView() {
  const [filters, setFilters] = useState<ProfitAndLossFiltersValue>(DEFAULT_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadReport(DEFAULT_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runReport = () => {
    setState({ status: "loading" });
    loadReport(filters).then(setState);
  };

  const hasComparison = state.status === "ready" && state.report.comparisonStartDate !== null;
  const hasActivity = state.status === "ready" && state.report.sections.some((s) => s.rows.length > 0);

  return (
    <div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Profit and Loss</h2>
        <p className="mt-1 text-sm text-text-muted">
          Revenue and expense movement for a date range. {getDataPersistenceMessage()}
        </p>
      </div>

      <div className="mt-6">
        <FinanceReportsNav />
      </div>

      <form
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          runReport();
        }}
      >
        <ProfitAndLossFilters value={filters} onChange={setFilters} />
        <div className="mt-3">
          <Button type="submit">Run Report</Button>
        </div>
      </form>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message={state.message} onRetry={runReport} />
        ) : !hasActivity ? (
          <EmptyState
            title="No income-statement activity for this period"
            description="No revenue, cost, or expense account has posted activity in the selected date range."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              {formatEventDate(state.report.startDate)} – {formatEventDate(state.report.endDate)}
              {hasComparison
                ? ` · Compared to ${formatEventDate(state.report.comparisonStartDate)} – ${formatEventDate(state.report.comparisonEndDate)}`
                : ""}
            </p>
            {state.report.sections.map((section) =>
              ROLLUP_KINDS.has(section.kind) || section.rows.length > 0 ? (
                <ProfitAndLossSectionTable
                  key={section.kind}
                  section={section}
                  hasComparison={hasComparison}
                  emphasized={ROLLUP_KINDS.has(section.kind)}
                />
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}
