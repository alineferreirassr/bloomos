"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, getExpenseNextAction, getExpenses } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Expense } from "@/types/expense";
import type { Event } from "@/types/event";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModuleHero } from "@/components/ui/ModuleHero";
import { ConnectedRail } from "@/components/ui/ConnectedRail";
import {
  ExpenseFilters,
  DEFAULT_EXPENSE_FILTERS,
  type ExpenseFiltersValue,
} from "@/modules/finance/components/ExpenseFilters";
import { ExpenseListTable } from "@/modules/finance/components/ExpenseListTable";
import { ExpenseListCards } from "@/modules/finance/components/ExpenseListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface ExpenseListRow {
  expense: Expense;
  event: Event | undefined;
  nextAction: string | null;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: ExpenseListRow[] };

async function loadExpensesFor(filters: ExpenseFiltersValue): Promise<LoadState> {
  try {
    const [expenses, events] = await Promise.all([
      getExpenses({
        search: filters.search,
        status: filters.status,
        category: filters.category,
        dueOnly: filters.dueOnly,
        unpaidOnly: filters.unpaidOnly,
        reimbursableOnly: filters.reimbursableOnly,
        includeArchived: filters.includeArchived,
      }),
      getEvents({ includeArchived: true }),
    ]);
    const eventsById = new Map(events.map((event) => [event.id, event]));

    const sorted = [...expenses].sort(
      (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
    );

    const rows = await Promise.all(
      sorted.map(async (expense) => {
        const nextAction = await getExpenseNextAction(expense.id);
        return {
          expense,
          event: expense.event_id ? eventsById.get(expense.event_id) : undefined,
          nextAction,
        };
      }),
    );

    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function ExpensesListView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [filters, setFilters] = useState<ExpenseFiltersValue>(DEFAULT_EXPENSE_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadExpensesFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: ExpenseFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
  };

  const retry = () => {
    setState({ status: "loading" });
    setRetryToken((token) => token + 1);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.category !== "all" ||
    filters.dueOnly ||
    filters.unpaidOnly ||
    filters.reimbursableOnly;

  return (
    // GLOBAL-VISUAL-06 (Business) — same AF-ported dense-list shell as
    // Leads/Events/Inventory (ModuleHero compact + ConnectedRail).
    // Expenses/Invoices/Payments are reached via Finance Overview's own
    // cards, not the FinanceLedgerNav tab bar (which stays specific to
    // Chart of Accounts/Journal/Periods/Reports), so this shell — not
    // FinanceLedgerNav's tabs — is the right orientation pattern here.
    <div className="mx-auto max-w-6xl">
      <ModuleHero
        compact
        eyebrow="Finance"
        title="Expenses"
        purpose="Every cost the business incurs — Event-specific, general business, or supplier/team-related."
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Finance", href: "/finance" }, { label: "Expenses" }]}
        actions={
          canCreate ? (
            <Link href="/finance/expenses/new">
              <Button>New Expense</Button>
            </Link>
          ) : null
        }
        source={
          <p className="flex items-center gap-1.5 text-xs text-text-muted/80">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {getDataPersistenceMessage()}
          </p>
        }
      />

      <section aria-label="Where Expenses sits in your workflow" className="mt-8">
        <ConnectedRail
          items={[
            { label: "Finance", href: "/finance" },
            { label: "Invoices", href: "/finance/invoices" },
            { label: "Expenses", current: true },
            { label: "Payments", href: "/finance/payments" },
          ]}
        />
      </section>

      <div className="mt-8">
        <ExpenseFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load expenses." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No expenses match these filters" : "No expenses yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New expenses you create will show up here."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/finance/expenses/new">
                  <Button>New Expense</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ExpenseListTable rows={state.rows} />
            <ExpenseListCards rows={state.rows} />
          </>
        )}
      </div>
    </div>
  );
}
