"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getJournalEntries, getAccountingPeriods } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { JournalEntry } from "@/types/journalEntry";
import type { AccountingPeriod } from "@/types/accountingPeriod";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FinanceLedgerNav } from "@/modules/finance/components/FinanceLedgerNav";
import {
  JournalEntryFilters,
  DEFAULT_JOURNAL_ENTRY_FILTERS,
  type JournalEntryFiltersValue,
} from "@/modules/finance/components/JournalEntryFilters";
import { JournalEntriesTable } from "@/modules/finance/components/JournalEntriesTable";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

const PAGE_SIZE = 25;

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; entries: JournalEntry[]; periods: AccountingPeriod[] };

async function loadEntries(filters: JournalEntryFiltersValue, page: number): Promise<LoadState> {
  try {
    const [entries, periods] = await Promise.all([
      getJournalEntries({
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        sourceType: filters.sourceType.trim() === "" ? undefined : filters.sourceType.trim(),
        postingStatus: filters.postingStatus,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
      getAccountingPeriods(),
    ]);
    return { status: "ready", entries, periods };
  } catch {
    return { status: "error" };
  }
}

/** Pagination is Previous/Next over the Repository's own limit/offset — listJournalEntries already orders deterministically (entry_date desc, id desc), so a page boundary never shifts between requests. */
export function JournalEntriesListView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [filters, setFilters] = useState<JournalEntryFiltersValue>(DEFAULT_JOURNAL_ENTRY_FILTERS);
  const [page, setPage] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadEntries(DEFAULT_JOURNAL_ENTRY_FILTERS, 0).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: JournalEntryFiltersValue) => {
    setFilters(next);
    setPage(0);
    setState({ status: "loading" });
    loadEntries(next, 0).then(setState);
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    setState({ status: "loading" });
    loadEntries(filters, nextPage).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadEntries(filters, page).then(setState);
  };

  const hasActiveFilters =
    filters.dateFrom !== "" || filters.dateTo !== "" || filters.sourceType !== "" || filters.postingStatus !== "all";

  const periodsById =
    state.status === "ready" ? new Map(state.periods.map((period) => [period.id, period])) : new Map<string, AccountingPeriod>();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Journal Entries</h2>
          <p className="mt-1 text-sm text-text-muted">
            Every posted ledger entry across the workspace. {getDataPersistenceMessage()}
          </p>
        </div>
        {canCreate ? (
          <Link href="/finance/journal/new">
            <Button>Record Manual Adjustment</Button>
          </Link>
        ) : null}
      </div>

      <div className="mt-6">
        <FinanceLedgerNav />
      </div>

      <div className="mt-6">
        <JournalEntryFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load Journal Entries." onRetry={retry} />
        ) : state.entries.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No Journal Entries match these filters" : "No Journal Entries yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Entries appear here once a Payment, Expense, Purchase, Manual Adjustment, or Reversal posts to the ledger."
            }
          />
        ) : (
          <>
            <JournalEntriesTable entries={state.entries} periodsById={periodsById} />
            <div className="mt-4 flex items-center justify-between">
              <Button variant="secondary" onClick={() => goToPage(page - 1)} disabled={page === 0}>
                Previous
              </Button>
              <span className="text-xs text-text-muted">Page {page + 1}</span>
              <Button
                variant="secondary"
                onClick={() => goToPage(page + 1)}
                disabled={state.entries.length < PAGE_SIZE}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
