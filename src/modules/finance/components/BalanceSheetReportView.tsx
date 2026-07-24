"use client";

import { useEffect, useState } from "react";
import { getBalanceSheetReport } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { BalanceSheetReport } from "@/types/financeReport";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MoneyCell } from "@/modules/finance/components/MoneyCell";
import { FinanceReportsNav } from "@/modules/finance/components/FinanceReportsNav";
import { BalanceSheetFilters, type BalanceSheetFiltersValue } from "@/modules/finance/components/BalanceSheetFilters";
import { BalanceSheetSectionTable } from "@/modules/finance/components/BalanceSheetSectionTable";
import { ReportInvariantAlert } from "@/modules/finance/components/ReportInvariantAlert";
import { formatEventDate } from "@/modules/events/dateFormat";

const DEFAULT_FILTERS: BalanceSheetFiltersValue = { asOfDate: new Date().toISOString().slice(0, 10) };

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; report: BalanceSheetReport };

async function loadReport(filters: BalanceSheetFiltersValue): Promise<LoadState> {
  if (!filters.asOfDate) return { status: "error", message: "An as-of date is required." };
  try {
    const report = await getBalanceSheetReport({ asOfDate: filters.asOfDate });
    return { status: "ready", report };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not load the Balance Sheet." };
  }
}

export function BalanceSheetReportView() {
  const [filters, setFilters] = useState<BalanceSheetFiltersValue>(DEFAULT_FILTERS);
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

  const hasActivity = state.status === "ready" && state.report.sections.some((s) => s.rows.length > 0);

  return (
    <div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Balance Sheet</h2>
        <p className="mt-1 text-sm text-text-muted">
          Assets, Liabilities, and Equity as of one date. {getDataPersistenceMessage()}
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
        <BalanceSheetFilters value={filters} onChange={setFilters} />
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
            title="No posted Balance Sheet activity as of this date"
            description="No asset, liability, or equity account has posted activity through the selected as-of date."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">As of {formatEventDate(state.report.asOfDate)}</p>
            <ReportInvariantAlert
              isBalanced={state.report.isBalanced}
              balancedMessage="total Assets equal total Liabilities plus Equity."
              unbalancedMessage="total Assets do not equal total Liabilities plus Equity. Do not rely on these figures until this is investigated."
            />
            {state.report.sections.map((section) =>
              section.rows.length > 0 ? <BalanceSheetSectionTable key={section.kind} section={section} /> : null,
            )}

            <div className="rounded-md border border-border bg-text/4 p-3.5">
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Total Assets</dt>
                  <dd className="font-medium">
                    <MoneyCell amountMinor={state.report.totalAssetsMinor} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Total Liabilities</dt>
                  <dd className="font-medium">
                    <MoneyCell amountMinor={state.report.totalLiabilitiesMinor} />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Total Equity</dt>
                  <dd className="font-medium">
                    <MoneyCell amountMinor={state.report.totalEquityMinor} />
                  </dd>
                </div>
                <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 font-serif text-base font-semibold">
                  <dt>Total Liabilities and Equity</dt>
                  <dd>
                    <MoneyCell amountMinor={state.report.totalLiabilitiesMinor + state.report.totalEquityMinor} />
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
