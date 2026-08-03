"use client";

import { useEffect, useState } from "react";
import { getGeneralLedgerReport, getChartOfAccounts } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { GeneralLedgerReport } from "@/types/financeReport";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FinanceReportsNav } from "@/modules/finance/components/FinanceReportsNav";
import { GeneralLedgerFilters, type GeneralLedgerFiltersValue } from "@/modules/finance/components/GeneralLedgerFilters";
import { GeneralLedgerAccountSection } from "@/modules/finance/components/GeneralLedgerAccountSection";
import { formatEventDate } from "@/modules/events/dateFormat";

function currentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
  };
}

const DEFAULT_FILTERS: GeneralLedgerFiltersValue = {
  ...currentMonthRange(),
  accountId: "",
  accountType: "",
  sourceType: "",
};

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; report: GeneralLedgerReport };

/** Requires a syntactically valid range client-side before ever calling the Repository — the RPC's own P1200 check remains the final authority. */
function validateRange(filters: GeneralLedgerFiltersValue): string | null {
  if (!filters.startDate || !filters.endDate) return "A start date and end date are required.";
  if (filters.endDate < filters.startDate) return "End date must not be before start date.";
  return null;
}

async function loadReport(filters: GeneralLedgerFiltersValue): Promise<LoadState> {
  const validationError = validateRange(filters);
  if (validationError) return { status: "error", message: validationError };

  try {
    const report = await getGeneralLedgerReport({
      startDate: filters.startDate,
      endDate: filters.endDate,
      accountId: filters.accountId || undefined,
      accountType: filters.accountType || undefined,
      sourceType: filters.sourceType.trim() === "" ? undefined : filters.sourceType.trim(),
    });
    return { status: "ready", report };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Could not load the General Ledger." };
  }
}

export function GeneralLedgerReportView() {
  const [filters, setFilters] = useState<GeneralLedgerFiltersValue>(DEFAULT_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [accounts, setAccounts] = useState<ChartOfAccount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChartOfAccounts().then((result) => {
      if (!cancelled) setAccounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadReport(DEFAULT_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally runs once — subsequent filter changes are submitted explicitly.
  }, []);

  const runReport = () => {
    setState({ status: "loading" });
    loadReport(filters).then(setState);
  };

  const retry = () => {
    runReport();
  };

  const accountsWithActivity =
    state.status === "ready" ? state.report.accounts.filter((account) => account.transactions.length > 0 || account.openingBalanceMinor !== 0) : [];

  return (
    <div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">General Ledger</h2>
        <p className="mt-1 text-sm text-text-muted">
          Every posted transaction by account, with a running balance. {getDataPersistenceMessage()}
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
        <GeneralLedgerFilters value={filters} onChange={setFilters} accounts={accounts} />
        <div className="mt-3">
          <Button type="submit">Run Report</Button>
        </div>
      </form>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message={state.message} onRetry={retry} />
        ) : (
          <>
            <p className="text-xs text-text-muted">
              {formatEventDate(state.report.startDate)} – {formatEventDate(state.report.endDate)} · {accountsWithActivity.length}{" "}
              account{accountsWithActivity.length === 1 ? "" : "s"} with activity
            </p>

            {accountsWithActivity.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No ledger activity for this range"
                  description="No account has a nonzero opening balance or in-range transaction for the selected filters."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {accountsWithActivity.map((account) => (
                  <GeneralLedgerAccountSection key={account.accountId} account={account} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
