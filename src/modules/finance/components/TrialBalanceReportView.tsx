"use client";

import { useEffect, useState } from "react";
import { getTrialBalanceReport } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { TrialBalanceReport } from "@/types/financeReport";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FinanceReportsNav } from "@/modules/finance/components/FinanceReportsNav";
import { TrialBalanceFilters, type TrialBalanceFiltersValue } from "@/modules/finance/components/TrialBalanceFilters";
import { TrialBalanceTable } from "@/modules/finance/components/TrialBalanceTable";
import { ReportInvariantAlert } from "@/modules/finance/components/ReportInvariantAlert";
import { formatEventDate } from "@/modules/events/dateFormat";

const DEFAULT_FILTERS: TrialBalanceFiltersValue = {
  asOfDate: new Date().toISOString().slice(0, 10),
  includeZeroBalances: false,
};

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; report: TrialBalanceReport };

async function loadReport(filters: TrialBalanceFiltersValue): Promise<LoadState> {
  if (!filters.asOfDate) return { status: "error", message: "An as-of date is required." };
  try {
    const report = await getTrialBalanceReport({ asOfDate: filters.asOfDate, includeZeroBalances: filters.includeZeroBalances });
    return { status: "ready", report };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not load the Trial Balance." };
  }
}

export function TrialBalanceReportView() {
  const [filters, setFilters] = useState<TrialBalanceFiltersValue>(DEFAULT_FILTERS);
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

  const runReport = (next: TrialBalanceFiltersValue = filters) => {
    setState({ status: "loading" });
    loadReport(next).then(setState);
  };

  return (
    <div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Trial Balance</h2>
        <p className="mt-1 text-sm text-text-muted">
          Every account&apos;s ending balance as of one date. {getDataPersistenceMessage()}
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
        <TrialBalanceFilters value={filters} onChange={setFilters} />
        <div className="mt-3">
          <Button type="submit">Run Report</Button>
        </div>
      </form>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message={state.message} onRetry={() => runReport()} />
        ) : state.report.rows.length === 0 ? (
          <EmptyState
            title="No posted ledger balances as of this date"
            description="No account has debit or credit activity through the selected as-of date."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">As of {formatEventDate(state.report.asOfDate)}</p>
            <ReportInvariantAlert
              isBalanced={state.report.isBalanced}
              balancedMessage="total ending debits equal total ending credits."
              unbalancedMessage="total ending debits do not equal total ending credits. Do not rely on these figures until this is investigated."
            />
            <TrialBalanceTable
              rows={state.report.rows}
              totalEndingDebitMinor={state.report.totalEndingDebitMinor}
              totalEndingCreditMinor={state.report.totalEndingCreditMinor}
            />
          </div>
        )}
      </div>
    </div>
  );
}
