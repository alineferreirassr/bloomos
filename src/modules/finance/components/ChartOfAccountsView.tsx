"use client";

import { useEffect, useMemo, useState } from "react";
import { getChartOfAccounts } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { ChartOfAccount } from "@/types/chartOfAccount";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FinanceLedgerNav } from "@/modules/finance/components/FinanceLedgerNav";
import {
  ChartOfAccountsFilters,
  DEFAULT_CHART_OF_ACCOUNTS_FILTERS,
  type ChartOfAccountsFiltersValue,
} from "@/modules/finance/components/ChartOfAccountsFilters";
import { ChartOfAccountsTable } from "@/modules/finance/components/ChartOfAccountsTable";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; accounts: ChartOfAccount[] };

async function loadAccounts(includeArchived: boolean): Promise<LoadState> {
  try {
    const accounts = await getChartOfAccounts({ includeArchived });
    return { status: "ready", accounts };
  } catch {
    return { status: "error" };
  }
}

/**
 * Read-only this phase — no create/edit/archive action exists for a Chart
 * of Accounts entry (the ~40 accounts are seeded by the Database Foundation
 * migration, not managed here). account_type/includeArchived filtering and
 * ordering come straight from listChartOfAccounts; search is applied
 * client-side over the already-loaded, small (~40-row) result set.
 */
export function ChartOfAccountsView() {
  const [filters, setFilters] = useState<ChartOfAccountsFiltersValue>(DEFAULT_CHART_OF_ACCOUNTS_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadAccounts(DEFAULT_CHART_OF_ACCOUNTS_FILTERS.includeArchived).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleIncludeArchivedChange = (next: ChartOfAccountsFiltersValue) => {
    const includeArchivedChanged = next.includeArchived !== filters.includeArchived;
    setFilters(next);
    if (includeArchivedChanged) {
      setState({ status: "loading" });
      loadAccounts(next.includeArchived).then(setState);
    }
  };

  const retry = () => {
    setState({ status: "loading" });
    loadAccounts(filters.includeArchived).then(setState);
  };

  const accountsById = useMemo(() => {
    if (state.status !== "ready") return new Map<string, ChartOfAccount>();
    return new Map(state.accounts.map((account) => [account.id, account]));
  }, [state]);

  const filteredAccounts = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = filters.search.trim().toLowerCase();
    return state.accounts.filter((account) => {
      if (filters.accountType !== "all" && account.account_type !== filters.accountType) return false;
      if (q === "") return true;
      return account.name.toLowerCase().includes(q) || String(account.account_number).includes(q);
    });
  }, [state, filters]);

  const hasActiveFilters = filters.search !== "" || filters.accountType !== "all" || filters.includeArchived;

  return (
    <div>
      <div>
        <h2 className="font-serif text-3xl font-semibold text-text">Chart of Accounts</h2>
        <p className="mt-1 text-sm text-text-muted">
          The workspace&apos;s ledger accounts, ordered by account number. {getDataPersistenceMessage()}
        </p>
      </div>

      <div className="mt-6">
        <FinanceLedgerNav />
      </div>

      <div className="mt-6">
        <ChartOfAccountsFilters value={filters} onChange={handleIncludeArchivedChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load the Chart of Accounts." onRetry={retry} />
        ) : filteredAccounts.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No accounts match these filters" : "No accounts yet"}
            description={hasActiveFilters ? "Try adjusting or clearing your filters." : undefined}
          />
        ) : (
          <ChartOfAccountsTable accounts={filteredAccounts} accountsById={accountsById} />
        )}
      </div>
    </div>
  );
}
